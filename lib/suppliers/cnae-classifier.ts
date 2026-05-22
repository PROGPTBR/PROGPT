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
  scope: z.enum(SCOPE_VALUES),
  states: z.array(z.string()).optional(),
  cities: z.array(z.string()).optional(),
});

const PickSchema = z.object({
  cnaeCode: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
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

Exemplos:
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
- Se a atividade pede "fabricação", priorize CNAEs de indústria, NÃO comércio.
- Se a atividade pede "fornecedor de X", e há ambos fabricante e comércio, prefira FABRICAÇÃO (B2B típico de procurement).
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

async function retrieveCandidates(
  activityDescription: string,
): Promise<CnaeAlternative[]> {
  try {
    const sql = getReceitaSql();
    // Conversão AND → OR: `plainto_tsquery` constroi `palavra1 & palavra2`,
    // que pode retornar 0 resultados se um termo (ex: "flexíveis") não
    // existir nos CNAEs. O regexp_replace troca por OR — qualquer palavra
    // basta pra entrar no rank; `ts_rank` com `setweight` (denominacao=A,
    // exemplos=B, notas=C) prioriza match no nome canônico do CNAE.
    const rows = await sql<
      Array<{ codigo: string; denominacao: string; score: number }>
    >`
      with q as (
        select to_tsquery(
          'portuguese',
          regexp_replace(plainto_tsquery('portuguese', ${activityDescription})::text, ' & ', ' | ', 'g')
        ) as tsq
      )
      select cnae.codigo,
             cnae.denominacao,
             ts_rank(
               setweight(to_tsvector('portuguese', cnae.denominacao), 'A') ||
               setweight(to_tsvector('portuguese', coalesce(cnae.exemplos_atividades, '')), 'B') ||
               setweight(to_tsvector('portuguese', coalesce(cnae.notas_explicativas, '')), 'C'),
               q.tsq
             )::float as score
      from cnae_taxonomy cnae, q
      where q.tsq is not null and q.tsq @@ (
        to_tsvector('portuguese', cnae.denominacao) ||
        to_tsvector('portuguese', coalesce(cnae.exemplos_atividades, '')) ||
        to_tsvector('portuguese', coalesce(cnae.notas_explicativas, ''))
      )
      order by score desc
      limit 10
    `;
    return rows.map((r) => ({
      code: r.codigo,
      name: r.denominacao,
      score: Number(r.score),
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

  const candidatesText = candidates
    .map((c, i) => `${i + 1}. ${c.code} — ${c.name}`)
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

  const candidates = await retrieveCandidates(extracted.activityDescription);
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
  const alternatives = candidates
    .filter((c) => c.code !== chosen.code)
    .slice(0, 4);

  return {
    cnaeCode: chosen.code,
    cnaeName: chosen.name,
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
