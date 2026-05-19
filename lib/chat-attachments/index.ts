import { parseSource } from '@/lib/ingest/parse-source';
import { parseXlsxToMarkdown } from './xlsx';
import { describeImageWithVision } from './image';
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
