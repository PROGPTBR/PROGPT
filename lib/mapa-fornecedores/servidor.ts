import { generateObject, streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { requireEnv } from '@/lib/env';
import { getOpenAI, getOpenAIModel } from '@/lib/llm/openai';
import { recordApiUsage } from '@/lib/observability/api-usage';
import { siteSeguro } from '@/lib/suppliers/busca-ampliada';
import {
  NIVEL_LABEL,
  PlanoSchema,
  totalSeguro,
  type CategoriaPlano,
  type FornecedorMapa,
  type Plano,
} from './tipos';

// Partes com rede do Mapa de Fornecedores. Tudo fail-soft: categoria cuja
// busca falha volta vazia, endereço que não localiza fica fora do mapa (mas na
// lista), e o relatório sai mesmo com resultado parcial.

const hoje = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

// ─── 1. Plano: categorias de compra da operação ─────────────────────────────

const PLANO_SYSTEM = `Você é um comprador sênior brasileiro, com 20 anos em suprimentos, montando o mapa de fornecedores de uma empresa.
A partir do pedido do usuário, identifique a empresa, o setor e a região, e liste de 8 a 12 CATEGORIAS DE COMPRA que essa operação realmente tem, específicas do setor (não genéricas), cobrindo CAPEX e OPEX.

Para cada categoria:
- nome: curto (ex.: "Equipamentos de transmissão e broadcast", "Nobreaks e energia").
- tipo: CAPEX (investimento, ativo) ou OPEX (consumo, serviço recorrente).
- criticidade: impacto na operação se faltar (alta, media, baixa).
- concorrencia: quantos fornecedores o mercado tem para isso na região (baixa = poucos e especializados).
- termoBusca: o que pesquisar na internet para achar fornecedores dessa categoria na região (ex.: "nobreak manutenção Curitiba").
- porque: uma frase sobre por que essa categoria importa para ESTA empresa.

Campos gerais:
- empresa, setor: como o usuário descreveu.
- cidade, uf: região pedida (se não houver, a sede da empresa).
- totalFornecedores: o número de fornecedores pedido (se não houver, 50).
- leitura: 2 a 3 frases sobre o perfil de compras dessa operação.
Não use travessão.`;

export async function planejar(pedido: string): Promise<Plano> {
  const openai = createOpenAI({ apiKey: requireEnv('OPENAI_API_KEY') });
  const model = getOpenAIModel('generation');
  const out = await generateObject({
    model: openai(model),
    system: PLANO_SYSTEM,
    schema: PlanoSchema,
    messages: [{ role: 'user', content: pedido.slice(0, 8000) }],
  });
  void recordApiUsage({
    provider: 'openai',
    operation: 'mapa-fornecedores-plano',
    model,
    tokensIn: out.usage.promptTokens,
    tokensOut: out.usage.completionTokens,
    callCount: 1,
  });
  const p = out.object;
  return {
    ...p,
    uf: p.uf.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase(),
    totalFornecedores: totalSeguro(p.totalFornecedores),
    categorias: p.categorias.slice(0, 12),
  };
}

// ─── 2. Busca na internet, uma por categoria ────────────────────────────────

const WEB_TIMEOUT_MS = 60_000;

function promptCategoria(plano: Plano, c: CategoriaPlano, quantos: number): string {
  return `Hoje é ${hoje()}. O time de compras de ${plano.empresa} (${plano.setor}), em ${plano.cidade}/${plano.uf}, precisa de fornecedores de: ${c.nome} (${c.tipo}).
Pesquise na internet EMPRESAS que fornecem isso e atendem ${plano.cidade} e região: primeiro as da cidade e região metropolitana, depois as do estado; só complete com empresas de fora se houver poucas. Sugestão de busca: "${c.termoBusca}".
Prefira fornecedores B2B que atendem empresas (não lojas para consumidor final). Não liste marketplaces genéricos.
Não invente empresas, endereços, telefones nem sites: inclua só o que encontrou nas páginas.
Responda SOMENTE com um array JSON (sem texto antes ou depois), até ${quantos} itens:
[{"nome":"razão social ou nome fantasia","site":"endereço do site","telefone":"telefone com DDD","endereco":"logradouro e número como aparece no site","bairro":"bairro","cep":"CEP","cidade":"cidade","uf":"sigla do estado","oQueVende":"resumo curto"}]
Campo que não encontrou: null. Nunca preencha endereço ou CEP com valor de exemplo.`;
}

const str = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t && !/^(n\/?a|null|-|não informado|nao informado)$/i.test(t) ? t.slice(0, 300) : null;
};

/** Tira o array JSON da resposta (mesmo cercado de texto ou ```json). */
export function lerFornecedores(texto: string, categoria: string): FornecedorMapa[] {
  const ini = texto.indexOf('[');
  const fim = texto.lastIndexOf(']');
  if (ini < 0 || fim <= ini) return [];
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto.slice(ini, fim + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(bruto)) return [];
  const out: FornecedorMapa[] = [];
  for (const item of bruto) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const nome = str(o.nome);
    if (!nome) continue;
    const uf = str(o.uf);
    const cep = (str(o.cep) ?? '').replace(/\D/g, '');
    let endereco = str(o.endereco);
    // Valor de exemplo copiado do pedido ("Rua X, 123", "logradouro e número").
    if (endereco && (/^(rua|r\.|av\.?|avenida)\s+x\b/i.test(endereco) || /logradouro/i.test(endereco))) endereco = null;
    // CEP genérico de cidade (xx000-000) ou de exemplo não localiza nada.
    const cepValido = cep.length === 8 && !/^\d{2}000000$/.test(cep) && !/^0+$/.test(cep);
    out.push({
      id: '',
      nome,
      categoria,
      site: siteSeguro(str(o.site)),
      telefone: str(o.telefone),
      endereco,
      bairro: str(o.bairro),
      cep: cepValido ? `${cep.slice(0, 5)}-${cep.slice(5)}` : null,
      cidade: str(o.cidade),
      uf: uf && /^[A-Za-z]{2}$/.test(uf) ? uf.toUpperCase() : null,
      oQueVende: str(o.oQueVende),
      lat: null,
      lng: null,
      precisao: null,
    });
  }
  return out;
}

export async function buscarCategoria(plano: Plano, c: CategoriaPlano, quantos: number): Promise<FornecedorMapa[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEB_TIMEOUT_MS);
  try {
    const model = getOpenAIModel('routing');
    const res = await getOpenAI().responses.create(
      {
        model,
        store: false,
        tools: [{ type: 'web_search', search_context_size: 'medium' } as never],
        input: promptCategoria(plano, c, quantos),
      },
      { signal: controller.signal },
    );
    const out = res as { output_text?: string; usage?: { input_tokens?: number; output_tokens?: number } };
    void recordApiUsage({
      provider: 'openai',
      operation: 'mapa-fornecedores-web',
      model,
      tokensIn: out.usage?.input_tokens ?? 0,
      tokensOut: out.usage?.output_tokens ?? 0,
      metadata: { web_search: true, categoria: c.nome },
    });
    return lerFornecedores(out.output_text ?? '', c.nome).slice(0, quantos);
  } catch (err) {
    console.warn('[mapa-fornecedores] busca falhou:', c.nome, err instanceof Error ? err.message : err);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** Roda tarefas com no máximo N ao mesmo tempo, avisando cada uma que termina. */
export async function emParalelo<T, R>(
  itens: readonly T[],
  simultaneos: number,
  fazer: (item: T, i: number) => Promise<R>,
  aoTerminar?: (r: R, i: number) => void,
): Promise<R[]> {
  const out: R[] = new Array(itens.length);
  let proximo = 0;
  await Promise.all(
    Array.from({ length: Math.min(simultaneos, itens.length) }, async () => {
      while (proximo < itens.length) {
        const i = proximo++;
        out[i] = await fazer(itens[i]!, i);
        aoTerminar?.(out[i]!, i);
      }
    }),
  );
  return out;
}

// ─── 3. Localização no mapa ─────────────────────────────────────────────────
//
// 1º CEP na BrasilAPI (rápido, sem chave). 2º endereço no Nominatim
// (OpenStreetMap), respeitando 1 pedido por segundo e um teto de tempo.
// 3º centro da cidade, marcado como aproximado. Cache em memória: o processo
// do Railway é long-lived.

const cache = new Map<string, { lat: number; lng: number } | null>();
const UA = 'PROGPT/1.0 (comercial@2bsupply.com.br)';

async function getJson(url: string, ms: number): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA }, signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function coord(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  const a = Number(lat);
  const b = Number(lng);
  // Dentro do Brasil (com folga), para não plotar coordenada absurda.
  if (!Number.isFinite(a) || !Number.isFinite(b) || a < -34.5 || a > 6 || b < -74.5 || b > -28) return null;
  return { lat: a, lng: b };
}

async function porCep(cep: string): Promise<{ lat: number; lng: number } | null> {
  const k = `cep:${cep}`;
  if (cache.has(k)) return cache.get(k)!;
  try {
    const d = (await getJson(`https://brasilapi.com.br/api/cep/v2/${cep.replace(/\D/g, '')}`, 6000)) as {
      location?: { coordinates?: { latitude?: unknown; longitude?: unknown } };
    };
    const c = coord(d.location?.coordinates?.latitude, d.location?.coordinates?.longitude);
    cache.set(k, c);
    return c;
  } catch {
    return null;
  }
}

let ultimoNominatim = 0;
async function porTexto(q: string): Promise<{ lat: number; lng: number } | null> {
  const k = `q:${q.toLowerCase()}`;
  if (cache.has(k)) return cache.get(k)!;
  const espera = ultimoNominatim + 1100 - Date.now();
  ultimoNominatim = Date.now() + Math.max(0, espera);
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  try {
    const d = (await getJson(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`,
      8000,
    )) as { lat?: string; lon?: string }[];
    const c = Array.isArray(d) && d[0] ? coord(d[0].lat, d[0].lon) : null;
    cache.set(k, c);
    return c;
  } catch {
    return null;
  }
}

/** Espalha pinos aproximados (mesma cidade) num círculo pequeno para não ficarem um em cima do outro. */
function espalhar(base: { lat: number; lng: number }, i: number): { lat: number; lng: number } {
  const ang = i * 2.399963; // ângulo áureo
  const r = 0.012 + 0.004 * Math.sqrt(i);
  return { lat: base.lat + r * Math.sin(ang), lng: base.lng + r * Math.cos(ang) };
}

export async function localizar(fornecedores: FornecedorMapa[], plano: Plano, tetoMs = 45_000): Promise<FornecedorMapa[]> {
  const fimEm = Date.now() + tetoMs;
  const out = fornecedores.map((f) => ({ ...f }));

  await emParalelo(out, 6, async (f) => {
    if (f.cep) {
      const c = await porCep(f.cep);
      if (c) Object.assign(f, c, { precisao: 'endereco' as const });
    }
  });

  // A BrasilAPI devolve o centro da cidade para CEP de logradouro genérico:
  // o mesmo ponto para CEPs diferentes. Esses voltam para a busca por endereço.
  const cepsPorPonto = new Map<string, Set<string>>();
  for (const f of out) {
    if (f.lat == null || !f.cep) continue;
    const k = `${f.lat.toFixed(4)},${f.lng!.toFixed(4)}`;
    cepsPorPonto.set(k, (cepsPorPonto.get(k) ?? new Set()).add(f.cep));
  }
  for (const f of out) {
    if (f.lat == null) continue;
    const k = `${f.lat.toFixed(4)},${f.lng!.toFixed(4)}`;
    if ((cepsPorPonto.get(k)?.size ?? 0) > 1) Object.assign(f, { lat: null, lng: null, precisao: null });
  }

  // Nominatim é serial (1 por segundo) e tem teto de tempo.
  for (const f of out) {
    if (f.lat != null || !f.endereco || Date.now() > fimEm) continue;
    const q = [f.endereco, f.bairro, f.cidade ?? plano.cidade, f.uf ?? plano.uf].filter(Boolean).join(', ');
    const c = await porTexto(q);
    if (c) Object.assign(f, c, { precisao: 'endereco' as const });
  }

  // Sem endereço localizado: centro da cidade, marcado como aproximado.
  const porCidade = new Map<string, number>();
  for (const f of out) {
    if (f.lat != null) continue;
    const cidade = f.cidade ?? plano.cidade;
    const uf = f.uf ?? plano.uf;
    if (!cidade || Date.now() > fimEm + 15_000) continue;
    const c = await porTexto(`${cidade}, ${uf}, Brasil`);
    if (!c) continue;
    const n = porCidade.get(cidade) ?? 0;
    porCidade.set(cidade, n + 1);
    Object.assign(f, espalhar(c, n), { precisao: 'cidade' as const });
  }

  // Dois fornecedores no mesmo ponto exato (mesmo prédio, ou Nominatim caiu na
  // rua): afasta um pouco para os pinos não ficarem um em cima do outro.
  const vistos = new Map<string, number>();
  for (const f of out) {
    if (f.lat == null || f.precisao !== 'endereco') continue;
    const k = `${f.lat.toFixed(4)},${f.lng!.toFixed(4)}`;
    const n = vistos.get(k) ?? 0;
    vistos.set(k, n + 1);
    if (n > 0) {
      const ang = n * 2.399963;
      f.lat += 0.0015 * Math.sin(ang);
      f.lng! += 0.0015 * Math.cos(ang);
    }
  }
  return out;
}

// ─── 4. Relatório ────────────────────────────────────────────────────────────

const RELATORIO_SYSTEM = `Você é um comprador sênior brasileiro orientando o time de suprimentos de uma empresa. Recebe o plano de categorias de compra e a lista de fornecedores REAIS encontrados na internet para a região. Escreva o relatório em markdown, em português, sem travessão, sem preâmbulo, com estas seções:

## Leitura da operação
2 a 3 frases sobre o perfil de compras (CAPEX x OPEX, o que é crítico).

## Categorias e fornecedores encontrados
Tabela: Categoria | Tipo | Criticidade | Concorrência | Fornecedores encontrados (nomes, separados por vírgula).

## Quem acionar primeiro
8 a 12 fornecedores da lista, em ordem, com uma frase de motivo cada (categoria crítica, poucos concorrentes, atende a região). Use SÓ nomes da lista.

## Onde pedir mais cotações
Matriz: categorias com criticidade alta e concorrência baixa pedem mais cotações (mínimo 3 a 5), desenvolvimento de novos fornecedores e contrato com SLA; concorrência alta permite leilão/negociação por preço. Dê o número de cotações recomendado por categoria.

## Próximos passos
3 a 5 ações: homologar os primeiros (situação na Receita, certidões), RFP das categorias críticas, consolidar a base de fornecedores.

Regras: não invente fornecedor, telefone ou dado que não esteja na lista; não cite fontes; termine dizendo que a lista vem de busca na internet e deve ser validada na homologação.`;

export function promptRelatorio(plano: Plano, fornecedores: FornecedorMapa[], pedido: string): string {
  const porCat = plano.categorias
    .map((c) => {
      const nomes = fornecedores.filter((f) => f.categoria === c.nome).map((f) => f.nome);
      return `- ${c.nome} | ${c.tipo} | criticidade ${NIVEL_LABEL[c.criticidade]} | concorrência ${NIVEL_LABEL[c.concorrencia]} | ${c.porque}\n  Encontrados (${nomes.length}): ${nomes.join(', ') || 'nenhum'}`;
    })
    .join('\n');
  return `Pedido do usuário:\n${pedido.slice(0, 3000)}\n\nEmpresa: ${plano.empresa} (${plano.setor}), região ${plano.cidade}/${plano.uf}.\nLeitura inicial: ${plano.leitura}\n\nCategorias e fornecedores:\n${porCat}\n\nTotal de fornecedores encontrados: ${fornecedores.length}.`;
}

export function streamRelatorio(plano: Plano, fornecedores: FornecedorMapa[], pedido: string) {
  const openai = createOpenAI({ apiKey: requireEnv('OPENAI_API_KEY') });
  const model = getOpenAIModel('generation');
  return streamText({
    model: openai(model),
    temperature: 0.4,
    system: RELATORIO_SYSTEM,
    messages: [{ role: 'user', content: promptRelatorio(plano, fornecedores, pedido) }],
    onFinish: ({ usage }) => {
      void recordApiUsage({
        provider: 'openai',
        operation: 'mapa-fornecedores-relatorio',
        model,
        tokensIn: usage.promptTokens,
        tokensOut: usage.completionTokens,
        callCount: 1,
      });
    },
  });
}
