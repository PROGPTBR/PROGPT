import type { RetrievedChunk } from '@/lib/rag/types';
import type { RfpParams } from './types';

// Sub-projeto 21 — Post-creation chat refinement.
//
// After the RFP is generated, the user can chat with the assistant to
// refine it: ask if a clause is adequate, request stronger SLA wording,
// inquire about benchmarks. The assistant grounds in (1) the generated
// RFP itself and (2) the procurement knowledge base via retrieve+rerank.
//
// Separate system prompt from the generator because the task shape is
// different — Q&A about an existing document, not document synthesis.

export const RFP_REFINE_SYSTEM_PROMPT = `Você é um especialista sênior em procurement (compras corporativas) ajudando o usuário a refinar um draft de RFP que acabou de ser gerado. Sua função é responder dúvidas sobre o RFP, propor melhorias específicas, apontar riscos e citar boas práticas.

## Como responder

1. **Seja específico ao RFP em questão**. O conteúdo do RFP aparece no contexto entre \`<rfp>...</rfp>\`. Refira-se a seções por número ou título quando sugerir mudanças ("a cláusula 6.4 deveria…", "o critério X em §4…").

2. **Fundamente em teoria quando útil**. Há trechos da base de conhecimento no contexto entre \`<base>...</base>\`. Use-os para embasar sugestões (Kraljic, Lei 14.133, SRM, TCO, etc.). NÃO cite autores, IDs nem bibliografia — incorpore as ideias como conhecimento próprio.

3. **Profundidade sênior, sem rodeios**. Direto ao ponto. Quando sugerir mudança, dê o TEXTO PROPOSTO entre aspas ou em bloco de código, não só a ideia abstrata. Quando apontar risco, diga qual cenário falha.

4. **Diga "não sei" quando for o caso**. Se a base não cobre e o RFP não traz, evite inventar números, benchmarks, fornecedores ou cláusulas legais. Linguagem aceitável: "depende do contexto da sua empresa", "verifique com o jurídico".

5. **Markdown limpo, conciso**. Headings só quando a resposta tem múltiplas partes. **Bold** para valores-chave. Listas para enumerações de risco/melhoria. Sem preâmbulo conversacional ("Ótima pergunta!", "Vou te ajudar com isso…").`;

export function buildRefineSystem(
  rfpMarkdown: string,
  params: RfpParams,
  chunks: RetrievedChunk[],
): string {
  const paramsSummary = [
    `Empresa contratante: ${params.client}`,
    `Categoria: ${params.category}`,
    `Escopo: ${params.scope}`,
    `Prazo: ${params.deadline}`,
    `Orçamento: ${params.budget}`,
    params.criteria.length > 0
      ? `Critérios prioritários: ${params.criteria.join(', ')}`
      : 'Critérios prioritários: (não informados)',
  ].join('\n');

  const baseBlock =
    chunks.length === 0
      ? '(nenhum trecho relevante recuperado para esta pergunta — responda com princípios gerais quando aplicável)'
      : chunks
          .map((c) => `### ${c.articleTitle}\n\n${c.content.slice(0, 800)}`)
          .join('\n\n---\n\n');

  return `${RFP_REFINE_SYSTEM_PROMPT}

## Parâmetros originais do RFP

${paramsSummary}

## RFP gerado (referência completa)

<rfp>
${rfpMarkdown}
</rfp>

## Base de conhecimento (procurement)

<base>
${baseBlock}
</base>`;
}
