import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import {
  extractFinancialFromPdf,
  FinancialExtractError,
} from '@/lib/assistants/financial-extract';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Big PDFs via the multimodal pipeline can take 2-3 minutes; match the
// existing multimodal-parse ceiling.
export const maxDuration = 300;

const MAX_PDF_BYTES = 15 * 1024 * 1024; // 15 MB cap
const SAFE_FILENAME_MAX = 200;

// POST /api/assistants/financial/extract
// multipart/form-data: { file: PDF File }
//
// Reads the supplier's Balance Sheet + DRE PDF, runs the multimodal
// extraction prompt, and returns the 12 indicators + diagnostics. The
// caller (FinancialAssistant) then patches its form state and lets the
// user review before submitting to /api/assistants/financial.
export async function POST(req: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Reuse the chat rate-limit bucket — a PDF extraction is heavier than
  // a chat turn but the user only does it once per supplier, so the
  // shared budget works fine.
  const rl = await checkChatRateLimit();
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', retry_after_secs: rl.retryAfterSecs },
      {
        status: 429,
        headers: { 'Retry-After': String(rl.retryAfterSecs) },
      },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch (err) {
    return NextResponse.json(
      {
        error: 'invalid_body',
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 400 },
    );
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'missing_file' }, { status: 400 });
  }

  const mime = file.type || 'application/octet-stream';
  if (mime !== 'application/pdf') {
    return NextResponse.json(
      { error: 'unsupported_mime', mime, message: 'Aceito apenas PDF.' },
      { status: 415 },
    );
  }
  if (file.size > MAX_PDF_BYTES) {
    return NextResponse.json(
      {
        error: 'file_too_large',
        max_bytes: MAX_PDF_BYTES,
        size_bytes: file.size,
        message: 'PDF acima de 15 MB. Comprima ou recorte páginas irrelevantes.',
      },
      { status: 413 },
    );
  }

  const filename = sanitizeFilename(file.name || 'balanço.pdf');
  const buf = Buffer.from(await file.arrayBuffer());

  try {
    const result = await extractFinancialFromPdf({ buf, filename });
    return NextResponse.json({
      indicators: result.indicators,
      detectedYear: result.detectedYear,
      detectedCnpj: result.detectedCnpj,
      notes: result.notes,
    });
  } catch (err) {
    if (err instanceof FinancialExtractError) {
      const status =
        err.code === 'too_small' || err.code === 'empty'
          ? 422
          : err.code === 'timeout'
            ? 504
            : 500;
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status },
      );
    }
    console.error('[api/assistants/financial/extract] failed:', err);
    return NextResponse.json(
      {
        error: 'extract_failed',
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

function sanitizeFilename(name: string): string {
  // eslint-disable-next-line no-control-regex
  return name.replace(/[\\/\x00-\x1f]/g, '_').slice(0, SAFE_FILENAME_MAX);
}
