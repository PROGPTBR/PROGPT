import { z } from 'zod';
import { getOpenAI, getOpenAIModel } from '@/lib/llm/openai';
import { recordApiUsage } from '@/lib/observability/api-usage';
import type { FinancialIndicators } from './types';

// Sub-projeto 30 — Extração estruturada dos 12 indicadores financeiros
// de um PDF (Balanço Patrimonial + DRE) via OpenAI Responses API.
//
// Mesmo padrão do `lib/ingest/multimodal-parse.ts`: input_file inline
// (base64 PDF) quando < 10 MB; >= 10 MB usa Files API. Retorna apenas
// os valores numéricos; o cálculo de score acontece em
// `lib/assistants/financial.ts` deterministicamente.

const INLINE_LIMIT_BYTES = 10 * 1024 * 1024;
const TIMEOUT_MS = 180_000; // PDFs grandes podem levar tempo
const MAX_OUTPUT_TOKENS = 4096;

// Zod schema da resposta estruturada. Tudo opcional — quando o PDF não
// trouxer o número, omitimos a chave e o pillar correspondente entra
// como N/D no scoring.
const ExtractedSchema = z.object({
  receitaLiquida: z.number().nullable().optional(),
  ebitda: z.number().nullable().optional(),
  lucroLiquido: z.number().nullable().optional(),
  margemLiquidaPct: z.number().nullable().optional(),
  margemEbitdaPct: z.number().nullable().optional(),
  dividaLiquidaEbitda: z.number().nullable().optional(),
  liquidezCorrente: z.number().nullable().optional(),
  patrimonioLiquido: z.number().nullable().optional(),
  roePct: z.number().nullable().optional(),
  roicPct: z.number().nullable().optional(),
  endividamentoGeralPct: z.number().nullable().optional(),
  fluxoCaixaOperacional: z.number().nullable().optional(),
  // Optional metadata fields surfaced for diagnostics — not returned to
  // the API caller, but useful in Langfuse traces.
  detectedYear: z.string().nullable().optional(),
  detectedCnpj: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

type ExtractedShape = z.infer<typeof ExtractedSchema>;

const EXTRACT_SYSTEM_PROMPT = `Você é um Analista de Risco de Crédito Bancário lendo um PDF de Balanço Patrimonial e DRE de uma empresa brasileira.

Tarefa: EXTRAIR exatamente estes 12 indicadores financeiros do PDF (e nada além):

1. **receitaLiquida** — Receita Líquida (em R$ milhões; converta de mil para MM se preciso)
2. **ebitda** — EBITDA (R$ MM)
3. **lucroLiquido** — Lucro Líquido (R$ MM)
4. **margemLiquidaPct** — Margem Líquida (%) = Lucro Líquido / Receita Líquida × 100
5. **margemEbitdaPct** — Margem EBITDA (%) = EBITDA / Receita Líquida × 100
6. **dividaLiquidaEbitda** — Dívida Líquida / EBITDA (múltiplo, ex: 2.5)
7. **liquidezCorrente** — Ativo Circulante / Passivo Circulante
8. **patrimonioLiquido** — Patrimônio Líquido (R$ MM)
9. **roePct** — ROE (%) = Lucro Líquido / Patrimônio Líquido × 100
10. **roicPct** — ROIC (%) = NOPAT / Capital Investido × 100
11. **endividamentoGeralPct** — Endividamento Geral (%) = Passivo Total / Ativo Total × 100
12. **fluxoCaixaOperacional** — Fluxo de Caixa Operacional (R$ MM)

REGRAS DE EXTRAÇÃO:
- Use os números mais recentes disponíveis no PDF (último ano fiscal completo).
- Se o PDF tiver múltiplos períodos, use o exercício corrente (mais à direita ou marcado como "atual/2024/2025").
- Padrão brasileiro: vírgula é separador decimal. Converta "1.234,56" → 1234.56.
- Valores em milhões: se o PDF estiver em milhares (R$ mil), divida por 1000 para virar MM.
- Se um valor não estiver disponível no PDF, retorne null para aquele campo (NUNCA invente).
- Para "Negativo" entre parênteses (ex: "(123)"), interprete como -123.
- Em "notes", inclua observações sobre conversões feitas ou ambiguidades (1-2 linhas máximo).
- Em "detectedYear", o ano do exercício extraído (ex: "2024", "2025/2024").
- Em "detectedCnpj", o CNPJ da empresa se aparecer no PDF.

Retorne APENAS o JSON conforme o schema. Sem preâmbulo.`;

type InlineFilePart = { type: 'input_file'; filename: string; file_data: string };
type RemoteFilePart = { type: 'input_file'; file_id: string };
type PdfPart = InlineFilePart | RemoteFilePart;

export class FinancialExtractError extends Error {
  readonly code: 'too_small' | 'timeout' | 'parse_failed' | 'empty';
  constructor(
    code: 'too_small' | 'timeout' | 'parse_failed' | 'empty',
    message: string,
  ) {
    super(message);
    this.code = code;
    this.name = 'FinancialExtractError';
  }
}

export type ExtractFinancialResult = {
  indicators: FinancialIndicators;
  detectedYear?: string;
  detectedCnpj?: string;
  notes?: string;
};

export async function extractFinancialFromPdf(input: {
  buf: Buffer;
  filename: string;
}): Promise<ExtractFinancialResult> {
  if (input.buf.length < 1024) {
    throw new FinancialExtractError(
      'too_small',
      'PDF muito pequeno ou vazio — verifique o arquivo.',
    );
  }

  const ai = getOpenAI();
  const model = getOpenAIModel('generation');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // PDFs grandes vão pela Files API; pequenos ficam inline em base64.
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
      operation: 'assistant-financial-extract',
      model,
      tokensIn: usage?.input_tokens ?? 0,
      tokensOut: usage?.output_tokens ?? 0,
      tokensCached: usage?.input_tokens_details?.cached_tokens ?? 0,
      metadata: { filename: input.filename, bytes: input.buf.length },
    });

    const raw = extractText(res);
    if (!raw || raw.trim().length === 0) {
      throw new FinancialExtractError(
        'empty',
        'A IA não retornou conteúdo. Tente um PDF mais legível.',
      );
    }

    let parsed: ExtractedShape;
    try {
      parsed = ExtractedSchema.parse(JSON.parse(raw));
    } catch (err) {
      throw new FinancialExtractError(
        'parse_failed',
        `Não foi possível interpretar a resposta da IA: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }

    return {
      indicators: stripNulls(parsed),
      detectedYear: parsed.detectedYear ?? undefined,
      detectedCnpj: parsed.detectedCnpj ?? undefined,
      notes: parsed.notes ?? undefined,
    };
  } catch (err) {
    if (err instanceof FinancialExtractError) throw err;
    if ((err as { name?: string })?.name === 'AbortError') {
      throw new FinancialExtractError(
        'timeout',
        `A extração excedeu ${TIMEOUT_MS / 1000}s. PDFs muito grandes podem precisar de redução.`,
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new FinancialExtractError('parse_failed', message);
  } finally {
    clearTimeout(timer);
  }
}

/** Strip null/undefined from the zod-parsed shape, returning a clean
 *  FinancialIndicators object (no diagnostic fields). */
function stripNulls(p: ExtractedShape): FinancialIndicators {
  const out: FinancialIndicators = {};
  const keys: Array<keyof FinancialIndicators> = [
    'receitaLiquida',
    'ebitda',
    'lucroLiquido',
    'margemLiquidaPct',
    'margemEbitdaPct',
    'dividaLiquidaEbitda',
    'liquidezCorrente',
    'patrimonioLiquido',
    'roePct',
    'roicPct',
    'endividamentoGeralPct',
    'fluxoCaixaOperacional',
  ];
  for (const k of keys) {
    const v = p[k];
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  }
  return out;
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
