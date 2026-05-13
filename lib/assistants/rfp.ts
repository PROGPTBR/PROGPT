import type { RetrievedChunk } from '@/lib/rag/types';
import type { RfpParams, TemplateRow } from './types';

// Sub-projeto 20 — Assistente de RFP prompt construction.
//
// Why this lives separately from lib/rag/prompt-builder.ts: the chat
// SYSTEM_PROMPT is tuned for Q&A in 3 parts (direct answer / theory /
// practical application). RFP generation is a different task — produce a
// long structured document following a specific template. A dedicated
// system prompt keeps each task's instruction surface clean and lets the
// LLM specialize. The trade-off is no shared prefix cache with the chat;
// we accept it because assistant volume is low.

const RFP_SYSTEM_PROMPT = `Você é um especialista sênior em procurement (compras corporativas) com 20 anos de experiência. Seu trabalho aqui é GERAR um draft de RFP (Request for Proposal) completo e profissional em português brasileiro, pronto para o usuário copiar, ajustar e enviar a fornecedores.

## Regras de geração

1. **Siga o template fornecido como esqueleto**. Mantenha as seções na ordem em que aparecem, traduza os placeholders ({{escopo}}, {{categoria}}, etc.) usando os parâmetros do usuário, e expanda cada seção com conteúdo substantivo. NÃO deixe placeholders no output final.

2. **Profundidade técnica de procurement sênior**. Onde o template pedir critérios de avaliação, traga critérios SMART (mensuráveis, ponderáveis), não bullets genéricos. Onde pedir requisitos, separe obrigatórios (must-have) de desejáveis (nice-to-have). Onde pedir cláusulas comerciais, inclua referência a TCO, SLA, garantias, e penalidades.

3. **Fundamentação na base de conhecimento**. Há trechos de artigos da base anexados no contexto. Use-os para enriquecer pontos onde o conteúdo teórico ajuda (segmentação Kraljic, critérios de SRM, governança da Lei 14.133 quando o RFP for público, etc.). NÃO cite autores, IDs ou números entre colchetes na saída — incorpore as ideias como conhecimento próprio.

4. **Aplicação prática concreta**. Cláusulas devem ser executáveis: threshold numérico para o critério, formato da resposta esperada, prazo claro, ferramenta/canal de submissão. Evite "deverá ser entregue conforme padrões de mercado".

5. **Formato Markdown bem estruturado**. Headings (#, ##, ###), tabelas markdown para matrizes de critérios e cronograma, listas numeradas para etapas, **bold** para deadlines e valores críticos. O output será renderizado em chat e convertido para .docx — markdown limpo é essencial.

6. **Não invente fornecedores, cláusulas legais inexistentes, ou benchmarks fabricados**. Se não houver fundamento, use linguagem de "o comprador definirá" / "a ser detalhado pelo comprador" ao invés de inventar.

7. **Não inclua preâmbulo nem epílogo conversacional**. Comece direto pelo título do RFP. Termine na última cláusula. Sem "Aqui está o seu RFP:" ou "Espero que esta versão te ajude!".`;

function formatCriteria(criteria: string[]): string {
  if (criteria.length === 0) return '(usar critérios padrão de procurement sênior)';
  return criteria.map((c) => `- ${c}`).join('\n');
}

function formatChunks(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return '(nenhum trecho relevante recuperado — fundamentar em princípios gerais de procurement)';
  }
  return chunks
    .map((c) => `### Fonte: ${c.articleTitle}\n\n${c.content.slice(0, 800)}`)
    .join('\n\n---\n\n');
}

/**
 * Build the system + user prompts for an RFP generation call.
 *
 * The system stays constant per call (it's the same for every RFP run);
 * the user message carries: the template body, the form params, and the
 * retrieved context chunks.
 *
 * `params` is already zod-validated by the API route.
 */
export function buildRfpPrompt(
  params: RfpParams,
  template: TemplateRow,
  chunks: RetrievedChunk[],
): { system: string; user: string } {
  const paramsBlock = `## Parâmetros do RFP (fornecidos pelo usuário)

- **Escopo**: ${params.scope}
- **Categoria**: ${params.category}
- **Prazo de resposta dos fornecedores**: ${params.deadline}
- **Orçamento estimado**: ${params.budget}
- **Critérios de avaliação prioritários**:
${formatCriteria(params.criteria)}
${params.notes ? `- **Notas adicionais do comprador**: ${params.notes}` : ''}`;

  const templateBlock = `## Template a seguir (estrutura obrigatória)

Nome do template: **${template.name}**
${template.description ? `Descrição: ${template.description}\n` : ''}
\`\`\`markdown
${template.body_md}
\`\`\``;

  const contextBlock = `## Contexto da base de conhecimento (use para fundamentar, NÃO cite)

${formatChunks(chunks)}`;

  const instruction = `## Tarefa

Gere o RFP completo agora. Comece direto pelo título do documento. Use o template como estrutura e preencha cada seção com o conteúdo apropriado, incorporando os parâmetros do usuário e o contexto da base de conhecimento quando relevante. Produza markdown limpo, pronto para renderização e conversão para .docx.`;

  return {
    system: RFP_SYSTEM_PROMPT,
    user: [paramsBlock, templateBlock, contextBlock, instruction].join('\n\n---\n\n'),
  };
}

// Exported for prompt-stability tests.
export { RFP_SYSTEM_PROMPT };
