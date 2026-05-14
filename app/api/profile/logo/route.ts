import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  uploadUserLogo,
  deleteUserLogo,
  getUserLogoBuffer,
  isAcceptedLogoMime,
} from '@/lib/db/user-logos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 2 * 1024 * 1024;

// POST /api/profile/logo — multipart upload (form field "file").
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'invalid_form_data' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'missing_file' }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'empty_file' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: 'too_large', max_bytes: MAX_BYTES },
      { status: 413 },
    );
  }
  const mime = file.type;
  if (!isAcceptedLogoMime(mime)) {
    return NextResponse.json(
      { error: 'invalid_mime', accepted: ['image/png', 'image/jpeg'] },
      { status: 415 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const result = await uploadUserLogo(user.id, bytes, mime);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, path: result.path, mime });
}

// DELETE /api/profile/logo — remove the user's logo.
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const ok = await deleteUserLogo(user.id);
  if (!ok) return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// GET /api/profile/logo — return the current logo bytes (for preview).
// 404 when none set, so the UI can render an "empty" state cheaply.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const logo = await getUserLogoBuffer(user.id);
  if (!logo) return new NextResponse('Not Found', { status: 404 });

  return new NextResponse(logo.buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': logo.mime,
      'Cache-Control': 'private, max-age=60',
      'Content-Length': String(logo.buffer.length),
    },
  });
}
