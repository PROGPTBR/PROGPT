import type { RetrievedChunk } from '@/lib/rag/types';
import type { PorterParams, TemplateRow } from './types';
import { splitTemplateBody, renderPlaceholders } from './template-assembly';
import type { CompanyData } from '@/lib/db/user-company';

// Sub-projeto 29 — Assistente das 5 Forças de Porter.
//
// Análise estratégica de uma categoria/setor sob a ótica de Porter
// (1979, 1985). Diferente de Kraljic (que classifica items do portfólio
// determinísticamente), Porter é 100% análise narrativa fundamentada na
// base canônica: o LLM produz o documento inteiro a partir do template
// + parâmetros + chunks recuperados.
//
// Estrutura obrigatória do output (refletida no template padrão):
//   1. Sumário executivo (intensidade agregada da categoria)
//   2. Análise por força (5 seções, cada uma com drivers + intensidade
//      [baixa/média/alta] + justificativa)
//   3. Síntese estratégica (oportunidades + riscos)
//   4. Recomendações para o comprador
//
// As cinco forças seguem Porter 1979 ("How Competitive Forces Shape
// Strategy", HBR mar/abr):
//   - Rivalidade entre concorrentes
//   - Ameaça de novos entrantes
//   - Ameaça de produtos substitutos
//   - Poder de barganha dos fornecedores
//   - Poder de barganha dos compradores

export const PORTER_SYSTEM_PROMPT = `Você é um especialista sênior em estratégia competitiva e procurement, com 20 anos de experiência aplicando o framework de Porter (1979, 1985) para decisões de sourcing em mercados brasileiros e globais. Seu trabalho é gerar uma ANÁLISE DAS 5 FORÇAS DE PORTER completa, técnica e acionável em português brasileiro.

## Regras de geração

1. **Siga o template fornecido como esqueleto**. Mantenha as seções na ordem, e expanda cada uma com conteúdo substantivo de procurement sênior. Placeholders {{categoria}}, {{segmento}}, etc. já estão resolvidos no template — não os repita.

2. **Aplique Porter 1979 com fidelidade**. As cinco forças canônicas são, na ordem:
   - **Rivalidade entre concorrentes** (concentração HHI, crescimento do mercado, custos fixos, diferenciação, barreiras de saída)
   - **Ameaça de novos entrantes** (economias de escala, capital requerido, identidade de marca, acesso a canais, política governamental)
   - **Ameaça de produtos substitutos** (relação preço-desempenho do substituto, custo de mudança, propensão do comprador a substituir)
   - **Poder de barganha dos fornecedores** (concentração de fornecedores, volume importância, custos de troca, ameaça de integração para frente, ausência de substitutos)
   - **Poder de barganha dos compradores** (concentração de compradores, volume relativo, padronização do produto, custo de troca, ameaça de integração para trás)

3. **Classifique a intensidade de cada força** como **baixa**, **média** ou **alta**, com justificativa que cita drivers concretos do mercado. NÃO use "média" como saída fácil — quando os drivers apontam para um lado claro, comprometa-se com baixa/alta.

4. **Use a base de conhecimento para fundamentar**. Há trechos canônicos no contexto (Porter, Cox, Cousins, Williamson). Incorpore as ideias como conhecimento próprio — NÃO cite autores, IDs nem números entre colchetes na saída.

5. **Aplicação prática para o comprador**. Cada força deve concluir com uma frase do tipo "Implicação para o comprador: ...". Na seção de recomendações finais, traduza intensidade × postura recomendada (ex: alta rivalidade → leilão competitivo; alta concentração de fornecedor → desenvolver alternativa; alta ameaça de substituto → renegociar preço com a alavanca do substituto).

6. **Formato Markdown bem estruturado**. Headings (#, ##, ###), tabelas markdown para a matriz síntese (5 linhas × intensidade), **bold** para os termos técnicos canônicos. O output será renderizado em chat e convertido para .docx — markdown limpo é essencial.

7. **Não invente players, market shares ou números de mercado** que não estejam no contexto. Se quiser referir-se a estruturas típicas do setor, use linguagem como "tipicamente, neste tipo de categoria, observa-se…". Se a base ou as observações do usuário trouxerem dados concretos, use-os.

8. **Não inclua preâmbulo nem epílogo conversacional**. Comece direto pelo título da análise. Termine na última seção (Recomendações). Sem "Aqui está a análise:" ou "Espero que ajude!".`;

function formatChunks(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return '(nenhum trecho relevante recuperado — fundamentar em princípios gerais de Porter 1979)';
  }
  return chunks
    .map((c) => `### Fonte: ${c.articleTitle}\n\n${c.content.slice(0, 800)}`)
    .join('\n\n---\n\n');
}

/**
 * Build the system + user prompts for a Porter analysis generation call.
 */
export function buildPorterPrompt(
  params: PorterParams,
  template: TemplateRow,
  chunks: RetrievedChunk[],
  company: CompanyData | null = null,
): { system: string; user: string } {
  const companyBlock = company
    ? [
        company.company_name ? `- **Nome fantasia**: ${company.company_name}` : '',
        company.company_legal_name
          ? `- **Razão social**: ${company.company_legal_name}`
          : '',
        company.company_description
          ? `- **Descrição da empresa**: ${company.company_description}`
          : '',
      ]
        .filter(Boolean)
        .join('\n')
    : '';

  const paramsBlock = `## Parâmetros da análise (fornecidos pelo comprador)

- **Categoria**: ${params.categoria}
${params.segmento ? `- **Segmento**: ${params.segmento}` : ''}
${params.escopo ? `- **Escopo (geográfico/mercado)**: ${params.escopo}` : ''}
${params.observacoes ? `- **Observações adicionais**: ${params.observacoes}` : ''}${
    companyBlock
      ? `\n\n## Empresa do comprador (referência)\n\n${companyBlock}`
      : ''
  }`;

  // Same head/tail split pattern from RFP/Kraljic: the LLM gets the head
  // (sections that need narrative generation); any verbatim tail
  // (references, glossary, etc.) is appended server-side via
  // template-assembly.assembleOutput in /api/assistants/porter onFinish.
  const { head } = splitTemplateBody(template.body_md);
  const renderedHead = renderPlaceholders(head, params, company);
  const templateBlock = `## Template a seguir (estrutura obrigatória — apenas as seções customizáveis)

Nome do template: **${template.name}**
${template.description ? `Descrição: ${template.description}\n` : ''}
\`\`\`markdown
${renderedHead}
\`\`\``;

  const contextBlock = `## Contexto da base de conhecimento (use para fundamentar, NÃO cite)

${formatChunks(chunks)}`;

  const instruction = `## Tarefa

Gere a análise das 5 Forças de Porter completa para a categoria informada. Comece direto pelo título. Use o template como estrutura e preencha cada seção com o conteúdo apropriado. Para cada força, traga drivers concretos, classifique a intensidade (baixa/média/alta) e termine com "Implicação para o comprador". Feche com síntese estratégica e recomendações. Produza markdown limpo.`;

  return {
    system: PORTER_SYSTEM_PROMPT,
    user: [paramsBlock, templateBlock, contextBlock, instruction].join('\n\n---\n\n'),
  };
}
