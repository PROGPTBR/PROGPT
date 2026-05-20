import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { extractProfileFromUpload } from '@/lib/assistants/profile-extract';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

// POST /api/assistants/profile/extract — multipart with a PDF or DOCX of
// an existing Category Profile. Runs text-only parse + 1 LLM call against
// PartialProfileSchema, returns the inferred fields + warnings about
// missing ones. The client uses this to pre-populate the form; the user
// reviews and edits before submitting the actual generate request.
export async function POST(req: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const rl = await checkChatRateLimit();
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', retry_after_secs: rl.retryAfterSecs },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSecs) } },
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
  const lower = (file.name || '').toLowerCase();
  const accepted =
    ACCEPTED_MIMES.has(mime) ||
    lower.endsWith('.pdf') ||
    lower.endsWith('.docx');
  if (!accepted) {
    return NextResponse.json(
      {
        error: 'unsupported_mime',
        mime,
        message: 'Aceito apenas PDF ou DOCX.',
      },
      { status: 415 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      {
        error: 'file_too_large',
        max_bytes: MAX_BYTES,
        size_bytes: file.size,
        message: 'Arquivo acima de 10 MB.',
      },
      { status: 413 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  // Normalize mime if extension doesn't match Content-Type
  let normalizedMime = mime;
  if (lower.endsWith('.pdf')) normalizedMime = 'application/pdf';
  else if (lower.endsWith('.docx'))
    normalizedMime =
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  try {
    const result = await extractProfileFromUpload({
      buffer,
      mime: normalizedMime,
      filename: file.name,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error('[api/assistants/profile/extract] failed:', err);
    return NextResponse.json(
      {
        error: 'extract_failed',
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 422 },
    );
  }
}
