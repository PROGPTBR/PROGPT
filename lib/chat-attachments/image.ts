import { getOpenAI, getOpenAIModel } from '@/lib/llm/openai';
import { recordApiUsage } from '@/lib/observability/api-usage';

// Describe an image attachment (PNG/JPG) via OpenAI Vision so the chat
// route can stay text-only. The returned description goes into the user
// message as an <anexo>…</anexo> block — RAG, retrieval and streaming
// continue to operate on a pure-text user message.
//
// We use the Responses API (same path the multimodal PDF parser uses)
// with `input_image` parts. The image is sent as a data URL so we don't
// need to hit Supabase Storage just to round-trip the bytes.

const TIMEOUT_MS = 60_000;
const MAX_OUTPUT_TOKENS = 2048;

const SYSTEM_PROMPT = `Você é um extrator literal de imagens (prints de tela, fotos de documento, gráficos, tabelas) para um chat de procurement.

Tarefa: descreva LITERALMENTE o conteúdo da imagem em PT-BR para que outro modelo possa responder perguntas sobre ela sem ter acesso à imagem.

Regras:
- Transcreva TEXTO visível (títulos, labels, células de tabela, valores numéricos) EXATAMENTE como aparece. Use markdown para listas/tabelas.
- Para gráficos: descreva eixos, escalas, séries, e valores legíveis. Estime se preciso ("barra de ~80%").
- Para diagramas/fluxos: liste cada nó e as conexões.
- NÃO interprete intenções, NÃO resuma, NÃO opine. Você é OCR + descrição visual estruturada.
- Se houver ambiguidade ou texto ilegível, marque com [ilegível] em vez de inventar.
- Comece direto pela descrição — sem preâmbulo tipo "esta imagem mostra".`;

export type DescribeImageInput = {
  buf: Buffer;
  mime: string; // 'image/png' | 'image/jpeg'
  filename: string;
};

/**
 * Returns the textual description, or `null` on failure. Failure is
 * fail-soft so the chat attachments endpoint can still surface "this
 * image could not be processed" to the user without 500ing.
 */
export async function describeImageWithVision({
  buf,
  mime,
  filename,
}: DescribeImageInput): Promise<string | null> {
  const ai = getOpenAI();
  const model = getOpenAIModel('generation');
  const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await ai.responses.create(
      {
        model,
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: SYSTEM_PROMPT },
              {
                type: 'input_text',
                text: `Arquivo: ${filename}\n\nDescreva o conteúdo:`,
              },
              // OpenAI Responses API accepts `input_image` with image_url.
              { type: 'input_image', image_url: dataUrl } as never,
            ],
          },
        ],
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
      operation: 'chat-attachment-vision',
      model,
      tokensIn: usage?.input_tokens ?? 0,
      tokensOut: usage?.output_tokens ?? 0,
      tokensCached: usage?.input_tokens_details?.cached_tokens ?? 0,
      metadata: { mime, filename },
    });

    const text = extractText(res);
    return text || null;
  } catch (err) {
    console.warn('[chat-attachments/image] vision failed:', err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The Responses API returns nested `output[].content[].text` chunks. Pull
 * the first text payload — for vision describe we only ever produce one.
 */
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
