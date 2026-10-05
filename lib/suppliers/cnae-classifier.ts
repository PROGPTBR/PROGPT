import { z } from 'zod';
import { getOpenAI, getOpenAIModel } from '@/lib/llm/openai';
import { recordApiUsage } from '@/lib/observability/api-usage';
import { getReceitaSql } from './receita-db';
import {
  UF_LIST,
  type CnaeAlternative,
  type ClassifyResponse,
} from './types';

// Pipeline em 3 passos:
//   1. Extract — LLM extrai { activityDescription, scope, states?, cities? }
//      do texto livre do usuário. Sem CNAE list no prompt — só regras.
//   2. FTS retrieve — busca top 10 em cnae_taxonomy via Postgres
//      `plainto_tsquery('portuguese', ...)` sobre denominacao +
//      notas_explicativas + exemplos_atividades. Rank por `ts_rank`.
//   3. Pick — LLM escolhe o melhor dos 10 candidatos (recebe só code+name).
//
// Histórico: o plano original previa vector search via `embedding_rich`
// (1024 dim, mesma do Voyage). Smoke test em 2026-05-21 mostrou que
// os embeddings persistidos foram gerados por OUTRO modelo (espaço de
// embedding incompatível com Voyage — todas as similaridades vinham
// próximas de 0.05). FTS resolve o caso de uso com qualidade alta
// (autocomplete já validou), zero dependência do modelo de embedding.

const EXTRACT_TIMEOUT_MS = 8_000;
const PICK_TIMEOUT_MS = 8_000;

const SCOPE_VALUES = ['national', 'regional', 'state', 'city'] as const;

const ExtractSchema = z.object({
  activityDescription: z.string().min(1),
  // Pedido de PRODUTO pronto: o comércio atacadista da categoria, no
  // vocabulário da CNAE. A tabela de CNAE só cita produto (ex.: "canetas") na
  // FABRICAÇÃO; o comércio é nomeado por categoria ("artigos de escritório e
  // de papelaria"). Sem esta ponte, comprar caneta em Natal virava "fabricação
  // de canetas" e dava zero (achado 2026-10-05).
  commerceDescription: z.string().nullish(),
  scope: z.enum(SCOPE_VALUES),
  states: z.array(z.string()).optional(),
  cities: z.array(z.string()).optional(),
});

const PickSchema = z.object({
  cnaeCode: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
  // Códigos dos candidatos que mais servem de alternativa (ex.: o varejo e a
  // fabricação do mesmo produto). Sem isto as alternativas eram só os
  // próximos da lista do FTS — muitas vezes sem relação nenhuma.
  alternatives: z.array(z.string()).optional(),
});

// Mapa de regiões em PT (a LLM extrai "regional" + states populado por nome).
const REGIONS_PT = {
  Norte: ['AC', 'AP', 'AM', 'PA', 'RO', 'RR', 'TO'],
  Nordeste: ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'],
  Sudeste: ['ES', 'MG', 'RJ', 'SP'],
  Sul: ['PR', 'RS', 'SC'],
  CentroOeste: ['DF', 'GO', 'MT', 'MS'],
} as const;

const EXTRACT_SYSTEM_PROMPT = `Você extrai parâmetros de busca de fornecedores a partir de um texto livre em PT-BR.

Responda SEMPRE com JSON estrito conforme schema. Não adicione texto fora do JSON.

Campos:
- activityDescription: descrição CURTA (≤ 8 palavras) da atividade econômica desejada, em português corporativo. Exemplos: "fabricação de embalagens plásticas", "transporte rodoviário de carga", "consultoria em TI", "indústria têxtil". NUNCA inclua marca, região, ou intenção comercial — só a atividade.
- scope: "national" | "regional" | "state" | "city".
  - national = busca em todo o Brasil OU sem menção de local
  - regional = menciona região (Nordeste, Sul, Sudeste, Norte, Centro-Oeste)
  - state = menciona 1+ UF/estado específicos
  - city = menciona cidade(s)
- states: array de UFs (2 letras maiúsculas) quando scope ∈ ("regional","state"). Use a lista canônica: ${UF_LIST.join(', ')}. Para regional, retorne TODOS os UFs daquela região.
  - Norte: AC, AP, AM, PA, RO, RR, TO
  - Nordeste: AL, BA, CE, MA, PB, PE, PI, RN, SE
  - Sudeste: ES, MG, RJ, SP
  - Sul: PR, RS, SC
  - Centro-Oeste: DF, GO, MT, MS
- cities: array de nomes de cidade quando scope = "city". Em PT-BR sem acento opcional.
- commerceDescription: quando o pedido é COMPRAR UM PRODUTO pronto (não um serviço), a descrição do COMÉRCIO ATACADISTA da categoria desse produto, com o vocabulário oficial da CNAE. Ex.: caneta → "comércio atacadista de artigos de escritório e de papelaria"; vergalhão → "comércio atacadista de materiais de construção"; luva de segurança → "comércio atacadista de equipamentos de proteção". Para serviços, null.
- activityDescription de PRODUTO: use "comércio atacadista de <categoria>" quando a pessoa quer comprar o item; use "fabricação de <produto>" só se ela pedir fabricação, indústria, fabricante ou item sob encomenda.

Exemplos:
- "caneta 5b em natal rn"
  → {"activityDescription":"comércio atacadista de artigos de papelaria","commerceDescription":"comércio atacadista de artigos de escritório e de papelaria","scope":"city","cities":["Natal"],"states":["RN"]}
- "Quero fornecedores de embalagens flexíveis no Nordeste"
  → {"activityDescription":"fabricação de embalagens flexíveis","scope":"regional","states":["AL","BA","CE","MA","PB","PE","PI","RN","SE"]}
- "Indústrias têxteis em SP e MG"
  → {"activityDescription":"indústria têxtil","scope":"state","states":["SP","MG"]}
- "Transportadoras"
  → {"activityDescription":"transporte rodoviário de carga","scope":"national"}
- "Consultorias de TI em Belo Horizonte"
  → {"activityDescription":"consultoria em tecnologia da informação","scope":"city","cities":["Belo Horizonte"],"states":["MG"]}`;

const PICK_SYSTEM_PROMPT = `Você escolhe o melhor CNAE para uma atividade econômica, dada uma lista de candidatos.

Responda SEMPRE com JSON estrito. Não adicione texto fora do JSON.

Campos:
- cnaeCode: string com o código do CNAE escolhido, OU null se nenhum candidato representa bem a atividade.
- confidence: 0..1. Acima de 0.7 se for óbvio; entre 0.4 e 0.7 se for razoável; abaixo se forçar.
- rationale: 1 frase curta em PT-BR explicando a escolha.

Regras:
- Prefira CNAE específico (sub-classe) sobre genérico (divisão).
- Se a atividade pede "fabricação", "indústria" ou "fabricante", priorize CNAEs de indústria, NÃO comércio.
- Se a pessoa quer COMPRAR um produto pronto (material de escritório, EPI, material de construção, peças, alimentos...), prefira o COMÉRCIO ATACADISTA da categoria — é quem vende para empresas em qualquer cidade. Fabricante quase nunca existe na cidade pedida e a busca volta vazia.
- alternatives: até 4 códigos de candidatos que também servem, do mais útil para o menos. Quando escolher um comércio atacadista, a 1ª alternativa deve ser o comércio VAREJISTA da mesma categoria (se estiver entre os candidatos) e a fabricação do produto vem depois. Nunca repita o cnaeCode escolhido nem indique atividades sem relação com o pedido.
- Os "Exemplos" de cada candidato são atividades REAIS classificadas naquele CNAE. Quando um exemplo descreve a atividade pedida, esse candidato ganha — mesmo que o NOME do CNAE pareça distante. O nome é jurídico; o exemplo é o que a empresa faz.
- Se nenhum candidato encaixa bem, retorne cnaeCode=null e confidence=0.`;

async function extractActivity(
  query: string,
): Promise<z.infer<typeof ExtractSchema> | null> {
  const ai = getOpenAI();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EXTRACT_TIMEOUT_MS);
  try {
    const res = await ai.chat.completions.create(
      {
        model: getOpenAIModel(),
        messages: [
          { role: 'system', content: EXTRACT_SYSTEM_PROMPT },
          { role: 'user', content: `Texto:\n${query}` },
        ],
        response_format: { type: 'json_object' },
        max_completion_tokens: 256,
      },
      { signal: controller.signal },
    );
    const text = res.choices[0]?.message?.content ?? '';
    const parsed = ExtractSchema.parse(JSON.parse(text));
    void recordApiUsage({
      provider: 'openai',
      operation: 'suppliers-classify-cnae',
      model: getOpenAIModel(),
      tokensIn: res.usage?.prompt_tokens ?? 0,
      tokensOut: res.usage?.completion_tokens ?? 0,
      tokensCached: res.usage?.prompt_tokens_details?.cached_tokens ?? 0,
      metadata: { step: 'extract' },
    });
    return parsed;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[suppliers/cnae-classifier] extract failed:', msg);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Palavras de negócio que aparecem em dezenas de CNAEs e afogam o termo que
// realmente identifica a atividade. Testado ao vivo em 24/09/2026: "locação
// de caçambas de entulho" trazia só CNAEs de aluguel — o correto (coleta de
// resíduos) nem entrava na lista, porque "caçamba"/"entulho" perdiam para
// "locação". NÃO removemos essas palavras da busca principal (quem procura
// "locação de andaimes" quer mesmo locação); fazemos uma SEGUNDA busca sem
// elas e unimos as duas listas.
const PALAVRAS_GENERICAS = new Set([
  'locacao', 'locação', 'aluguel', 'alugar', 'leasing',
  'fornecimento', 'fornecedor', 'fornecedores', 'fornecer',
  'servico', 'serviço', 'servicos', 'serviços', 'prestacao', 'prestação',
  'prestador', 'prestadores', 'venda', 'vendas', 'comercio', 'comércio',
  'empresa', 'empresas', 'contratacao', 'contratação', 'terceirizacao',
  'terceirização', 'compra', 'de', 'da', 'do', 'para', 'com', 'em', 'e',
]);

/** Só os termos que identificam a atividade. Vazio quando a frase inteira é
 *  genérica — aí não vale fazer a segunda busca. */
export function termosDistintivos(descricao: string): string {
  const palavras = descricao
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((p) => p.length > 2 && !PALAVRAS_GENERICAS.has(p));

  return palavras.join(' ');
}

async function retrieveCandidates(
  activityDescription: string,
  commerceDescription?: string | null,
): Promise<CnaeAlternative[]> {
  const distintivos = termosDistintivos(activityDescription);
  // Pedido de produto: só os termos que identificam a CATEGORIA ("artigos
  // escritório papelaria"), buscados apenas entre atacado (46) e varejo (47).
  // A frase inteira ("comércio atacadista de ...") se diluía: "comércio" e
  // "equipamentos" casam com dezenas de CNAEs e a categoria certa sumia.
  const categoria = commerceDescription
    ? termosDistintivos(commerceDescription.replace(/\b(atacadista|varejista)\b/gi, ' '))
    : '';

  const [principal, focada, comercio] = await Promise.all([
    buscarCandidatos(activityDescription),
    // Segunda passada só com o que distingue a atividade.
    distintivos && distintivos !== activityDescription.toLowerCase()
      ? buscarCandidatos(distintivos)
      : Promise.resolve([]),
    categoria ? buscarCandidatos(categoria, ['46', '47']) : Promise.resolve([]),
  ]);

  // União preservando ordem: a busca principal manda; o comércio da
  // categoria vem logo depois, e a focada completa. O LLM decide.
  const vistos = new Set<string>();
  const unidos: CnaeAlternative[] = [];
  for (const c of [...principal, ...comercio.slice(0, 8), ...focada]) {
    if (vistos.has(c.code)) continue;
    vistos.add(c.code);
    unidos.push(c);
  }
  return unidos.slice(0, 18);
}

async function buscarCandidatos(
  activityDescription: string,
  /** Restringe a divisões da CNAE (2 primeiros dígitos), ex.: ['46','47'] = comércio. */
  divisoes?: string[],
): Promise<CnaeAlternative[]> {
  try {
    const sql = getReceitaSql();
    // Conversão AND → OR: `plainto_tsquery` constroi `palavra1 & palavra2`,
    // que pode retornar 0 resultados se um termo (ex: "flexíveis") não
    // existir nos CNAEs. O regexp_replace troca por OR — qualquer palavra
    // basta pra entrar no rank; `ts_rank` com `setweight` (denominacao=A,
    // exemplos=B, notas=C) prioriza match no nome canônico do CNAE.
    const rows = await sql<
      Array<{
        codigo: string;
        denominacao: string;
        exemplos: string | null;
        score: number;
        exato: number;
      }>
    >`
      with q as (
        select
          -- AND: todos os termos. Casa pouco, mas com PRECISÃO alta — é o
          -- que separa "caçamba de entulho" (coleta de resíduos) de
          -- qualquer CNAE que só tenha a palavra genérica "locação".
          plainto_tsquery('portuguese', ${activityDescription}) as tsq_and,
          -- OR: qualquer termo. Garante recall quando uma palavra do
          -- usuário não existe em CNAE nenhum.
          to_tsquery(
            'portuguese',
            regexp_replace(plainto_tsquery('portuguese', ${activityDescription})::text, ' & ', ' | ', 'g')
          ) as tsq_or
      ),
      doc as (
        select cnae.codigo,
               cnae.denominacao,
               cnae.exemplos_atividades,
               setweight(to_tsvector('portuguese', cnae.denominacao), 'A') ||
               setweight(to_tsvector('portuguese', coalesce(cnae.exemplos_atividades, '')), 'B') ||
               setweight(to_tsvector('portuguese', coalesce(cnae.notas_explicativas, '')), 'C') as tsv
        from cnae_taxonomy cnae
      )
      select doc.codigo,
             doc.denominacao,
             left(coalesce(doc.exemplos_atividades, ''), 400) as exemplos,
             ts_rank(doc.tsv, q.tsq_or)::float as score,
             (case when q.tsq_and is not null and doc.tsv @@ q.tsq_and then 1 else 0 end) as exato
      from doc, q
      where q.tsq_or is not null and doc.tsv @@ q.tsq_or
        and (${divisoes ?? null}::text[] is null or left(doc.codigo, 2) = any(${divisoes ?? null}::text[]))
      -- Quem casa com TODOS os termos vem primeiro, sempre.
      order by exato desc, score desc
      limit 12
    `;
    return rows.map((r) => ({
      code: r.codigo,
      name: r.denominacao,
      score: Number(r.score),
      examples: r.exemplos?.trim() || undefined,
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[suppliers/cnae-classifier] FTS retrieve failed:', msg);
    return [];
  }
}

async function pickCnae(
  activityDescription: string,
  candidates: CnaeAlternative[],
): Promise<z.infer<typeof PickSchema> | null> {
  if (candidates.length === 0) return null;

  const ai = getOpenAI();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PICK_TIMEOUT_MS);

  // Os EXEMPLOS DE ATIVIDADE são o que desempata na prática: o nome oficial
  // do CNAE é jurídico e genérico ("Locação de outros meios de transporte"),
  // enquanto os exemplos trazem o vocabulário real do comprador ("caçamba
  // para entulho"). Testado em 24/09/2026: sem exemplos o modelo erra
  // "locação de caçambas de entulho"; com exemplos acerta (3811-4/00).
  const candidatesText = candidates
    .map((c, i) => {
      const linha = `${i + 1}. ${c.code} — ${c.name}`;
      return c.examples ? `${linha}\n   Exemplos: ${c.examples}` : linha;
    })
    .join('\n');

  try {
    const res = await ai.chat.completions.create(
      {
        model: getOpenAIModel(),
        messages: [
          { role: 'system', content: PICK_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Atividade desejada: ${activityDescription}\n\nCandidatos:\n${candidatesText}`,
          },
        ],
        response_format: { type: 'json_object' },
        max_completion_tokens: 256,
      },
      { signal: controller.signal },
    );
    const text = res.choices[0]?.message?.content ?? '';
    const parsed = PickSchema.parse(JSON.parse(text));
    void recordApiUsage({
      provider: 'openai',
      operation: 'suppliers-classify-cnae',
      model: getOpenAIModel(),
      tokensIn: res.usage?.prompt_tokens ?? 0,
      tokensOut: res.usage?.completion_tokens ?? 0,
      tokensCached: res.usage?.prompt_tokens_details?.cached_tokens ?? 0,
      metadata: { step: 'pick' },
    });
    return parsed;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[suppliers/cnae-classifier] pick failed:', msg);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function classifyCnae(query: string): Promise<ClassifyResponse> {
  const extracted = await extractActivity(query);
  if (!extracted) {
    return {
      cnaeCode: null,
      cnaeName: null,
      scope: 'national',
      confidence: 0,
      rationale: 'Não consegui interpretar a atividade. Tente reformular ou buscar o CNAE manualmente.',
      alternatives: [],
    };
  }

  const candidates = await retrieveCandidates(
    extracted.activityDescription,
    extracted.commerceDescription,
  );
  if (candidates.length === 0) {
    return {
      cnaeCode: null,
      cnaeName: null,
      scope: extracted.scope,
      states: normalizeUfs(extracted.states),
      cities: extracted.cities,
      confidence: 0,
      rationale: 'Não encontrei CNAEs relacionados. Busque manualmente.',
      alternatives: [],
    };
  }

  // FTS retornou ≥1 candidato — vale a pena chamar o LLM pra escolher.
  // Se nenhum encaixar, o pick LLM retorna cnaeCode=null e a UI cai
  // em modo manual mostrando as alternativas como sugestões.
  const picked = await pickCnae(extracted.activityDescription, candidates);
  if (!picked || !picked.cnaeCode) {
    return {
      cnaeCode: null,
      cnaeName: null,
      scope: extracted.scope,
      states: normalizeUfs(extracted.states),
      cities: extracted.cities,
      confidence: 0,
      rationale: picked?.rationale ?? 'Nenhum candidato encaixa bem.',
      alternatives: candidates.slice(0, 4),
    };
  }

  const chosen =
    candidates.find((c) => c.code === picked.cnaeCode) ?? candidates[0]!;
  // Alternativas: primeiro as que o LLM indicou (válidas e sem repetir a
  // escolhida), depois completa com a ordem da busca.
  const indicadas = (picked.alternatives ?? [])
    .map((code) => candidates.find((c) => c.code === code))
    .filter((c): c is CnaeAlternative => !!c && c.code !== chosen.code);
  const vistas = new Set(indicadas.map((c) => c.code));
  const alternatives = [
    ...indicadas,
    ...candidates.filter((c) => c.code !== chosen.code && !vistas.has(c.code)),
  ].slice(0, 4);

  return {
    cnaeCode: chosen.code,
    cnaeName: chosen.name,
    cnaeExamples: chosen.examples,
    scope: extracted.scope,
    states: normalizeUfs(extracted.states),
    cities: extracted.cities,
    confidence: picked.confidence,
    rationale: picked.rationale,
    alternatives,
  };
}

function normalizeUfs(states: string[] | undefined): typeof UF_LIST[number][] | undefined {
  if (!states) return undefined;
  const valid = new Set<string>(UF_LIST);
  const filtered = states
    .map((s) => s.trim().toUpperCase())
    .filter((s) => valid.has(s)) as typeof UF_LIST[number][];
  return filtered.length > 0 ? filtered : undefined;
}

export { REGIONS_PT };
