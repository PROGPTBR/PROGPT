import type { PesquisaPrecosParams, TemplateRow } from './types';
import type { RetrievedChunk } from '@/lib/rag/types';
import type { CompanyData } from '@/lib/db/user-company';
import { splitTemplateBody, renderPlaceholders } from './template-assembly';
import {
  buscarCatmat,
  precoReferencia,
  type CatmatMatch,
  type PrecoReferencia,
} from '@/lib/govdata/precos';

// Sub-projeto 37 (fase 1) — Pesquisa de Preços / Mapa de Preços.
//
// Passo determinístico = para cada item informado, resolve o código CATMAT
// (lib/govdata/precos.buscarCatmat) e puxa os preços praticados nas compras
// públicas (precoReferencia), com estatística robusta. A narrativa LLM monta o
// "mapa de preços" (preço estimado + faixa + ressalvas) fundamentado na Lei
// 14.133/2021 (pesquisa de preços) e nas boas práticas da base. Fail-soft: itens
// que não mapearam ou sem amostra viram orientação de pesquisa manual.

export type ItemResultado = {
  descricao: string;
  unidade: string;
  quantidade?: number;
  match: CatmatMatch | null;
  preco: PrecoReferencia | null;
};

export type PesquisaPrecosClassified = {
  titulo: string;
  uf?: string;
  itens: ItemResultado[];
  anyAvailable: boolean; // ao menos 1 item com preço
};

/** Constrói o CatmatMatch a partir do item escolhido pelo usuário no catálogo
 *  (autocomplete). Confiança 1.0 — quem desambiguou foi o humano. */
function lockedMatch(item: PesquisaPrecosParams['itens'][number]): CatmatMatch | null {
  if (!item.codigoItem) return null;
  return {
    codigoItem: item.codigoItem,
    descricaoItem: item.descricaoItemCatalogo ?? item.descricao,
    codigoClasse: item.codigoClasse ?? 0,
    nomeClasse: item.nomeClasse ?? '',
    codigoPdm: item.codigoPdm ?? 0,
    nomePdm: item.nomePdm ?? '',
    confianca: 1,
    rationale: 'selecionado pelo usuário no catálogo do governo',
  };
}

export async function classifyPesquisaPrecos(
  params: PesquisaPrecosParams,
): Promise<PesquisaPrecosClassified> {
  const uf = params.uf?.toUpperCase();
  // Itens são independentes — resolve em paralelo (cap de 10 no schema).
  const itens = await Promise.all(
    params.itens.map(async (item): Promise<ItemResultado> => {
      // Se o usuário escolheu o item no catálogo (autocomplete), o código já vem
      // travado — pula o auto-resolve por LLM e usa direto (zero mismatch).
      const match = item.codigoItem
        ? lockedMatch(item)
        : await buscarCatmat(item.descricao);
      const preco = match ? await precoReferencia(match.codigoItem, { uf }) : null;
      return {
        descricao: item.descricao,
        unidade: item.unidade ?? '',
        quantidade: item.quantidade,
        match,
        preco,
      };
    }),
  );
  return {
    titulo: params.titulo,
    uf,
    itens,
    anyAvailable: itens.some((i) => i.preco?.stats != null),
  };
}

// ── Prompt builder ───────────────────────────────────────────────────────

export const PESQUISA_PRECOS_SYSTEM_PROMPT = `Você é um especialista sênior em pesquisa de preços e estimativa de custos em compras (procurement), com 20 anos de experiência. Sua tarefa é produzir um MAPA DE PREÇOS / RELATÓRIO DE PESQUISA DE PREÇOS em português brasileiro, fundamentado nos preços praticados em compras públicas (CATMAT / Painel de Preços do Governo Federal).

## Regras
1. **Os preços são INPUT (verdade de base), não output.** As estatísticas (mediana, faixa p25–p75, mín–máx, nº de amostras) JÁ vêm calculadas a partir de compras públicas reais. NÃO invente valores, NÃO recalcule, NÃO contradiga os números fornecidos.
2. **Use a MEDIANA como preço de referência** (não a média) — é robusta a outliers. Sempre apresente a faixa usual (p25–p75) ao lado, como banda de negociação.
3. **Sinalize a confiança**: poucas amostras (n < 10), dispersão alta (p75 bem acima de p25), ou heterogeneidade de unidade de fornecimento (ex.: preço por "kg" misturado com "pacote") reduzem a confiabilidade — diga isso explicitamente.
4. **Quando um item não mapeou no catálogo** ou ficou **sem amostras de preço**, NÃO invente — oriente pesquisa manual (Painel de Preços, cotação com 3 fornecedores, mídias especializadas) conforme a Lei 14.133/2021, art. 23.
5. **Estrutura do relatório** (markdown, headings claros, tabelas):
   - **Resumo executivo**: preço de referência por item e total estimado, em uma frase cada.
   - **Mapa de preços por item**: tabela com item, CATMAT correspondente, preço de referência (mediana), faixa (p25–p75), nº de amostras e confiança.
   - **Metodologia**: fonte (compras públicas / Painel de Preços), critério estatístico (mediana + IQR, descarte de outliers), recorte de UF se aplicável.
   - **Ressalvas e cuidados**: tributos/frete embutidos, unidade de fornecimento, sazonalidade, atualização monetária.
   - **Recomendação de negociação**: como usar a faixa como meta/teto e BATNA.
6. **Os preços de compras públicas geralmente incluem tributos e variam por unidade de fornecimento e região** — registre isso como ressalva metodológica.
7. **Profundidade sênior**: amarre cada recomendação a um número. Sem preâmbulo conversacional; comece pelo título. Markdown limpo, **bold** nos valores críticos.`;

const BRL = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function itemBlock(it: ItemResultado, idx: number): string {
  const head = `### Item ${idx + 1}: ${it.descricao}${
    it.quantidade ? ` — ${it.quantidade} ${it.unidade}`.trimEnd() : it.unidade ? ` (${it.unidade})` : ''
  }`;

  if (!it.match) {
    return `${head}

⚠️ Não foi possível mapear este item ao catálogo CATMAT do governo. Oriente pesquisa de preços manual (Painel de Preços, no mínimo 3 cotações de fornecedores, conforme Lei 14.133/2021 art. 23).`;
  }

  const m = it.match;
  const mapped = `- **CATMAT**: ${m.codigoItem} — ${m.descricaoItem}\n- **Classe/PDM**: ${m.nomeClasse} › ${m.nomePdm} (confiança do match: ${(m.confianca * 100).toFixed(0)}%)`;

  const stats = it.preco?.stats;
  if (!stats) {
    return `${head}

${mapped}

⚠️ Item mapeado, mas sem preços praticados recentes na base de compras públicas${
      it.preco && it.preco.totalAmostras === 0 ? '' : ' para o recorte aplicado'
    }. Oriente ampliar o período/UF ou cotar diretamente com fornecedores.`;
  }

  const unidadeAmostra = it.preco?.amostras[0]?.unidade || it.unidade || 'un';
  const totalEstimado =
    it.quantidade != null ? `\n- **Custo estimado (mediana × ${it.quantidade})**: R$ ${BRL(stats.mediana * it.quantidade)}` : '';

  const amostras = (it.preco?.amostras ?? [])
    .slice(0, 5)
    .map(
      (a) =>
        `  - R$ ${BRL(a.precoUnitario)} / ${a.unidade || unidadeAmostra} · ${a.uf || '—'} · ${a.dataCompra} · ${a.fornecedor.slice(0, 32) || '—'}`,
    )
    .join('\n');

  return `${head}

${mapped}
- **Preço de referência (mediana)**: R$ ${BRL(stats.mediana)} / ${unidadeAmostra}
- **Faixa usual (p25–p75)**: R$ ${BRL(stats.p25)} – R$ ${BRL(stats.p75)}
- **Mín–Máx**: R$ ${BRL(stats.min)} – R$ ${BRL(stats.max)}
- **Amostras**: ${stats.n} compras (de ${it.preco?.totalAmostras ?? stats.n} no total; ${stats.outliersRemovidos} outlier(s) descartado(s))${totalEstimado}
${amostras ? `- **Amostras recentes**:\n${amostras}` : ''}`;
}

function formatChunks(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return '(nenhum trecho relevante recuperado — fundamentar em princípios gerais de pesquisa de preços e estimativa de custos)';
  }
  return chunks
    .map((c) => `### Fonte: ${c.articleTitle}\n\n${c.content.slice(0, 800)}`)
    .join('\n\n---\n\n');
}

export function buildPesquisaPrecosPrompt(
  params: PesquisaPrecosParams,
  classified: PesquisaPrecosClassified,
  template: TemplateRow,
  chunks: RetrievedChunk[],
  company: CompanyData | null = null,
): { system: string; user: string } {
  const headerBlock = `## Pesquisa de preços
- **Título**: ${params.titulo}
${classified.uf ? `- **Recorte regional**: UF ${classified.uf}` : '- **Recorte regional**: Brasil (todas as UFs)'}
${params.notas ? `- **Notas do comprador**: ${params.notas}` : ''}`;

  const precosBlock = `## Preços praticados consultados (INPUT — verdade de base)

> Fonte: compras públicas do Governo Federal (catálogo CATMAT / módulo de Preços Praticados). Estatística robusta: mediana + IQR com descarte de outliers (1,5×).

${classified.itens.map(itemBlock).join('\n\n')}`;

  const companyBlock = company?.company_name
    ? `## Empresa compradora\n\n- **Empresa**: ${company.company_name}`
    : '';

  const { head } = splitTemplateBody(template.body_md);
  const renderedHead = renderPlaceholders(
    head,
    {
      client: company?.company_name ?? '',
      scope: params.titulo,
      category: 'Pesquisa de preços',
      deadline: '',
      budget: '',
      criteria: [],
      notes: params.notas ?? '',
    },
    company,
  );

  const templateBlock = `## Template a seguir (estrutura — apenas as seções customizáveis)

Nome do template: **${template.name}**
\`\`\`markdown
${renderedHead}
\`\`\``;

  const contextBlock = `## Contexto da base de conhecimento (use para fundamentar, NÃO cite)

${formatChunks(chunks)}`;

  const instruction = `## Tarefa

Gere agora o mapa de preços seguindo o template e as regras. Use as estatísticas como verdade de base e a mediana como preço de referência. Quando um item não mapeou ou ficou sem amostras, sinalize e oriente pesquisa manual. Registre as ressalvas metodológicas (tributos/frete embutidos, unidade de fornecimento, sazonalidade).`;

  return {
    system: PESQUISA_PRECOS_SYSTEM_PROMPT,
    user: [headerBlock, precosBlock, companyBlock, templateBlock, contextBlock, instruction]
      .filter(Boolean)
      .join('\n\n---\n\n'),
  };
}
