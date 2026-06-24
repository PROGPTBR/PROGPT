import { z } from 'zod';
import { getOpenAI, getOpenAIModel } from '@/lib/llm/openai';
import { recordApiUsage } from '@/lib/observability/api-usage';
import { SPEND_CATEGORIES, coerceSpendCategory } from './taxonomy';
import type { SpendInvoiceFields } from './types';

// Spend Analysis (fase 1) — extração estruturada dos campos de uma invoice
// (PDF, playbook §3.2 + §3.3) via OpenAI Responses API.
//
// Mesmo padrão de `lib/assistants/financial-extract.ts`: input_file inline
// (base64 PDF) quando < 10 MB; >= 10 MB usa Files API. Retorna os campos da
// nota + 1 categoria + justificativa. A classificação de quem falhar aqui é
// refeita determinísticamente / via LLM no pipeline (lib/spend/classify.ts).

const INLINE_LIMIT_BYTES = 10 * 1024 * 1024;
const TIMEOUT_MS = 180_000;
const MAX_OUTPUT_TOKENS = 2048;

// Tudo opcional/nullable — quando o PDF não trouxer o campo, omitimos.
const ExtractedSchema = z.object({
  invoiceNumber: z.string().nullable().optional(),
  poNumber: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  currency: z.string().nullable().optional(),
  total: z.number().nullable().optional(),
  paymentTerms: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  supplier: z.string().nullable().optional(),
  invoiceDate: z.string().nullable().optional(), // YYYY-MM-DD
  category: z.string().nullable().optional(),
  categoryJustification: z.string().nullable().optional(),
  lowConfidence: z.boolean().nullable().optional(),
  ocrUsed: z.boolean().nullable().optional(),
});

type ExtractedShape = z.infer<typeof ExtractedSchema>;

const EXTRACT_SYSTEM_PROMPT = `Você é um Analista de Compras lendo o PDF de UMA invoice (nota fiscal / fatura) de uma empresa.

Tarefa: EXTRAIR os campos da nota e classificá-la em UMA categoria. Retorne APENAS o JSON do schema.

CAMPOS:
1. **invoiceNumber** — número da invoice ("Invoice No.", "Facture N°", "Nº da NF"). Pode diferir do nome do arquivo.
2. **poNumber** — número do pedido de compra ("PO No.", "Purchase Order", "Your PO Number"). Se NÃO houver, retorne "Sem PO".
3. **country** — país da ENTIDADE QUE RECEBE a fatura (não o do fornecedor). Use o nome do país em português quando possível (ex.: "Brasil", "Estados Unidos", "Índia").
4. **currency** — código ISO da moeda do total (ex.: "USD", "EUR", "BRL", "INR"). Deduza do símbolo se necessário.
5. **total** — VALOR TOTAL FINAL (com impostos): "Total", "Grand Total", "Total a Pagar", "Total TTC", "Net Payable". Apenas o número.
6. **paymentTerms** — condição de pagamento ("Net 30/45/60", "Due on receipt", "Vencimento", "Échéance"). Normalize (ex.: "Net 60 days"). "Não informado" se ausente.
7. **description** — resumo de 1 frase do serviço/material faturado (linhas de item / "Bill for" / "Description").
8. **supplier** — nome do fornecedor (cabeçalho / dados bancários / remetente).
9. **invoiceDate** — data de emissão no formato YYYY-MM-DD ("Date", "Data de emissão"). Converta de qualquer formato.
10. **category** — UMA categoria EXATAMENTE desta lista:
${SPEND_CATEGORIES.map((c) => `   - ${c}`).join('\n')}
11. **categoryJustification** — 1 frase explicando o critério da categoria.

REGRAS:
- Padrão brasileiro/europeu: vírgula pode ser separador decimal. "1.234,56" → 1234.56; "1,234.56" → 1234.56. Deduza pelo contexto.
- Valor negativo entre parênteses "(123)" → -123.
- NUNCA invente: campo ausente no PDF → null (exceto poNumber → "Sem PO", paymentTerms → "Não informado").
- Marque **lowConfidence: true** quando o documento for ambíguo, ilegível, ou você tiver baixa certeza de algum campo crítico (total, moeda, fornecedor).
- Marque **ocrUsed: true** se o PDF parecer escaneado / imagem (texto não-selecionável) — esses valores exigem conferência.

Retorne APENAS o JSON conforme o schema. Sem preâmbulo.`;

type InlineFilePart = { type: 'input_file'; filename: string; file_data: string };
type RemoteFilePart = { type: 'input_file'; file_id: string };
type PdfPart = InlineFilePart | RemoteFilePart;

export class SpendExtractError extends Error {
  readonly code: 'too_small' | 'timeout' | 'parse_failed' | 'empty';
  constructor(
    code: 'too_small' | 'timeout' | 'parse_failed' | 'empty',
    message: string,
  ) {
    super(message);
    this.code = code;
    this.name = 'SpendExtractError';
  }
}

/**
 * Extrai os campos de UMA invoice de um PDF. Lança `SpendExtractError` em
 * falha — o pipeline captura por-nota e marca a linha como `error`/`needs_review`
 * sem derrubar o run inteiro.
 */
export async function extractInvoiceFromPdf(input: {
  buf: Buffer;
  filename: string;
}): Promise<SpendInvoiceFields> {
  if (input.buf.length < 1024) {
    throw new SpendExtractError(
      'too_small',
      'PDF muito pequeno ou vazio — verifique o arquivo.',
    );
  }

  const ai = getOpenAI();
  const model = getOpenAIModel('generation');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    let pdfPart: PdfPart;
    if (input.buf.length < INLINE_LIMIT_BYTES) {
      const base64 = input.buf.toString('base64');
      pdfPart = {
        type: 'input_file',
        filename: input.filename,
        file_data: `data:application/pdf;base64,${base64}`,
      };
    } else {
      const file = await ai.files.create({
        file: new File([new Uint8Array(input.buf)], input.filename, {
          type: 'application/pdf',
        }),
        purpose: 'user_data',
      });
      pdfPart = { type: 'input_file', file_id: file.id };
    }

    const res = await ai.responses.create(
      {
        model,
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: EXTRACT_SYSTEM_PROMPT },
              pdfPart as never,
            ],
          },
        ],
        text: { format: { type: 'json_object' } },
        max_output_tokens: MAX_OUTPUT_TOKENS,
      },
      { signal: controller.signal },
    );

    const usage = (
      res as {
        usage?: {
          input_tokens?: number;
          output_tokens?: number;
          input_tokens_details?: { cached_tokens?: number };
        };
      }
    ).usage;
    void recordApiUsage({
      provider: 'openai',
      operation: 'assistant-spend-extract',
      model,
      tokensIn: usage?.input_tokens ?? 0,
      tokensOut: usage?.output_tokens ?? 0,
      tokensCached: usage?.input_tokens_details?.cached_tokens ?? 0,
      metadata: { filename: input.filename, bytes: input.buf.length },
    });

    const raw = extractText(res);
    if (!raw || raw.trim().length === 0) {
      throw new SpendExtractError(
        'empty',
        'A IA não retornou conteúdo. Tente um PDF mais legível.',
      );
    }

    let parsed: ExtractedShape;
    try {
      parsed = ExtractedSchema.parse(JSON.parse(raw));
    } catch (err) {
      throw new SpendExtractError(
        'parse_failed',
        `Não foi possível interpretar a resposta da IA: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }

    return normalizeFields(parsed);
  } catch (err) {
    if (err instanceof SpendExtractError) throw err;
    if ((err as { name?: string })?.name === 'AbortError') {
      throw new SpendExtractError(
        'timeout',
        `A extração excedeu ${TIMEOUT_MS / 1000}s. PDFs muito grandes podem precisar de redução.`,
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new SpendExtractError('parse_failed', message);
  } finally {
    clearTimeout(timer);
  }
}

/** Limpa a resposta crua: nulls → undefined, categoria coerced à taxonomia. */
function normalizeFields(p: ExtractedShape): SpendInvoiceFields {
  const str = (v: string | null | undefined): string | undefined => {
    const t = (v ?? '').trim();
    return t.length > 0 ? t : undefined;
  };
  const category = coerceSpendCategory(p.category) ?? undefined;
  return {
    invoiceNumber: str(p.invoiceNumber) ?? null,
    poNumber: str(p.poNumber) ?? null,
    country: str(p.country) ?? null,
    currency: str(p.currency)?.toUpperCase() ?? null,
    total: typeof p.total === 'number' && Number.isFinite(p.total) ? p.total : null,
    paymentTerms: str(p.paymentTerms) ?? null,
    description: str(p.description) ?? null,
    supplier: str(p.supplier) ?? null,
    invoiceDate: str(p.invoiceDate) ?? null,
    // categoria fica null se o LLM devolveu algo fora da taxonomia → re-classifica depois
    category: category ?? null,
    categoryJustification: str(p.categoryJustification) ?? null,
    lowConfidence: p.lowConfidence === true || category == null,
    ocrUsed: p.ocrUsed === true,
  };
}

function extractText(res: unknown): string {
  const r = res as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };
  if (typeof r.output_text === 'string' && r.output_text.length > 0) {
    return r.output_text;
  }
  const blocks = r.output ?? [];
  for (const b of blocks) {
    for (const c of b.content ?? []) {
      if (c.type?.startsWith('output_text') && typeof c.text === 'string') {
        return c.text;
      }
    }
  }
  return '';
}

export const _testing = { normalizeFields, ExtractedSchema };
