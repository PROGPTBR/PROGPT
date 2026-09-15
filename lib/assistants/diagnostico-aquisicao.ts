import type { RetrievedChunk } from '@/lib/rag/types';
import type {
  DiagnosticoAquisicaoParams,
  ClassifiedDiagnosticoAquisicao,
  DiagnosticoLeaning,
  TemplateRow,
} from './types';
import {
  DIAGNOSTICO_NIVEL_LABELS,
  DIAGNOSTICO_IMPACTO_LABELS,
  DIAGNOSTICO_NATUREZA_LABELS,
  DIAGNOSTICO_TIPO_INVESTIMENTO_LABELS,
  DIAGNOSTICO_FREQUENCIA_LABELS,
} from './types';
import { splitTemplateBody, renderPlaceholders } from './template-assembly';
import type { CompanyData } from '@/lib/db/user-company';

// Diagnóstico de Aquisição — a partir de dois documentos de referência
// entregues pelo diretor em 2026-09-14 ("as 7 etapas desta decisão" e
// "assistente de compras"). O segundo é uma spec funcional PARCIAL: define
// os ramos de topo CAPEX/OPEX (perguntas + KPIs recomendados) mas termina
// dizendo que a árvore completa (todas as combinações de criticidade ×
// complexidade × impacto) ainda precisa ser montada. Decisão de escopo do
// usuário: em vez de esperar a árvore fechada, este assistente implementa
// determinística e testavelmente só o que o doc já define (seleção de KPI
// por classificação + a inclinação SOURCE/CONTRACT/BUY via 3 scores 1-3) e
// deixa o LLM (SYSTEM_PROMPT sênior + base de conhecimento) completar o
// racional nas combinações que o doc não detalhou — igual à divisão
// determinístico/narrativo já usada em Kraljic/ABC/Scorecard.

// Regra do doc-fonte, verbatim: "Essa classificação será utilizada como
// premissa do diagnóstico e não será alterada pelo ProGpt." — o assistente
// NUNCA reclassifica CAPEX↔OPEX; classifyAquisicao só deriva KPIs + leaning.

const CAPEX_KPIS = [
  'TCO',
  'ROI',
  'Payback',
  'VPL',
  'Custo por hora',
  'Disponibilidade',
  'Utilização',
  'MTBF',
  'MTTR',
  'Custo de manutenção',
  'Produtividade',
  'Valor residual',
];

const OPEX_KPIS = [
  'Saving',
  'Cost Avoidance',
  'PPV (Purchase Price Variance)',
  'Spend versus Budget',
  'OTIF',
  'SLA Compliance',
  'Lead Time',
  'Fill Rate',
  'Índice de qualidade',
  'Custo unitário',
  'Consumo',
  'Índice de reajuste',
];

const NIVEL_SCORE: Record<'baixa' | 'media' | 'alta', 1 | 2 | 3> = {
  baixa: 1,
  media: 2,
  alta: 3,
};

const IMPACTO_SCORE: Record<'baixo' | 'medio' | 'alto', 1 | 2 | 3> = {
  baixo: 1,
  medio: 2,
  alto: 3,
};

function leaningFor(total: number): DiagnosticoLeaning {
  // total ∈ [3, 9] (3 dimensões, escala 1-3 cada).
  if (total >= 7) return 'SOURCE';
  if (total <= 4) return 'BUY';
  return 'CONTRACT';
}

export function classifyAquisicao(
  params: DiagnosticoAquisicaoParams,
): ClassifiedDiagnosticoAquisicao {
  const criticidadeScore = NIVEL_SCORE[params.criticidade];
  const complexidadeScore = NIVEL_SCORE[params.complexidadeMercado];
  const impactoScore = IMPACTO_SCORE[params.impactoOperacional];
  const totalScore = criticidadeScore + complexidadeScore + impactoScore;

  return {
    kpis: params.classificacao === 'CAPEX' ? CAPEX_KPIS : OPEX_KPIS,
    leaning: leaningFor(totalScore),
    criticidadeScore,
    complexidadeScore,
    impactoScore,
    totalScore,
  };
}

// ── Prompt builder ───────────────────────────────────────────────────────

export const DIAGNOSTICO_AQUISICAO_SYSTEM_PROMPT = `Você é um especialista sênior em procurement (compras corporativas) com 20 anos de experiência. Seu trabalho aqui é INTERPRETAR um diagnóstico de aquisição já classificado e produzir um relatório executivo em português brasileiro que recomenda a estratégia de sourcing (SOURCE, CONTRACT ou BUY) e os KPIs certos para acompanhar a compra.

## Regras

1. **A classificação CAPEX/OPEX é PREMISSA DA EMPRESA, não output seu**. Ela já foi definida pelo comprador conforme a política contábil e de materialidade da empresa dele. NÃO questione, NÃO sugira reclassificar, NÃO discuta se "deveria" ser a outra. Trate como fato dado.

2. **A lista de KPIs recomendados e a inclinação SOURCE/CONTRACT/BUY já vêm calculadas** (determinísticas, a partir de criticidade × complexidade de mercado × impacto operacional). NÃO recalcule nem conteste esses valores — sua tarefa é explicar o PORQUÊ deles fazerem sentido para este caso específico e aterrissar em recomendações executáveis.

3. **Preencha o racional que a classificação por si só não cobre**. Duas aquisições no mesmo quadrante CAPEX ou OPEX podem pedir estratégias bem diferentes dependendo do valor envolvido, do ciclo de vida, da concentração de fornecedores etc. — use os campos específicos informados (investimento/vida útil/orçamento para CAPEX; gasto anual/consumo/nº de fornecedores para OPEX) para calibrar a recomendação, não trate o quadrante como resposta única.

4. **Diferencie SOURCE, CONTRACT e BUY na prática**:
   - **SOURCE** (score alto — alta criticidade + alta complexidade + alto impacto): processo de strategic sourcing completo — pesquisa de mercado, RFI/RFP, negociação estruturada, contrato robusto com governança.
   - **CONTRACT** (score intermediário): negociação direcionada com o(s) fornecedor(es) já mapeado(s) — sem o ciclo completo de sourcing, mas com contrato formal e KPIs de acompanhamento.
   - **BUY** (score baixo — baixa criticidade + baixa complexidade + baixo impacto): compra transacional simplificada — cotação rápida, catálogo, e-procurement, sem necessidade de processo elaborado.

5. **Explique cada KPI recomendado em 1 frase de aplicação prática** (o que ele mede e quando revisar) — não apenas liste os nomes.

6. **Profundidade sênior**. Recomendações executáveis: threshold numérico, ferramenta concreta, cadência clara. Evite "padrão de mercado" / "boas práticas" sem ancoragem.

7. **Sem preâmbulo nem epílogo conversacional**. Comece direto pelo título.

8. **Não invente fornecedores, valores ou cláusulas**. Quando não houver fundamento, use linguagem de "o comprador definirá".

9. **Use a base de conhecimento (procurement, TCO/Ellram 1993, Strategic Sourcing/Monczka, Williamson 1985 make-or-buy)** para fundamentar a recomendação SOURCE/CONTRACT/BUY — é essencialmente uma decisão de make-or-buy/nível de engajamento. Não cite autores nem IDs — incorpore como conhecimento próprio.

10. **Markdown limpo**: headings, tabela markdown para os KPIs recomendados, bullets, **bold** para valores críticos.`;

function formatCapexBlock(capex: DiagnosticoAquisicaoParams['capex']): string {
  if (!capex) return '_(nenhum dado adicional de CAPEX informado)_';
  const lines: string[] = [];
  if (typeof capex.valorInvestimentoBRL === 'number')
    lines.push(
      `- Valor do investimento: R$ ${capex.valorInvestimentoBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    );
  if (typeof capex.vidaUtilAnos === 'number')
    lines.push(`- Vida útil esperada: ${capex.vidaUtilAnos} anos`);
  if (typeof capex.orcamentoAprovado === 'boolean')
    lines.push(`- Orçamento aprovado: ${capex.orcamentoAprovado ? 'sim' : 'não'}`);
  if (capex.tipoInvestimento)
    lines.push(
      `- Tipo de investimento: ${DIAGNOSTICO_TIPO_INVESTIMENTO_LABELS[capex.tipoInvestimento]}`,
    );
  if (capex.capacidadeAdicional) lines.push(`- Capacidade adicionada: ${capex.capacidadeAdicional}`);
  if (typeof capex.existeEquipamentoAtual === 'boolean')
    lines.push(`- Existe equipamento atual: ${capex.existeEquipamentoAtual ? 'sim' : 'não'}`);
  if (capex.custoAtualOperacao) lines.push(`- Custo atual de operação: ${capex.custoAtualOperacao}`);
  if (typeof capex.haveraInstalacao === 'boolean')
    lines.push(`- Haverá instalação: ${capex.haveraInstalacao ? 'sim' : 'não'}`);
  if (typeof capex.haveraTreinamento === 'boolean')
    lines.push(`- Haverá treinamento: ${capex.haveraTreinamento ? 'sim' : 'não'}`);
  if (typeof capex.custoManutencaoAnualBRL === 'number')
    lines.push(
      `- Custo de manutenção anual: R$ ${capex.custoManutencaoAnualBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    );
  if (capex.custoParada) lines.push(`- Custo de parada: ${capex.custoParada}`);
  if (typeof capex.pecasSobressalentes === 'boolean')
    lines.push(`- Haverá peças sobressalentes: ${capex.pecasSobressalentes ? 'sim' : 'não'}`);
  if (typeof capex.valorResidualBRL === 'number')
    lines.push(
      `- Valor residual estimado: R$ ${capex.valorResidualBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    );
  return lines.length > 0 ? lines.join('\n') : '_(nenhum dado adicional de CAPEX informado)_';
}

function formatOpexBlock(opex: DiagnosticoAquisicaoParams['opex']): string {
  if (!opex) return '_(nenhum dado adicional de OPEX informado)_';
  const lines: string[] = [];
  if (typeof opex.gastoAnualBRL === 'number')
    lines.push(
      `- Gasto anual: R$ ${opex.gastoAnualBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    );
  if (typeof opex.orcamentoDisponivelBRL === 'number')
    lines.push(
      `- Orçamento disponível: R$ ${opex.orcamentoDisponivelBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    );
  if (opex.volumeEsperado) lines.push(`- Volume esperado: ${opex.volumeEsperado}`);
  if (opex.frequenciaConsumo)
    lines.push(`- Frequência de consumo: ${DIAGNOSTICO_FREQUENCIA_LABELS[opex.frequenciaConsumo]}`);
  if (opex.sazonalidade) lines.push(`- Sazonalidade: ${opex.sazonalidade}`);
  if (opex.historicoPreco) lines.push(`- Histórico de preço: ${opex.historicoPreco}`);
  if (typeof opex.numeroFornecedores === 'number')
    lines.push(`- Nº de fornecedores que atendem: ${opex.numeroFornecedores}`);
  if (typeof opex.riscoDesabastecimento === 'boolean')
    lines.push(`- Risco de desabastecimento: ${opex.riscoDesabastecimento ? 'sim' : 'não'}`);
  if (typeof opex.existeSla === 'boolean')
    lines.push(`- Existe SLA: ${opex.existeSla ? 'sim' : 'não'}`);
  if (opex.reajuste) lines.push(`- Reajuste: ${opex.reajuste}`);
  if (opex.indiceInflacaoAssociado)
    lines.push(`- Índice de inflação associado: ${opex.indiceInflacaoAssociado}`);
  if (typeof opex.prazoContratualMeses === 'number')
    lines.push(`- Prazo contratual: ${opex.prazoContratualMeses} meses`);
  if (typeof opex.consumoMinimo === 'boolean')
    lines.push(`- Existe consumo mínimo: ${opex.consumoMinimo ? 'sim' : 'não'}`);
  if (typeof opex.possibilidadeConsolidacao === 'boolean')
    lines.push(
      `- Possibilidade de consolidação do spend: ${opex.possibilidadeConsolidacao ? 'sim' : 'não'}`,
    );
  return lines.length > 0 ? lines.join('\n') : '_(nenhum dado adicional de OPEX informado)_';
}

function formatChunks(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return '(nenhum trecho relevante recuperado — fundamentar em princípios gerais de procurement e make-or-buy)';
  }
  return chunks
    .map((c) => `### Fonte: ${c.articleTitle}\n\n${c.content.slice(0, 800)}`)
    .join('\n\n---\n\n');
}

export function buildDiagnosticoAquisicaoPrompt(
  params: DiagnosticoAquisicaoParams,
  classified: ClassifiedDiagnosticoAquisicao,
  template: TemplateRow,
  chunks: RetrievedChunk[],
  company: CompanyData | null = null,
): { system: string; user: string } {
  const inputBlock = `## Aquisição analisada

- **Descrição**: ${params.descricaoCompra}
${params.categoria ? `- **Categoria**: ${params.categoria}\n` : ''}- **Classificação (premissa da empresa — NÃO reclassificar)**: ${params.classificacao}
- **Natureza**: ${DIAGNOSTICO_NATUREZA_LABELS[params.natureza]}
- **Criticidade**: ${DIAGNOSTICO_NIVEL_LABELS[params.criticidade]}
- **Complexidade de mercado**: ${DIAGNOSTICO_NIVEL_LABELS[params.complexidadeMercado]}
- **Impacto operacional**: ${DIAGNOSTICO_IMPACTO_LABELS[params.impactoOperacional]}
${params.notes ? `- **Notas do comprador**: ${params.notes}\n` : ''}
### Dados adicionais — ${params.classificacao}

${params.classificacao === 'CAPEX' ? formatCapexBlock(params.capex) : formatOpexBlock(params.opex)}

### Diagnóstico já calculado (determinístico — não recalcule)

- **Inclinação recomendada**: ${classified.leaning}
- **Score de decisão** (criticidade + complexidade + impacto, escala 3-9): ${classified.totalScore} (criticidade=${classified.criticidadeScore}, complexidade=${classified.complexidadeScore}, impacto=${classified.impactoScore})
- **KPIs recomendados para esta classificação (${params.classificacao})**: ${classified.kpis.join(', ')}`;

  const companyBlock = company
    ? [
        company.company_name ? `- **Empresa**: ${company.company_name}` : '',
        company.company_description ? `- **Descrição**: ${company.company_description}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    : '';

  const { head } = splitTemplateBody(template.body_md);
  const renderedHead = renderPlaceholders(
    head,
    {
      client: company?.company_name ?? '',
      scope: params.descricaoCompra,
      category: params.categoria || params.classificacao,
      deadline: '',
      budget: '',
      criteria: [],
      notes: params.notes ?? '',
    },
    company,
  );

  const templateBlock = `## Template a seguir (estrutura obrigatória — apenas as seções customizáveis)

Nome do template: **${template.name}**
${template.description ? `Descrição: ${template.description}\n` : ''}
\`\`\`markdown
${renderedHead}
\`\`\``;

  const contextBlock = `## Contexto da base de conhecimento (use para fundamentar, NÃO cite)

${formatChunks(chunks)}`;

  const instruction = `## Tarefa

Gere o relatório executivo agora, seguindo o template. Explique por que a inclinação ${classified.leaning} é adequada para este caso (não apenas repita o rótulo), detalhe os KPIs recomendados com aplicação prática de cada um, e recomende os próximos passos concretos.`;

  return {
    system: DIAGNOSTICO_AQUISICAO_SYSTEM_PROMPT,
    user: [
      inputBlock,
      companyBlock ? `## Empresa do comprador\n\n${companyBlock}` : '',
      templateBlock,
      contextBlock,
      instruction,
    ]
      .filter(Boolean)
      .join('\n\n---\n\n'),
  };
}
