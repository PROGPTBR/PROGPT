import type { RetrievedChunk } from '@/lib/rag/types';
import type { TemplateRow } from '@/lib/assistants/types';
import type { CompanyData } from '@/lib/db/user-company';
import { splitTemplateBody, renderPlaceholders } from '@/lib/assistants/template-assembly';
import {
  CENARIOS,
  DESTINACAO_LABELS,
  REDUCAO_LABELS,
  REGIME_COMPRADOR_LABELS,
  REGIME_FORNECEDOR_LABELS,
  brl,
  tabelaCustoLiquido,
  type AnaliseTributaria,
  type ParametrosTributarios,
} from './calculo';

export const TRIBUTARIO_SYSTEM_PROMPT = `Você é um especialista sênior em tributos sobre compras no Brasil (ICMS, IPI, PIS/Cofins e a reforma tributária da EC 132/2023 e da LC 214/2025: CBS, IBS e Imposto Seletivo), com experiência em procurement. Sua tarefa é INTERPRETAR uma comparação de propostas que já foi calculada e recomendar ao comprador qual proposta é melhor pelo lado tributário, hoje e durante a transição da reforma.

## Regras

1. **Os números já vêm calculados.** Use exatamente os valores da tabela de custo líquido e do detalhamento. NÃO recalcule, NÃO arredonde diferente, NÃO invente alíquota.
2. **Custo líquido é o critério.** Preço menor não é proposta melhor: o que importa é o desembolso menos os créditos que a empresa recupera. Mostre isso com os números do caso.
3. **Explique a virada da reforma** quando a melhor proposta mudar entre os anos: diga em que ano muda e por quê (crédito amplo de IBS/CBS, fim do PIS/Cofins e do IPI em 2027, redução do ICMS de 2029 a 2032, fornecedor do Simples transferindo pouco crédito).
   **Simples puro x Simples híbrido**: desde 2026 o Portal do Simples Nacional mostra, na consulta do CNPJ, se a empresa optou pelo regime regular do IBS e da CBS. "Não optante" (Simples puro) recolhe IBS/CBS dentro do DAS e transfere pouco crédito; "optante" (Simples híbrido) continua no Simples mas apura IBS/CBS fora do DAS e transfere crédito integral. "Não optante" não quer dizer que a empresa não é contribuinte de IBS/CBS. Para todo fornecedor do Simples, recomende confirmar essa situação no Portal do Simples e use isso na negociação.
4. **Recomendações executáveis**: o que perguntar a cada fornecedor (regime a partir de 2027, se vai destacar IBS/CBS, reajuste de preço "por fora"), cláusula contratual de reequilíbrio tributário, prazo do contrato frente ao calendário da reforma.
5. **Honestidade**: as alíquotas de IBS/CBS ainda não são definitivas e o cálculo é uma estimativa simplificada. Diga isso uma vez, no fim, e recomende validar com o contador ou o tributário da empresa antes de fechar contrato longo.
6. **Sem preâmbulo nem despedida.** Comece direto pelo título. Não cite fontes, autores nem IDs. Não use travessão.
7. **Markdown limpo**: títulos, a tabela de custo líquido, bullets e **negrito** para o vencedor de cada cenário.`;

function formatChunks(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return '(nenhum trecho relevante na base: fundamente em princípios gerais de TCO e tributação de compras)';
  return chunks.map((c) => `### Fonte: ${c.articleTitle}\n\n${c.content.slice(0, 800)}`).join('\n\n---\n\n');
}

export function buildTributarioPrompt(
  params: ParametrosTributarios,
  analise: AnaliseTributaria,
  template: TemplateRow,
  chunks: RetrievedChunk[],
  company: CompanyData | null,
): { system: string; user: string } {
  const propostas = params.propostas
    .map((p, i) => {
      const r = analise.propostas[i]!;
      const hoje = r.cenarios.atual;
      const fim = r.cenarios['2033'];
      return `### ${p.fornecedor}
- Regime: ${REGIME_FORNECEDOR_LABELS[p.regimeFornecedor]}${p.uf ? `, UF ${p.uf}` : ''}${p.cnpj ? `, CNPJ ${p.cnpj}` : ''}
- Valor dos produtos: ${brl(p.valorProdutos)} | IPI ${p.ipiPct}% | ICMS ${p.icmsPct}% | PIS/Cofins embutidos ${p.pisCofinsPct}% | ST ${brl(p.stValor)} | frete ${brl(p.freteValor)}
- Na reforma: ${REDUCAO_LABELS[p.reducaoReformaPct]}
- Hoje: desembolso ${brl(hoje.desembolso)}, créditos ${brl(hoje.creditos)} (ICMS ${brl(hoje.detalhe.creditoIcms)}, IPI ${brl(hoje.detalhe.creditoIpi)}, PIS/Cofins ${brl(hoje.detalhe.creditoPisCofins)}), tributo que vira custo ${brl(hoje.tributoNaoRecuperado)}
- 2033: desembolso ${brl(fim.desembolso)}, créditos ${brl(fim.creditos)} (IBS/CBS ${brl(fim.detalhe.creditoIbsCbs)}), tributo que vira custo ${brl(fim.tributoNaoRecuperado)}`;
    })
    .join('\n\n');

  const vencedores = CENARIOS.map(
    (c) => `- ${c.rotulo}: **${analise.propostas[analise.melhorPorCenario[c.id]]!.fornecedor}**`,
  ).join('\n');

  const input = `## Compra analisada

- Descrição: ${params.descricaoCompra}
- Regime do comprador: ${REGIME_COMPRADOR_LABELS[params.regimeComprador]}
- Destinação: ${DESTINACAO_LABELS[params.destinacao]}${params.ufComprador ? `\n- UF do comprador: ${params.ufComprador}` : ''}
- Premissas da reforma: CBS ${params.cbsPct}% + IBS ${params.ibsPct}% (estimativas editáveis); fornecedor do Simples transfere crédito de ${params.simplesCreditoPct}% do valor
${params.notes ? `- Notas do comprador: ${params.notes}\n` : ''}
## Custo líquido por ano (já calculado, use estes números)

${tabelaCustoLiquido(params, analise)}

Melhor proposta por cenário:
${vencedores}
${analise.viradaNaReforma ? '\n**A melhor proposta de hoje NÃO é a melhor em todos os anos da transição.**' : '\nA mesma proposta vence em todos os anos.'}

## Detalhe por proposta

${propostas}
${analise.avisos.length ? `\n## Avisos do cálculo\n\n${analise.avisos.map((a) => `- ${a}`).join('\n')}` : ''}`;

  const { head } = splitTemplateBody(template.body_md);
  const renderedHead = renderPlaceholders(
    head,
    {
      client: company?.company_name ?? '',
      scope: params.descricaoCompra,
      category: DESTINACAO_LABELS[params.destinacao],
      deadline: '',
      budget: '',
      criteria: [],
      notes: params.notes,
    },
    company,
  );

  return {
    system: TRIBUTARIO_SYSTEM_PROMPT,
    user: [
      input,
      company?.company_name ? `## Empresa do comprador\n\n- ${company.company_name}` : '',
      `## Template a seguir (estrutura obrigatória)\n\n\`\`\`markdown\n${renderedHead}\n\`\`\``,
      `## Contexto da base de conhecimento (use para fundamentar, NÃO cite)\n\n${formatChunks(chunks)}`,
      '## Tarefa\n\nGere o relatório agora, seguindo o template e reproduzindo a tabela de custo líquido exatamente como está.',
    ]
      .filter(Boolean)
      .join('\n\n---\n\n'),
  };
}
