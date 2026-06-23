import type { HomologacaoParams, TemplateRow } from './types';
import type { RetrievedChunk } from '@/lib/rag/types';
import type { CompanyData } from '@/lib/db/user-company';
import { splitTemplateBody, renderPlaceholders } from './template-assembly';
import {
  isFiscalEnabled,
  riskScoreSupplier,
  analyzeCnpjCompliance,
  compareTaxRegimes,
} from '@/lib/fiscal/client';
import type {
  SupplierRiskScore,
  ComplianceReport,
  TaxRegimeComparison,
} from '@/lib/fiscal/types';

// Sub-projeto 36 (fase 1) — Homologação / Qualificação de Fornecedor.
//
// Passo determinístico do assistente = consulta ao serviço fiscal
// (mcp-fiscal-brasil) pelo CNPJ. Fail-soft: se o serviço estiver desligado
// (FISCAL_API_URL ausente) ou indisponível, retorna `available:false` e o
// prompt cai num checklist genérico de homologação — nunca derruba o run.

export type HomologacaoClassified = {
  cnpj: string;
  enabled: boolean; // serviço configurado?
  available: boolean; // alguma consulta respondeu?
  risk: SupplierRiskScore | null;
  compliance: ComplianceReport | null;
  regimes: TaxRegimeComparison | null;
  error?: string;
};

export async function fetchHomologacaoData(
  params: HomologacaoParams,
): Promise<HomologacaoClassified> {
  const base: HomologacaoClassified = {
    cnpj: params.cnpj,
    enabled: isFiscalEnabled(),
    available: false,
    risk: null,
    compliance: null,
    regimes: null,
  };
  if (!base.enabled) return base;

  // risco + compliance em paralelo, tolerante a falha parcial.
  const [riskR, compR] = await Promise.allSettled([
    riskScoreSupplier(params.cnpj),
    analyzeCnpjCompliance(params.cnpj),
  ]);
  if (riskR.status === 'fulfilled') base.risk = riskR.value;
  if (compR.status === 'fulfilled') base.compliance = compR.value;

  // regime tributário só quando o usuário informou setor + faturamento.
  if (params.setor && typeof params.faturamentoAnualBRL === 'number') {
    try {
      base.regimes = await compareTaxRegimes({
        faturamentoAnual: params.faturamentoAnualBRL,
        setor: params.setor,
      });
    } catch {
      /* opcional — segue sem regimes */
    }
  }

  base.available = !!(base.risk || base.compliance);
  if (!base.available) {
    const err =
      riskR.status === 'rejected'
        ? riskR.reason
        : compR.status === 'rejected'
          ? compR.reason
          : null;
    base.error = err instanceof Error ? err.message : String(err ?? 'indisponível');
  }
  return base;
}

// ── Prompt builder ───────────────────────────────────────────────────────

export const HOMOLOGACAO_SYSTEM_PROMPT = `Você é um especialista sênior em Strategic Sourcing e gestão de risco de fornecedores (SRM), com 20 anos de experiência em homologação/qualificação de fornecedores no Brasil. Sua tarefa é produzir um RELATÓRIO DE HOMOLOGAÇÃO DE FORNECEDOR em português brasileiro, fundamentado nos dados fiscais consultados.

## Regras
1. **Os dados fiscais são INPUT (verdade de base), não output.** Situação cadastral, score de risco, faixa de risco, recomendação e achados de compliance JÁ vêm consultados na Receita/BrasilAPI. NÃO invente, NÃO recalcule, NÃO contradiga esses dados.
2. **Quando um dado fiscal não estiver disponível**, diga explicitamente ("não foi possível consultar X") e oriente a verificação manual — nunca preencha com suposição.
3. **Estrutura do relatório** (markdown, headings claros):
   - **Identificação**: CNPJ, razão social, situação cadastral.
   - **Avaliação de risco**: score (0–100), faixa (baixo/médio/alto/crítico) e os fatores que pesaram.
   - **Compliance**: tabela dos achados por categoria (situação cadastral, regime tributário, atividade, endereço, **certidões**, quadro societário), com severidade.
   - **Recomendação de homologação**: traduza a recomendação fiscal (aprovar / aprovar com ressalvas / investigar / recusar) em ação de compras, com justificativa.
   - **Próximos passos / due diligence complementar**: o que o comprador deve coletar antes de fechar (certidões atualizadas, documentos, visita técnica) conforme a faixa de risco.
4. **Profundidade sênior**: amarre cada recomendação a um critério objetivo. Evite generalidades vazias.
5. **Fundamente** boas práticas de homologação na base de conhecimento (qualificação de fornecedores, due diligence, gestão de risco de suprimento) — sem citar autores/IDs/colchetes.
6. **Sem preâmbulo conversacional**; comece pelo título. Markdown limpo, tabelas markdown, **bold** nos valores críticos.`;

const RISK_LABEL: Record<string, string> = {
  baixo: 'Baixo',
  medio: 'Médio',
  alto: 'Alto',
  critico: 'Crítico',
};

const REC_LABEL: Record<string, string> = {
  aprovar: 'Aprovar',
  aprovar_com_ressalvas: 'Aprovar com ressalvas',
  investigar: 'Investigar',
  recusar: 'Recusar',
};

function formatChunks(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return '(nenhum trecho relevante recuperado — fundamentar em princípios gerais de homologação e gestão de risco de fornecedores)';
  }
  return chunks
    .map((c) => `### Fonte: ${c.articleTitle}\n\n${c.content.slice(0, 800)}`)
    .join('\n\n---\n\n');
}

function fiscalDataBlock(c: HomologacaoClassified): string {
  if (!c.enabled) {
    return `## Dados fiscais

⚠️ O serviço de consulta fiscal não está configurado neste ambiente. Não há dados de Receita/compliance para o CNPJ ${c.cnpj}. Produza um relatório de homologação com **checklist de verificação manual** (situação cadastral no e-CAC, certidões CND federal e FGTS, Simples Nacional, quadro societário) e oriente o comprador a consultar cada item.`;
  }
  if (!c.available) {
    return `## Dados fiscais

⚠️ A consulta ao CNPJ ${c.cnpj} não retornou dados (serviço indisponível ou CNPJ não encontrado).${
      c.error ? ` Motivo técnico: ${c.error}.` : ''
    } Sinalize isso no relatório e oriente verificação manual.`;
  }

  const lines: string[] = [];
  if (c.risk) {
    lines.push(
      `### Score de risco do fornecedor`,
      `- **CNPJ**: ${c.risk.cnpj}`,
      `- **Razão social**: ${c.risk.razao_social}`,
      `- **Score**: ${c.risk.score}/100`,
      `- **Faixa de risco**: ${RISK_LABEL[c.risk.risco] ?? c.risk.risco}`,
      `- **Recomendação (fiscal)**: ${REC_LABEL[c.risk.recomendacao] ?? c.risk.recomendacao}`,
      `- **Data da análise**: ${c.risk.data_analise}`,
      c.risk.fatores.length
        ? `- **Fatores**:\n${c.risk.fatores.map((f) => `  - ${f}`).join('\n')}`
        : '',
    );
  }
  if (c.compliance) {
    lines.push(
      `\n### Relatório de compliance`,
      `- **Risco geral**: ${RISK_LABEL[c.compliance.risco_geral] ?? c.compliance.risco_geral} (score ${c.compliance.score}/100)`,
      `- **Resumo**: ${c.compliance.resumo_executivo}`,
      `- **Fontes consultadas**: ${c.compliance.fontes_consultadas.join(', ')}`,
    );
    if (c.compliance.achados.length) {
      lines.push(
        `\n| Categoria | Severidade | Achado | Detalhe | Recomendação |`,
        `|---|---|---|---|---|`,
        ...c.compliance.achados.map(
          (a) =>
            `| ${a.categoria} | ${RISK_LABEL[a.severidade] ?? a.severidade} | ${a.titulo} | ${a.detalhe} | ${a.recomendacao ?? '—'} |`,
        ),
      );
    }
  }
  if (c.regimes) {
    lines.push(
      `\n### Comparação de regime tributário (cenário informado)`,
      `- **Melhor opção**: ${c.regimes.melhor_opcao}`,
      `- **Economia anual vs pior**: R$ ${c.regimes.economia_anual_vs_pior.toLocaleString('pt-BR')}`,
      c.regimes.observacoes ? `- **Observações**: ${c.regimes.observacoes}` : '',
    );
  }
  return `## Dados fiscais consultados (INPUT — verdade de base)\n\n${lines.filter(Boolean).join('\n')}`;
}

export function buildHomologacaoPrompt(
  params: HomologacaoParams,
  classified: HomologacaoClassified,
  template: TemplateRow,
  chunks: RetrievedChunk[],
  company: CompanyData | null = null,
): { system: string; user: string } {
  const headerBlock = `## Fornecedor em homologação
- **CNPJ**: ${params.cnpj}
${params.fornecedorNome ? `- **Nome informado**: ${params.fornecedorNome}` : ''}
${params.notas ? `- **Notas do comprador**: ${params.notas}` : ''}`;

  const companyBlock = company?.company_name
    ? `## Empresa compradora\n\n- **Empresa**: ${company.company_name}${
        company.company_cnpj ? `\n- **CNPJ**: ${company.company_cnpj}` : ''
      }`
    : '';

  const { head } = splitTemplateBody(template.body_md);
  const renderedHead = renderPlaceholders(
    head,
    {
      client: company?.company_name ?? '',
      scope: `Homologação de ${params.fornecedorNome || params.cnpj}`,
      category: 'Homologação de fornecedor',
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

Gere agora o relatório de homologação do fornecedor seguindo o template e as regras. Use os dados fiscais como verdade de base; quando faltar dado, sinalize e oriente verificação manual.`;

  return {
    system: HOMOLOGACAO_SYSTEM_PROMPT,
    user: [
      headerBlock,
      fiscalDataBlock(classified),
      companyBlock,
      templateBlock,
      contextBlock,
      instruction,
    ]
      .filter(Boolean)
      .join('\n\n---\n\n'),
  };
}
