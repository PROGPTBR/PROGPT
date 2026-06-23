import type { HomologacaoParams, TemplateRow } from './types';
import type { RetrievedChunk } from '@/lib/rag/types';
import type { CompanyData } from '@/lib/db/user-company';
import { splitTemplateBody, renderPlaceholders } from './template-assembly';
import { certidoesLinksMarkdown } from './certidoes-links';
import {
  isFiscalEnabled,
  consultarCnpj,
  riskScoreSupplier,
  analyzeCnpjCompliance,
  compareTaxRegimes,
} from '@/lib/fiscal/client';
import type {
  CnpjData,
  SupplierRiskScore,
  ComplianceReport,
  TaxRegimeComparison,
} from '@/lib/fiscal/types';
import { consultarSancoes, type SancoesResult } from '@/lib/fiscal/sancoes';

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
  cnpjData: CnpjData | null; // cadastro (endereço, QSA, natureza, capital)
  risk: SupplierRiskScore | null;
  compliance: ComplianceReport | null;
  regimes: TaxRegimeComparison | null;
  sancoes: SancoesResult | null; // CEIS/CNEP (Portal da Transparência)
  error?: string;
};

export async function fetchHomologacaoData(
  params: HomologacaoParams,
): Promise<HomologacaoClassified> {
  const base: HomologacaoClassified = {
    cnpj: params.cnpj,
    enabled: isFiscalEnabled(),
    available: false,
    cnpjData: null,
    risk: null,
    compliance: null,
    regimes: null,
    sancoes: null,
  };
  // Sanções (CEIS/CNEP) é um serviço SEPARADO (Portal da Transparência) com
  // sua própria env; roda mesmo que o serviço fiscal esteja off, e é fail-soft.
  const sancoesP = consultarSancoes(params.cnpj).catch(() => null);

  if (!base.enabled) {
    base.sancoes = await sancoesP;
    return base;
  }

  // cadastro + risco + compliance em paralelo, tolerante a falha parcial.
  const [cnpjR, riskR, compR] = await Promise.allSettled([
    consultarCnpj(params.cnpj),
    riskScoreSupplier(params.cnpj),
    analyzeCnpjCompliance(params.cnpj),
  ]);
  if (cnpjR.status === 'fulfilled') base.cnpjData = cnpjR.value;
  if (riskR.status === 'fulfilled') base.risk = riskR.value;
  if (compR.status === 'fulfilled') base.compliance = compR.value;
  base.sancoes = await sancoesP;

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

  base.available = !!(base.cnpjData || base.risk || base.compliance);
  if (!base.available) {
    const err =
      cnpjR.status === 'rejected'
        ? cnpjR.reason
        : riskR.status === 'rejected'
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
6. **Sem preâmbulo conversacional**; comece pelo título. Markdown limpo, tabelas markdown, **bold** nos valores críticos.
7. **Sanções são impeditivas**: se houver achado em CEIS/CNEP (sanção/inidoneidade), a recomendação final NÃO pode ser "aprovar" — trate como bloqueio/recusa até análise jurídica, independentemente do score fiscal.`;

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
  if (c.cnpjData) {
    const d = c.cnpjData;
    const end = d.endereco;
    const enderecoStr = end
      ? [end.logradouro, end.complemento, end.bairro, end.municipio && end.uf ? `${end.municipio}/${end.uf}` : end.municipio, end.cep]
          .filter(Boolean)
          .join(', ')
      : null;
    lines.push(
      `### Cadastro (Receita)`,
      `- **Razão social**: ${d.razao_social}`,
      d.nome_fantasia ? `- **Nome fantasia**: ${d.nome_fantasia}` : '',
      `- **Situação cadastral**: ${d.situacao_cadastral}`,
      `- **Natureza jurídica**: ${d.natureza_juridica}`,
      d.porte ? `- **Porte**: ${d.porte}` : '',
      typeof d.capital_social === 'number'
        ? `- **Capital social**: R$ ${d.capital_social.toLocaleString('pt-BR')}`
        : '',
      d.data_abertura ? `- **Abertura**: ${d.data_abertura}` : '',
      enderecoStr ? `- **Endereço**: ${enderecoStr}` : '',
      typeof d.simples_nacional === 'boolean'
        ? `- **Optante Simples**: ${d.simples_nacional ? 'sim' : 'não'}`
        : '',
    );
    if (d.qsa.length) {
      lines.push(
        `- **Quadro societário (${d.qsa.length})**:`,
        ...d.qsa.map(
          (s) =>
            `  - ${s.nome}${s.qualificacao ? ` — ${s.qualificacao}` : ''}${s.faixa_etaria ? ` (${s.faixa_etaria})` : ''}`,
        ),
      );
    }
    lines.push('');
  }
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

function sancoesBlock(s: SancoesResult | null): string {
  if (!s || !s.enabled) {
    return `## Sanções e inidoneidade (CEIS/CNEP)

⚠️ Consulta a listas de sanção (Portal da Transparência) não configurada neste ambiente. Recomende a verificação manual de CEIS/CNEP/CEPIM no Portal da Transparência.`;
  }
  if (!s.consultado) {
    return `## Sanções e inidoneidade (CEIS/CNEP)

⚠️ A consulta às listas de sanção não retornou${s.error ? ` (motivo técnico: ${s.error})` : ''}. Oriente verificação manual no Portal da Transparência.`;
  }
  if (s.sancoes.length === 0) {
    return `## Sanções e inidoneidade (CEIS/CNEP) — INPUT verificado

✅ Nenhuma sanção encontrada nas listas CEIS (Empresas Inidôneas e Suspensas) e CNEP (Empresas Punidas) do Portal da Transparência para este CNPJ na data da consulta.`;
  }
  const rows = s.sancoes.map(
    (x) =>
      `| ${x.fonte} | ${x.tipo || '—'} | ${x.orgao || '—'} | ${x.dataInicio || '—'} | ${x.dataFim || '—'} |`,
  );
  return `## Sanções e inidoneidade (CEIS/CNEP) — ⛔ ACHADO CRÍTICO (INPUT)

**Foram encontradas ${s.sancoes.length} sanção(ões) ativas/registradas para este CNPJ.** Isso é, por boa prática de homologação, **impeditivo ou de altíssima severidade** — trate como bloqueio até análise jurídica.

| Fonte | Tipo | Órgão | Início | Fim |
|---|---|---|---|---|
${rows.join('\n')}`;
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

  // Certidões não saem por API gratuita — sempre oferecemos os links oficiais
  // de emissão manual. O LLM deve reproduzi-los na seção de próximos passos.
  const certidoesBlock = `## Links de emissão de certidões (inclua-os VERBATIM na seção de certidões/próximos passos)

As certidões não foram consultadas automaticamente (não há API pública para isso). Inclua esta lista de links no relatório para o comprador emitir manualmente:

${certidoesLinksMarkdown(classified.cnpjData?.endereco?.uf)}`;

  const instruction = `## Tarefa

Gere agora o relatório de homologação do fornecedor seguindo o template e as regras. Use os dados fiscais como verdade de base; quando faltar dado, sinalize e oriente verificação manual. Na seção de certidões/próximos passos, inclua os links de emissão fornecidos acima (mantenha as URLs exatas).`;

  return {
    system: HOMOLOGACAO_SYSTEM_PROMPT,
    user: [
      headerBlock,
      fiscalDataBlock(classified),
      sancoesBlock(classified.sancoes),
      companyBlock,
      certidoesBlock,
      templateBlock,
      contextBlock,
      instruction,
    ]
      .filter(Boolean)
      .join('\n\n---\n\n'),
  };
}
