import { z } from 'zod';
import { getServerSupabase } from '@/lib/db/supabase';
import { getOpenAI, getOpenAIModel } from '@/lib/llm/openai';
import { recordApiUsage } from '@/lib/observability/api-usage';
import {
  extrairFornecedoresWeb,
  juntarFornecedoresWeb,
  semDuplicados,
  type EquipeBuscaAmpliada,
  type FornecedorVendorList,
  type FornecedorWeb,
} from './busca-ampliada';

// Parte com rede/DB da busca ampliada (sub-projeto 73). Tudo fail-soft: se a
// IA ou a busca na web falharem, a tela mostra o que conseguiu.

const LIMITE_LINHAS = 5_000;
const CATEGORIAS_TIMEOUT_MS = 12_000;
const WEB_TIMEOUT_MS = 45_000;

/**
 * Vendor list da EQUIPE: fornecedores salvos por qualquer pessoa liberada.
 * Service-role porque a RLS de `suppliers` é owner-only — o filtro por
 * user_id da equipe é que segura o isolamento.
 */
export async function carregarVendorListDaEquipe(
  equipe: EquipeBuscaAmpliada,
): Promise<FornecedorVendorList[]> {
  const sb = getServerSupabase();
  const { data: perfis, error: errPerfis } = await sb
    .from('profiles_with_email')
    .select('id, email')
    .in('email', [...equipe.emails]);
  if (errPerfis) throw new Error(`perfis da equipe: ${errPerfis.message}`);
  const ids = (perfis ?? []).map((p) => (p as { id: string }).id);
  if (ids.length === 0) return [];

  const { data, error } = await sb
    .from('suppliers')
    .select('razao_social, nome_fantasia, cnpj, categoria, municipio, uf, telefone, email, notas, status')
    .in('user_id', ids)
    .neq('status', 'descartado')
    .limit(LIMITE_LINHAS);
  if (error) throw new Error(`vendor list: ${error.message}`);

  type Row = {
    razao_social: string;
    nome_fantasia: string | null;
    cnpj: string | null;
    categoria: string | null;
    municipio: string | null;
    uf: string | null;
    telefone: string | null;
    email: string | null;
    notas: string | null;
  };
  return semDuplicados(
    ((data ?? []) as Row[]).map((r) => ({
      razaoSocial: r.razao_social,
      nomeFantasia: r.nome_fantasia,
      cnpj: r.cnpj,
      categoria: r.categoria,
      municipio: r.municipio,
      uf: r.uf,
      telefone: r.telefone,
      email: r.email,
      notas: r.notas,
    })),
  );
}

const CategoriasSchema = z.object({ categorias: z.array(z.string()) });

const CATEGORIAS_SYSTEM = `Você ajuda um comprador a achar fornecedores na própria planilha de fornecedores (vendor list).
Recebe o PEDIDO e a lista de CATEGORIAS da planilha (grupos de materiais/serviços).
Devolva SÓ as categorias cujos fornecedores claramente vendem ou prestam exatamente o que foi pedido — no máximo 3, da mais para a menos provável.
Considere sinônimos e o grupo do item (ex.: "vergalhão" → AÇO; "andaime" → a categoria de andaimes).
Seja restritivo: categoria genérica que só talvez tenha o item (EQUIPAMENTOS, MÃO DE OBRA, INSTALAÇÕES) não entra, a menos que o pedido seja exatamente isso. Pedido de material não casa com categoria de serviço, nem o contrário.
Se a planilha não tem categoria para o pedido (ex.: pedir caneta numa lista de obra), devolva lista vazia — é melhor do que indicar fornecedor errado.
Use EXATAMENTE a grafia da lista.
Responda só JSON: {"categorias": ["..."]}`;

/** IA escolhe, entre as categorias da planilha, as que atendem o pedido. Falhou → []. */
export async function escolherCategorias(consulta: string, categorias: readonly string[]): Promise<string[]> {
  if (categorias.length === 0) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CATEGORIAS_TIMEOUT_MS);
  try {
    const ai = getOpenAI();
    const model = getOpenAIModel();
    const res = await ai.chat.completions.create(
      {
        model,
        messages: [
          { role: 'system', content: CATEGORIAS_SYSTEM },
          {
            role: 'user',
            content: `PEDIDO: ${consulta}\n\nCATEGORIAS:\n${categorias.slice(0, 400).join('\n')}`,
          },
        ],
        response_format: { type: 'json_object' },
        max_completion_tokens: 200,
      },
      { signal: controller.signal },
    );
    void recordApiUsage({
      provider: 'openai',
      operation: 'suppliers-busca-ampliada-categorias',
      model,
      tokensIn: res.usage?.prompt_tokens ?? 0,
      tokensOut: res.usage?.completion_tokens ?? 0,
      tokensCached: res.usage?.prompt_tokens_details?.cached_tokens ?? 0,
    });
    const parsed = CategoriasSchema.parse(JSON.parse(res.choices[0]?.message?.content ?? '{}'));
    // Só aceita o que existe na planilha — a IA não inventa categoria.
    const validas = new Set(categorias);
    return parsed.categorias.filter((c) => validas.has(c)).slice(0, 3);
  } catch (err) {
    console.warn('[busca-ampliada] escolherCategorias falhou:', err instanceof Error ? err.message : err);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

// Duas buscas em paralelo (pedido de cliente 2026-10-07: "quero a busca igual
// ao ChatGPT, lá vem tudo"): a LOCAL, priorizando a cidade do pedido, e a
// AMPLA, com distribuidores, atacadistas, fabricantes e lojas B2B que atendem
// a região ou o Brasil. O resultado junta as duas sem repetir empresa.
type Angulo = 'local' | 'amplo';

function promptWeb(consulta: string, angulo: Angulo): string {
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const foco =
    angulo === 'local'
      ? 'Priorize empresas da cidade e do estado citados no pedido (lojas, revendas, distribuidores locais); se houver poucas, inclua as cidades vizinhas.'
      : 'Agora pense amplo, como um comprador experiente: distribuidores, atacadistas, fabricantes que vendem direto e lojas B2B online que ENTREGAM na região do pedido ou no Brasil todo. Varie as buscas (nome do item, sinônimos, a categoria do material) e prefira empresas diferentes das óbvias.';
  return `Hoje é ${hoje}. Um comprador de uma construtora brasileira precisa comprar: "${consulta}".
Pesquise na internet EMPRESAS QUE VENDEM esse item. ${foco}
Não liste marketplaces genéricos (Mercado Livre, Amazon, Shopee) a menos que não exista nenhuma outra opção.
Não invente empresas, telefones nem sites: inclua só o que encontrou nas páginas.
Responda SOMENTE com um array JSON (sem texto antes ou depois), até 15 itens, no formato:
[{"nome":"...","site":"https://...","telefone":"...","cidade":"...","uf":"RN","oQueVende":"resumo curto do que a empresa vende"}]
Campo que não encontrou: null.`;
}

export type ResultadoWeb = {
  fornecedores: FornecedorWeb[];
  /** Texto livre quando o modelo não devolveu a lista no formato pedido. */
  texto: string | null;
  erro: string | null;
};

export async function buscarFornecedoresNaWeb(consulta: string): Promise<ResultadoWeb> {
  const [local, amplo] = await Promise.all([buscarAngulo(consulta, 'local'), buscarAngulo(consulta, 'amplo')]);
  const fornecedores = juntarFornecedoresWeb([local.fornecedores, amplo.fornecedores], 20);
  if (fornecedores.length > 0) return { fornecedores, texto: null, erro: null };
  return { fornecedores: [], texto: local.texto ?? amplo.texto, erro: local.erro && amplo.erro ? local.erro : null };
}

async function buscarAngulo(consulta: string, angulo: Angulo): Promise<ResultadoWeb> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEB_TIMEOUT_MS);
  try {
    const ai = getOpenAI();
    const model = getOpenAIModel('routing');
    const res = await ai.responses.create(
      { model, store: false, tools: [{ type: 'web_search', search_context_size: 'high' } as never], input: promptWeb(consulta, angulo) },
      { signal: controller.signal },
    );
    const out = res as { output_text?: string; usage?: { input_tokens?: number; output_tokens?: number } };
    void recordApiUsage({
      provider: 'openai',
      operation: 'suppliers-busca-ampliada-web',
      model,
      tokensIn: out.usage?.input_tokens ?? 0,
      tokensOut: out.usage?.output_tokens ?? 0,
      metadata: { web_search: true, angulo },
    });
    const texto = (out.output_text ?? '').trim();
    const fornecedores = extrairFornecedoresWeb(texto);
    return { fornecedores, texto: fornecedores.length ? null : texto || null, erro: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[busca-ampliada] web falhou:', msg);
    return { fornecedores: [], texto: null, erro: 'A busca na internet não respondeu agora. Tente de novo em instantes.' };
  } finally {
    clearTimeout(timer);
  }
}
