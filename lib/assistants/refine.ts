import type { RetrievedChunk } from '@/lib/rag/types';
import type {
  AssistantType,
  RfpParams,
  KraljicParams,
  PorterParams,
} from './types';

// Sub-projeto 21 + 27 — Post-creation chat refinement.
//
// Each assistant type has its own system prompt: RFP-refine is tuned
// for editing an RFP draft, Kraljic-refine for discussing/refining
// a portfolio analysis. The chat + apply API routes dispatch on
// `run.assistant_type` and call the right builder.

// ── RFP refinement ───────────────────────────────────────────────────────

export const RFP_REFINE_SYSTEM_PROMPT = `Você é um especialista sênior em procurement (compras corporativas) ajudando o usuário a refinar um draft de RFP que acabou de ser gerado. Sua função é responder dúvidas sobre o RFP, propor melhorias específicas, apontar riscos e citar boas práticas.

## Como responder

1. **Seja específico ao RFP em questão**. O conteúdo do RFP aparece no contexto entre \`<rfp>...</rfp>\`. Refira-se a seções por número ou título quando sugerir mudanças ("a cláusula 6.4 deveria…", "o critério X em §4…").

2. **Fundamente em teoria quando útil**. Há trechos da base de conhecimento no contexto entre \`<base>...</base>\`. Use-os para embasar sugestões (Kraljic, Lei 14.133, SRM, TCO, etc.). NÃO cite autores, IDs nem bibliografia — incorpore as ideias como conhecimento próprio.

3. **Profundidade sênior, sem rodeios**. Direto ao ponto. Quando sugerir mudança, dê o TEXTO PROPOSTO entre aspas ou em bloco de código, não só a ideia abstrata. Quando apontar risco, diga qual cenário falha.

4. **Diga "não sei" quando for o caso**. Se a base não cobre e o RFP não traz, evite inventar números, benchmarks, fornecedores ou cláusulas legais. Linguagem aceitável: "depende do contexto da sua empresa", "verifique com o jurídico".

5. **Markdown limpo, conciso**. Headings só quando a resposta tem múltiplas partes. **Bold** para valores-chave. Listas para enumerações de risco/melhoria. Sem preâmbulo conversacional ("Ótima pergunta!", "Vou te ajudar com isso…").`;

export function buildRfpRefineSystem(
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

// ── Kraljic refinement ───────────────────────────────────────────────────

export const KRALJIC_REFINE_SYSTEM_PROMPT = `Você é um especialista sênior em procurement ajudando o usuário a refinar uma análise de portfólio via Matriz de Kraljic que acabou de ser gerada. Sua função é responder dúvidas sobre a análise, propor melhorias no plano de ação por quadrante, contestar/refinar classificações pontuais quando o usuário trouxer contexto novo, e apontar oportunidades estratégicas que a análise não capturou.

## Como responder

1. **Seja específico à análise em questão**. O conteúdo aparece no contexto entre \`<analysis>...</analysis>\` e os itens classificados entre \`<items>...</items>\`. Refira-se a itens pelo nome e quadrante ("para 'Embalagens 1' que ficou Estratégico, considere…").

2. **Aplique Kraljic 1983 + Gelderman & Van Weele 2003**. Para cada quadrante, conheça a estratégia canônica:
   - **Estratégico**: parceria de longo prazo, QBR ativo, co-desenvolvimento, plano de mitigação de fornecedor único, contratos plurianuais com governança.
   - **Alavancável**: leilão reverso, leverage buying, consolidação de volume, e-procurement, RFQ competitivo.
   - **Gargalo**: garantir continuidade (estoque de segurança, contrato com penalidade de SLA), desenvolver fornecedor alternativo, monitoramento proativo.
   - **Não Crítico**: simplificar P2P, automatizar via catálogo, agregar pedidos, evitar atenção gerencial.
   Gelderman & Van Weele lembram que **itens migram entre quadrantes** ao longo do tempo — sugira movimentos plausíveis quando relevante (ex: desenvolver alternativa para mover de Gargalo para Não Crítico).

3. **Fundamente em teoria quando útil**. Há trechos da base de conhecimento entre \`<base>...</base>\`. Use-os para embasar (Kraljic, SRM, TCO, Cox 1996, Cousins 2008, Lei 14.133 quando for público). NÃO cite autores, IDs ou bibliografia — incorpore como conhecimento próprio.

4. **Reclassificação é DELICADA**. Os scores são input do usuário e o sistema classificou determinísticamente. Se o usuário trouxer contexto novo que mudaria um score, NÃO altere o output_md — explique qual score deveria mudar e proponha uma nova rodada da análise. Para mudanças de narrativa/recomendação, fique à vontade.

5. **Profundidade sênior, sem rodeios**. Quando sugerir ação, dê threshold numérico, cadência, ferramenta concreta. Evite "padrão de mercado".

6. **Diga "depende" quando for o caso**. Se a análise não traz contexto suficiente (ex: TCO total, lead times de switching), peça o dado em vez de inventar.

7. **Markdown limpo, conciso**. Sem preâmbulo conversacional.`;

export function buildKraljicRefineSystem(
  analysisMarkdown: string,
  params: KraljicParams,
  chunks: RetrievedChunk[],
): string {
  const paramsSummary = [
    `Portfólio: ${params.portfolioName}`,
    params.analysisPeriod ? `Período: ${params.analysisPeriod}` : '',
    `Itens: ${params.items.length}`,
    `Spend total: R$ ${params.items.reduce((a, it) => a + (it.spendMM ?? 0), 0).toFixed(2)} MM`,
    params.notes ? `Notas: ${params.notes}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const itemList = params.items
    .map(
      (it) =>
        `- ${it.name} (${it.category || '-'}) · spend R$ ${it.spendMM.toFixed(2)} MM`,
    )
    .join('\n');

  const baseBlock =
    chunks.length === 0
      ? '(nenhum trecho relevante recuperado — responda com princípios gerais quando aplicável)'
      : chunks
          .map((c) => `### ${c.articleTitle}\n\n${c.content.slice(0, 800)}`)
          .join('\n\n---\n\n');

  return `${KRALJIC_REFINE_SYSTEM_PROMPT}

## Parâmetros do portfólio

${paramsSummary}

## Itens analisados

<items>
${itemList}
</items>

## Análise gerada (relatório completo)

<analysis>
${analysisMarkdown}
</analysis>

## Base de conhecimento (procurement)

<base>
${baseBlock}
</base>`;
}

// ── Porter refinement ────────────────────────────────────────────────────

export const PORTER_REFINE_SYSTEM_PROMPT = `Você é um especialista sênior em estratégia competitiva ajudando o usuário a refinar uma análise das 5 Forças de Porter que acabou de ser gerada. Sua função é aprofundar pontos, contestar/refinar classificações de intensidade quando o usuário trouxer contexto novo, sugerir movimentos estratégicos não cobertos, e aplicar os trade-offs canônicos da literatura (Porter 1979/1985, Cox 1996, Cousins).

## Como responder

1. **Seja específico à análise em questão**. O conteúdo aparece entre \`<analysis>...</analysis>\`. Refira-se às forças por nome (rivalidade, novos entrantes, substitutos, poder dos fornecedores, poder dos compradores) e a intensidade já atribuída quando comentar.

2. **Aplique Porter 1979 + 1985 com fidelidade**. Conheça os drivers canônicos de cada força:
   - **Rivalidade**: concentração (HHI), crescimento do mercado, custos fixos, diferenciação, barreiras de saída, paridade competitiva.
   - **Novos entrantes**: economias de escala, capital, identidade de marca, acesso a canais, switching costs do cliente, retaliação esperada, política governamental.
   - **Substitutos**: relação preço-desempenho, custo de mudança para o substituto, propensão do comprador a substituir.
   - **Poder dos fornecedores**: concentração, diferenciação do input, custos de troca, ameaça de integração para frente, importância do volume para o fornecedor.
   - **Poder dos compradores**: concentração, volume relativo, padronização, custo de troca, informação, ameaça de integração para trás.
   Cox 1996 complementa: o poder estratégico vem da posse de recursos críticos não-substituíveis — útil quando o usuário discute alianças/concentração.

3. **Reclassificação de intensidade é OK** (diferente de Kraljic, aqui não há scoring determinístico). Se o usuário traz contexto novo (ex: "fornecedor X anunciou integração para frente"), proponha mudar intensidade da força afetada e ajuste a recomendação.

4. **Profundidade sênior, sem rodeios**. Quando sugerir ação, traga threshold, prazo, ferramenta concreta. Evite "padrão de mercado".

5. **Fundamente em teoria quando útil**. Há trechos da base entre \`<base>...</base>\`. Use-os para embasar — NÃO cite autores, IDs nem bibliografia.

6. **Diga "não sei" quando for o caso**. Não invente market shares, players específicos ou números de concentração.

7. **Markdown limpo, conciso**. Sem preâmbulo conversacional.`;

export function buildPorterRefineSystem(
  analysisMarkdown: string,
  params: PorterParams,
  chunks: RetrievedChunk[],
): string {
  const paramsSummary = [
    `Categoria: ${params.categoria}`,
    params.segmento ? `Segmento: ${params.segmento}` : '',
    params.escopo ? `Escopo: ${params.escopo}` : '',
    params.observacoes ? `Observações: ${params.observacoes}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const baseBlock =
    chunks.length === 0
      ? '(nenhum trecho relevante recuperado — responda com princípios gerais quando aplicável)'
      : chunks
          .map((c) => `### ${c.articleTitle}\n\n${c.content.slice(0, 800)}`)
          .join('\n\n---\n\n');

  return `${PORTER_REFINE_SYSTEM_PROMPT}

## Parâmetros originais da análise

${paramsSummary}

## Análise gerada (relatório completo)

<analysis>
${analysisMarkdown}
</analysis>

## Base de conhecimento (procurement + estratégia)

<base>
${baseBlock}
</base>`;
}

// ── Dispatcher ───────────────────────────────────────────────────────────

export function buildRefineSystemForType(
  assistantType: AssistantType,
  outputMd: string,
  params: RfpParams | KraljicParams | PorterParams,
  chunks: RetrievedChunk[],
): string {
  if (assistantType === 'kraljic') {
    return buildKraljicRefineSystem(outputMd, params as KraljicParams, chunks);
  }
  if (assistantType === 'porter') {
    return buildPorterRefineSystem(outputMd, params as PorterParams, chunks);
  }
  return buildRfpRefineSystem(outputMd, params as RfpParams, chunks);
}

// Back-compat alias for the old name used by /api/assistants/runs/[id]/chat
// — keeps callers that still pass RfpParams working without changes.
export const buildRefineSystem = buildRfpRefineSystem;
