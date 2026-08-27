import { parseSource } from '@/lib/ingest/parse-source';
import { parseXlsxToMarkdown } from './xlsx';
import { describeImageWithVision } from './image';
import { extractInvoiceFromPdf } from '@/lib/spend/invoice-extract';
import type { SpendInvoiceFields } from '@/lib/spend/types';
import { recordApiUsage } from '@/lib/observability/api-usage';

// Dispatcher for chat attachment parsing. Each accepted mime gets routed
// to the appropriate handler, the resulting text is normalized to UTF-8
// markdown, and the output is capped at MAX_PARSED_CHARS so we don't
// blow the gpt-4o-mini context budget when the user sends a huge PDF
// followed by a long question.

export const MAX_PARSED_CHARS = 8000;

export const ACCEPTED_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'image/png',
  'image/jpeg',
]);

// Per-mime max upload size in bytes. PDFs get the most because multimodal
// parsing is meaningful there.
export const SIZE_LIMITS: Record<string, number> = {
  'application/pdf': 10 * 1024 * 1024,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    5 * 1024 * 1024,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    5 * 1024 * 1024,
  'image/png': 5 * 1024 * 1024,
  'image/jpeg': 5 * 1024 * 1024,
};

export type AttachmentKind = 'pdf' | 'docx' | 'xlsx' | 'image';

export type ParsedAttachment = {
  kind: AttachmentKind;
  filename: string;
  sizeBytes: number;
  parsedText: string; // already capped + cleaned
  truncated: boolean;
  parser?: string; // for PDF/DOCX: which sub-parser fired
};

export class AttachmentParseError extends Error {
  readonly code: 'unsupported_mime' | 'parse_failed' | 'empty';
  constructor(code: 'unsupported_mime' | 'parse_failed' | 'empty', message: string) {
    super(message);
    this.code = code;
    this.name = 'AttachmentParseError';
  }
}

export async function parseChatAttachment(input: {
  buf: Buffer;
  mime: string;
  filename: string;
}): Promise<ParsedAttachment> {
  const { buf, mime, filename } = input;

  let kind: AttachmentKind;
  let parsedRaw: string;
  let parser: string | undefined;

  try {
    if (mime === 'application/pdf') {
      kind = 'pdf';
      try {
        const out = await parseSource(buf, mime, filename);
        parser = out.parser;
        parsedRaw =
          out.parsed.kind === 'text'
            ? out.parsed.text
            : blocksToText(out.parsed.blocks);
      } catch (sourceErr) {
        // O parser genérico (lib/ingest/parse-source) foi desenhado pra
        // artigos de procurement (prosa/tabela/figura, ver
        // MULTIMODAL_SYSTEM_PROMPT) — um documento fiscal (nota/fatura),
        // sobretudo escaneado/fotografado, não se encaixa nesse molde e o
        // parser genérico esvazia tudo (bug relatado 2026-08-27: usuário
        // anexou nota fiscal, ambos os estágios do parser genérico
        // falharam). Antes de desistir, tenta o extrator de invoice
        // (lib/spend/invoice-extract.ts, já usado pela Análise de Gastos):
        // schema tolerante a scan/baixa confiança, não exige formato de
        // prosa.
        const sourceMsg = sourceErr instanceof Error ? sourceErr.message : String(sourceErr);
        try {
          const fields = await extractInvoiceFromPdf({
            buf,
            filename,
            operation: 'chat-attachment-parse',
          });
          if (!invoiceHasUsableContent(fields)) {
            throw new Error('extração não encontrou nenhum campo de nota fiscal reconhecível');
          }
          parsedRaw = invoiceFieldsToText(fields, filename);
          parser = 'invoice-fallback';
        } catch (invErr) {
          const invMsg = invErr instanceof Error ? invErr.message : String(invErr);
          throw new Error(`${sourceMsg} | Extração de nota fiscal também falhou: ${invMsg}`);
        }
      }
      void recordApiUsage({
        provider: 'openai',
        operation: 'chat-attachment-parse',
        metadata: { kind, parser, filename },
      });
    } else if (
      mime ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      kind = 'docx';
      const out = await parseSource(buf, mime, filename);
      parser = out.parser;
      parsedRaw =
        out.parsed.kind === 'text'
          ? out.parsed.text
          : blocksToText(out.parsed.blocks);
      void recordApiUsage({
        provider: 'openai',
        operation: 'chat-attachment-parse',
        metadata: { kind, parser, filename },
      });
    } else if (
      mime ===
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ) {
      kind = 'xlsx';
      parsedRaw = await parseXlsxToMarkdown(buf);
      parser = 'exceljs';
      void recordApiUsage({
        provider: 'openai',
        operation: 'chat-attachment-parse',
        metadata: { kind, parser, filename },
      });
    } else if (mime === 'image/png' || mime === 'image/jpeg') {
      kind = 'image';
      const described = await describeImageWithVision({ buf, mime, filename });
      if (!described || described.trim().length === 0) {
        throw new AttachmentParseError(
          'parse_failed',
          'A IA não conseguiu descrever a imagem. Tente um print mais legível.',
        );
      }
      parsedRaw = described;
      parser = 'vision';
      // vision describe records its own usage event already
    } else {
      throw new AttachmentParseError(
        'unsupported_mime',
        `Formato não suportado: ${mime}`,
      );
    }
  } catch (err) {
    if (err instanceof AttachmentParseError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new AttachmentParseError('parse_failed', message);
  }

  const cleaned = (parsedRaw ?? '').trim();
  if (cleaned.length === 0) {
    throw new AttachmentParseError(
      'empty',
      'O arquivo não retornou conteúdo legível.',
    );
  }

  const truncated = cleaned.length > MAX_PARSED_CHARS;
  const parsedText = truncated
    ? cleaned.slice(0, MAX_PARSED_CHARS).trimEnd() + '\n\n…[truncado]'
    : cleaned;

  return {
    kind,
    filename,
    sizeBytes: buf.length,
    parsedText,
    truncated,
    parser,
  };
}

// Campos que indicam que a extração de invoice achou algo de verdade — os
// dois outros campos de SpendInvoiceFields (poNumber, paymentTerms) sempre
// vêm preenchidos com um default ("Sem PO"/"Não informado") mesmo quando o
// documento não tem nada a ver com nota fiscal, então não contam aqui.
function invoiceHasUsableContent(f: SpendInvoiceFields): boolean {
  return Boolean(f.total || f.supplier || f.invoiceNumber || f.description || f.invoiceDate);
}

function invoiceFieldsToText(f: SpendInvoiceFields, filename: string): string {
  const lines: string[] = [
    `[Nota fiscal / invoice — extração automática dos campos principais de "${filename}"; o texto completo do documento não pôde ser lido linha a linha, então este resumo pode estar incompleto]`,
  ];
  if (f.supplier) lines.push(`Fornecedor: ${f.supplier}`);
  if (f.invoiceNumber) lines.push(`Número da nota/invoice: ${f.invoiceNumber}`);
  if (f.invoiceDate) lines.push(`Data de emissão: ${f.invoiceDate}`);
  if (f.total !== null && f.total !== undefined) {
    lines.push(`Valor total: ${f.total}${f.currency ? ` ${f.currency}` : ''}`);
  }
  if (f.poNumber) lines.push(`Número do pedido (PO): ${f.poNumber}`);
  if (f.paymentTerms) lines.push(`Condição de pagamento: ${f.paymentTerms}`);
  if (f.description) lines.push(`Descrição: ${f.description}`);
  if (f.category) lines.push(`Categoria sugerida: ${f.category}`);
  if (f.ocrUsed) {
    lines.push(
      '⚠️ Documento parece escaneado/fotografado — valores extraídos por leitura visual, não por texto selecionável. Confira antes de decidir.',
    );
  }
  if (f.lowConfidence) {
    lines.push('⚠️ Confiança baixa na extração — alguns campos podem estar incorretos ou ausentes.');
  }
  lines.push(
    'Observação: este resumo NÃO inclui o detalhamento de impostos por linha (ICMS/IPI/PIS/COFINS) — só o valor total da nota. Para conferir se um imposto foi calculado corretamente numa compra interestadual, use o Simulador Logístico (DIFAL).',
  );
  return lines.join('\n');
}

/**
 * Flatten parsed blocks back to plain markdown for chat injection — we
 * don't need the per-block kind metadata here since the LLM will read it
 * as one coherent attachment payload.
 */
function blocksToText(
  blocks: Array<
    | { type: 'text'; content: string }
    | { type: 'table'; markdown: string; caption?: string }
    | { type: 'figure'; description: string; caption?: string }
  >,
): string {
  const parts: string[] = [];
  for (const b of blocks) {
    if (b.type === 'text') {
      parts.push(b.content);
    } else if (b.type === 'table') {
      if (b.caption) parts.push(`**${b.caption}**`);
      parts.push(b.markdown);
    } else if (b.type === 'figure') {
      if (b.caption) parts.push(`**${b.caption}**`);
      parts.push(b.description);
    }
  }
  return parts.join('\n\n');
}
