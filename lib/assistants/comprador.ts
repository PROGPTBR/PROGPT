import { generateObject, generateText } from 'ai';
import { recordApiUsage } from '@/lib/observability/api-usage';
import { semTravessaoProfundo } from '@/lib/texto/sem-travessao';
import { createOpenAI } from '@ai-sdk/openai';
import { getOpenAIModel } from '@/lib/llm/openai';
import { z } from 'zod';
import { requireEnv } from '@/lib/env';

// Assistant: Comparador de Cotações / Robô Comprador (standalone v1).
// Analisa propostas de fornecedores por custo total (TCO), detecta desvios de
// política de compras e gera um rascunho de Pedido de Compra (PO) com revisão
// humana. Saída estruturada via generateObject (AI SDK + OpenAI).

export const CompradorInputSchema = z.object({
  escopo: z.string().trim().max(8000).optional().default(''),
  // Lote de propostas importadas (até ~40 documentos inteiros).
  propostas: z.string().trim().min(1).max(400_000),
  politica: z.string().trim().max(8000).optional().default(''),
  // Pedido de Cotação (RFQ) original — documento de referência. Opcional:
  // sem ele, a análise segue como sempre (só TCO entre propostas). Mesmo
  // limite de `propostas` (RFQs com muitos itens podem ser longos).
  pedidoCotacao: z.string().trim().max(150_000).optional().default(''),
});
export type CompradorInput = z.infer<typeof CompradorInputSchema>;

const RankingItem = z.object({
  fornecedor: z.string(),
  preco: z.string().describe("Preço dos itens ou 'não informado'."),
  frete: z.string(),
  impostos: z.string(),
  prazo_entrega: z.string(),
  validade: z.string(),
  condicao_pagamento: z.string(),
  custo_total: z.number().describe('Custo total comparável em R$ (0 se indeterminável).'),
  observacoes: z.string(),
});

const POItem = z.object({
  descricao: z.string(),
  quantidade: z.string(),
  valor_unitario: z.string(),
  valor_total: z.number(),
});

// Comparação item a item contra o Pedido de Cotação — ver "## Comparação
// contra o Pedido de Cotação" no SYSTEM_PROMPT.
export const ITEM_STATUS = [
  'correto',
  'ausente',
  'quantidade_divergente',
  'especificacao_alterada',
  'marca_diferente',
  'condicao_diferente',
  'outro',
] as const;
export type ItemStatus = (typeof ITEM_STATUS)[number];

const ItemFornecedorStatus = z.object({
  fornecedor: z.string(),
  status: z.enum(ITEM_STATUS),
  detalhe: z
    .string()
    .describe(
      'Explicação curta e específica (ex.: "pediu 500un, cotou 300un"), ou "conforme solicitado" quando correto.',
    ),
});

const ItemComparativo = z.object({
  item: z.string().describe('Descrição do item conforme o Pedido de Cotação.'),
  quantidade_solicitada: z.string(),
  especificacao_solicitada: z.string(),
  fornecedores: z.array(ItemFornecedorStatus).describe('Status desse item para cada fornecedor.'),
});
export type ItemComparativoRow = z.infer<typeof ItemComparativo>;

const ItemExtra = z.object({
  fornecedor: z.string(),
  item: z.string(),
  detalhe: z.string(),
});

export const CompradorResultSchema = z.object({
  resumo: z.string().describe('Resumo executivo: quantas propostas e o melhor custo-benefício.'),
  ranking: z.array(RankingItem).describe('Uma entrada por fornecedor, do melhor ao pior TCO.'),
  recomendacao_fornecedor: z.string(),
  justificativa: z.string(),
  pontos_negociacao: z.array(z.string()),
  alertas: z.array(z.string()),
  desvios_politica: z.array(z.string()).describe('Desvios de política de compras (vazio se nenhum).'),
  comparativo_itens: z
    .array(ItemComparativo)
    .describe(
      'Comparação item a item contra o Pedido de Cotação. Array VAZIO se nenhum Pedido de Cotação foi fornecido — nesse caso não invente itens.',
    ),
  itens_nao_solicitados: z
    .array(ItemExtra)
    .describe(
      'Itens que algum fornecedor cotou/cobrou mas que NÃO estavam no Pedido de Cotação. Vazio se não houver ou se não houver Pedido de Cotação.',
    ),
  pedido_compra: z.object({
    numero: z.string(),
    fornecedor: z.string(),
    itens: z.array(POItem),
    valor_total: z.number(),
    condicao_pagamento: z.string(),
    prazo_entrega: z.string(),
    observacoes: z.string(),
  }),
  precisa_humano: z.boolean(),
  motivo_escalonamento: z.string(),
  severidade: z.enum(['info', 'warn', 'danger']),
});
export type CompradorResult = z.infer<typeof CompradorResultSchema>;

const LIMITE_AUTONOMIA = 50000;

const SYSTEM_PROMPT = `Você é o Robô Comprador (Comparador de Cotações) da 2BSUPPLY / PROGPT — um Analista de Compras Sênior, analítico e orientado ao Custo Total (TCO).

## Metodologia
1. Padronize cada proposta (preço, frete, impostos, prazo, validade, condição de pagamento). Se faltar um dado, use "não informado" — NUNCA presuma valores.
2. Calcule o custo total comparável em R$ (preço + frete + impostos − descontos) por fornecedor e ranqueie do melhor ao pior.
3. Aponte alertas: divergência de escopo, itens faltantes, preços fora da curva (outliers), condições atípicas.

## Desvios de política (desvios_politica)
Compare contra a POLÍTICA/BASE HOMOLOGADA fornecida e contra boas práticas. Aponte: compra acima da alçada de R$ ${LIMITE_AUTONOMIA.toLocaleString('pt-BR')} sem aprovação; fornecedor não homologado; fonte única sem justificativa; indício de fracionamento; preço/condição atípicos. Vazio se não houver.

## Comparação contra o Pedido de Cotação (quando fornecido)
Se um PEDIDO DE COTAÇÃO foi fornecido, ele é o documento-base da equalização — as propostas devem ser comparadas contra ELE, não só entre si:
1. Extraia do Pedido de Cotação a lista de itens pedidos, com quantidade e especificação de cada um, e as condições comerciais exigidas (prazo, pagamento, local de entrega etc.).
2. Para CADA item extraído, verifique CADA proposta e classifique o status: "correto" (cotado conforme pedido), "ausente" (o fornecedor não cotou esse item), "quantidade_divergente", "especificacao_alterada", "marca_diferente" (produto/marca diferente do solicitado), "condicao_diferente" (prazo/pagamento/entrega diverge do exigido), ou "outro" para qualquer outra inconsistência. Preencha SEMPRE o campo "detalhe" com a explicação específica (ex.: "pediu 500un, cotou 300un"; "pediu marca X, cotou marca Y"), nunca deixe genérico.
3. Se um fornecedor cotou/cobrou algo que não corresponde a NENHUM item do Pedido de Cotação, isso NÃO entra em comparativo_itens (que é organizado por item pedido) — vai em itens_nao_solicitados.
4. **Se NENHUM Pedido de Cotação foi fornecido**, comparativo_itens e itens_nao_solicitados ficam como arrays VAZIOS — não invente itens a partir das próprias propostas, e a análise segue só por TCO como de costume.

## Recomendação e PO
Recomende o melhor fornecedor pelo TCO E pela conformidade com a política (prefira homologado, mesmo que não seja o mais barato), com justificativa explicável. Liste pontos de negociação acionáveis. Gere um rascunho de Pedido de Compra (PO) para o fornecedor recomendado (numero "PO-RASCUNHO", itens com qtd/valor unitário/total, total, condição, prazo). O PO é RASCUNHO: sempre exige revisão humana → quando gerar PO, precisa_humano = true.

## HITL e severidade
precisa_humano = true quando: gerar PO, custo recomendado acima da alçada, houver desvio de política, proposta única, divergência de escopo ou dados críticos faltando.
severidade: "danger" (desvio/acima da alçada/risco), "warn" (dados faltando/ambiguidade), "info" (limpo e dentro da alçada).

Escreva em português simples, para quem não é especialista. NUNCA use travessão (— ou –): use vírgula, ponto ou dois-pontos.

A análise é assistiva e baseada apenas nas propostas fornecidas — não substitui a cotação oficial nem a aprovação formal de Compras. Na dúvida, escale.`;

// ─── Lote grande: toda proposta entra na análise (2026-10-08) ─────────────
// Com dezenas de documentos o texto passa do que cabe numa leitura só e as
// últimas propostas ficariam de fora. Então cada proposta é condensada em
// paralelo (sem perder item, quantidade, preço ou condição) e a comparação
// roda sobre todas.

export type DocumentoProposta = { titulo: string; texto: string };

/** Separa as propostas pelo cabeçalho "### Documento: <arquivo>" da importação. */
export function dividirPropostas(texto: string): DocumentoProposta[] {
  const partes = texto.split(/^### Documento:\s*/m);
  const docs: DocumentoProposta[] = [];
  const antes = partes[0]!.trim();
  if (antes) docs.push({ titulo: 'Proposta colada', texto: antes });
  for (const p of partes.slice(1)) {
    const quebra = p.indexOf('\n');
    const titulo = (quebra < 0 ? p : p.slice(0, quebra)).trim() || 'Documento';
    const corpo = (quebra < 0 ? '' : p.slice(quebra + 1)).trim();
    if (corpo) docs.push({ titulo, texto: corpo });
  }
  return docs;
}

export const LOTE_GRANDE_CARACTERES = 60_000;
export const LOTE_GRANDE_DOCUMENTOS = 6;

export function precisaCondensar(docs: DocumentoProposta[]): boolean {
  const total = docs.reduce((n, d) => n + d.texto.length, 0);
  return docs.length > LOTE_GRANDE_DOCUMENTOS || total > LOTE_GRANDE_CARACTERES;
}

const CONDENSAR_SYSTEM = `Você extrai os dados de UMA proposta comercial de fornecedor para comparação de compras.
Reescreva a proposta de forma compacta, SEM omitir nada que importe para comparar:
- Fornecedor (nome, CNPJ se houver) e contato.
- TODOS os itens, um por linha: descrição/especificação, marca, quantidade, unidade, preço unitário e total.
- Frete, impostos (inclusos ou não), descontos, condição de pagamento, prazo de entrega, validade, garantia.
- Exceções, ressalvas, itens não cotados e observações.
Nunca resuma vários itens num só, nunca invente valores: o que não estiver na proposta, escreva "não informado".
Responda só com o texto compacto, em português, sem travessão.`;

async function condensarProposta(doc: DocumentoProposta, model: string, openai: ReturnType<typeof createOpenAI>): Promise<string> {
  try {
    const out = await generateText({
      model: openai(model),
      system: CONDENSAR_SYSTEM,
      messages: [{ role: 'user', content: `Arquivo: ${doc.titulo}\n\n${doc.texto}` }],
    });
    void recordApiUsage({
      provider: 'openai',
      operation: 'comprador-condense',
      model,
      tokensIn: out.usage.promptTokens,
      tokensOut: out.usage.completionTokens,
      callCount: 1,
    });
    return out.text.trim() || doc.texto.slice(0, 15_000);
  } catch (err) {
    // Falhou a condensação: a proposta entra assim mesmo (começo do texto),
    // nunca some da análise.
    console.warn('[comprador] condensar falhou:', doc.titulo, err instanceof Error ? err.message : err);
    return doc.texto.slice(0, 15_000);
  }
}

/** Condensa todas as propostas, algumas ao mesmo tempo, mantendo a ordem. */
export async function condensarTodas(
  docs: DocumentoProposta[],
  condensar: (d: DocumentoProposta) => Promise<string>,
  simultaneos = 5,
): Promise<string[]> {
  const out: string[] = new Array(docs.length);
  let proximo = 0;
  await Promise.all(
    Array.from({ length: Math.min(simultaneos, docs.length) }, async () => {
      while (proximo < docs.length) {
        const i = proximo++;
        out[i] = await condensar(docs[i]!);
      }
    }),
  );
  return out;
}

export async function analyzeComprador(input: CompradorInput): Promise<{
  result: CompradorResult;
  usage: { tokensIn: number; tokensOut: number; tokensCached: number };
  model: string;
}> {
  const openai = createOpenAI({ apiKey: requireEnv('OPENAI_API_KEY') });
  const model = getOpenAIModel('generation');

  const docs = dividirPropostas(input.propostas);
  let propostas = input.propostas;
  if (precisaCondensar(docs)) {
    const condensadas = await condensarTodas(docs, (d) => condensarProposta(d, model, openai));
    propostas = docs.map((d, i) => `### Documento: ${d.titulo}\n${condensadas[i]}`).join('\n\n');
  }
  const listaDocs =
    docs.length > 1
      ? `\n\nSão ${docs.length} documentos. Analise TODOS, sem deixar nenhum de fora: ${docs.map((d) => d.titulo).join('; ')}.`
      : '';

  const out = await generateObject({
    model: openai(model),
    system: SYSTEM_PROMPT,
    schema: CompradorResultSchema,
    messages: [
      {
        role: 'user',
        content: `Compare as propostas, detecte desvios de política e gere o rascunho de PO.${listaDocs}

ESCOPO / REQUISIÇÃO:
${input.escopo || '(não detalhado)'}

PEDIDO DE COTAÇÃO (documento de referência — compare cada proposta contra isto):
${input.pedidoCotacao || '(não fornecido — compare as propostas apenas entre si por TCO, sem checar contra um pedido original; comparativo_itens e itens_nao_solicitados ficam vazios)'}

PROPOSTAS RECEBIDAS:
${propostas}

POLÍTICA DE COMPRAS / BASE HOMOLOGADA:
${input.politica || '(não fornecida — avalie por boas práticas e pela alçada)'}`,
      },
    ],
  });

  const tokensCached = (() => {
    const v = out.providerMetadata?.openai?.cachedPromptTokens;
    return typeof v === 'number' ? v : 0;
  })();

  return {
    result: semTravessaoProfundo(out.object),
    usage: { tokensIn: out.usage.promptTokens, tokensOut: out.usage.completionTokens, tokensCached },
    model,
  };
}
