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
  // Mesmo item, escrito de outro jeito (nome técnico × nome comercial, código
  // do fabricante, sinônimo). NÃO é divergência — o fornecedor atendeu.
  'equivalente',
  'ausente',
  // Existe um item candidato na proposta, mas os dados não bastam pra afirmar
  // que é o mesmo. Fica pro comprador decidir — melhor que chamar de ausente.
  'verificar',
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
  descricao_fornecedor: z
    .string()
    .describe(
      'Como ESTE fornecedor descreveu o item na proposta, com as palavras dele. "—" quando não cotou. É o que permite ao comprador conferir se a correspondência está certa.',
    ),
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

export const SYSTEM_PROMPT = `Você é o Robô Comprador (Comparador de Cotações) da 2BSUPPLY / PROGPT — um Analista de Compras Sênior, analítico e orientado ao Custo Total (TCO).

## Metodologia
1. Padronize cada proposta (preço, frete, impostos, prazo, validade, condição de pagamento). Se faltar um dado, use "não informado" — NUNCA presuma valores.
2. Calcule o custo total comparável em R$ (preço + frete + impostos − descontos) por fornecedor e ranqueie do melhor ao pior.
3. Aponte alertas: divergência de escopo, itens faltantes, preços fora da curva (outliers), condições atípicas.

## Desvios de política (desvios_politica)
Compare contra a POLÍTICA/BASE HOMOLOGADA fornecida e contra boas práticas. Aponte: compra acima da alçada de R$ ${LIMITE_AUTONOMIA.toLocaleString('pt-BR')} sem aprovação; fornecedor não homologado; fonte única sem justificativa; indício de fracionamento; preço/condição atípicos. Vazio se não houver.

## Comparação contra o Pedido de Cotação (quando fornecido)
Se um PEDIDO DE COTAÇÃO foi fornecido, ele é o documento-base da equalização — as propostas devem ser comparadas contra ELE, não só entre si:
1. Extraia do Pedido de Cotação a lista de itens pedidos, com quantidade e especificação de cada um, e as condições comerciais exigidas (prazo, pagamento, local de entrega etc.).

2. **Antes de classificar, FAÇA A CORRESPONDÊNCIA dos itens — e ela é pelo que o item É, nunca pelo texto da descrição.** Comprador e fornecedor quase nunca escrevem o mesmo item do mesmo jeito: o comprador usa o nome comercial ou interno da empresa, o fornecedor usa o nome técnico, o código do fabricante, uma abreviação, outra ordem das palavras, outra unidade. **Isso é normal e NÃO é erro.** Trate como o MESMO item quando a função e as características mensuráveis batem (ou pelo menos não se contradizem): dimensões, material, capacidade, potência, norma técnica, aplicação. Exemplos do mesmo item: "cantoneira de proteção de carga" × "perfil L de papelão kraft 60×60×3mm"; "fita crepe" × "fita adesiva de papel 48mm"; "disjuntor 3×50A" × "DJ TRIPOLAR 50A CURVA C".

3. Só então classifique o status de CADA item para CADA proposta:
   - **"correto"** — cotado conforme o pedido, com a mesma descrição ou quase.
   - **"equivalente"** — é o MESMO item, só descrito de outro jeito (nome técnico × comercial, código do fabricante, sinônimo, abreviação). **Não é divergência: o fornecedor atendeu.** Use este status à vontade — é o caso mais comum numa cotação real.
   - **"ausente"** — a proposta não tem NENHUMA linha da mesma natureza. Quando o fornecedor realmente deixou o item de fora, diga "ausente" com todas as letras: é informação que o comprador precisa. Mas duas coisas NUNCA são ausência: redação diferente, e linha da mesma natureza com medida/material/marca divergente — essa segunda é divergência ("especificacao_alterada", "marca_diferente"), e o comprador precisa VER o que foi oferecido no lugar, não um vazio.
   - **"verificar"** — existe uma linha candidata na proposta, mas falta dado pra afirmar que é o mesmo item. Só use quando houver essa linha candidata; a dúvida a resolver é "é o mesmo item?", nunca "ele cotou alguma coisa?". Entre "equivalente" e "ausente" com uma candidata na mão, escolha "verificar": custa uma conferida ao comprador, enquanto um "ausente" errado faz ele descartar uma proposta válida.
   - **"quantidade_divergente"**, **"marca_diferente"**, **"condicao_diferente"** (prazo/pagamento/entrega diverge do exigido), **"outro"**.
   - **"especificacao_alterada"** — SOMENTE quando uma característica MENSURÁVEL diverge de verdade (dimensão, material, capacidade, norma, acabamento). Jamais porque a redação é diferente.

4. Preencha SEMPRE dois campos por fornecedor. **"descricao_fornecedor"**: as palavras literais que o fornecedor usou, ou "—" quando não há nenhuma linha correspondente — e **se for "—", o status só pode ser "ausente"**, porque sem linha candidata não há o que verificar. **"detalhe"**: a explicação específica — em "equivalente", o porquê do casamento (ex.: "mesma peça: perfil L kraft 60×60×3mm"); em divergência, o que diverge (ex.: "pediu 500un, cotou 300un"). Nunca deixe genérico.

5. Depois de classificar tudo, **varra cada linha de cada proposta** e pergunte: esta linha já foi usada como correspondência de algum item do pedido? As que sobrarem foram cotadas/cobradas sem terem sido pedidas — vão TODAS em itens_nao_solicitados (não entram em comparativo_itens, que é organizado por item pedido). É dinheiro na fatura que o comprador não pediu, então não deixe passar; só confirme antes que a linha não é apenas a forma do fornecedor escrever um item que foi pedido.

6. **Se NENHUM Pedido de Cotação foi fornecido**, comparativo_itens e itens_nao_solicitados ficam como arrays VAZIOS — não invente itens a partir das próprias propostas, e a análise segue só por TCO como de costume.

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
