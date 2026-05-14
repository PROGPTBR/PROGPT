import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { parseImportedItems } from '@/lib/assistants/kraljic-import';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_MIME = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream', // some browsers send this for .xlsx
]);

// POST /api/assistants/kraljic/import-xlsx — parse uploaded .xlsx (or
// a PG-format Kraljic template) into a KraljicItem[]. Returns parsed
// items + per-row warnings.
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
  if (file.type && !ACCEPTED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: 'invalid_mime', accepted: Array.from(ACCEPTED_MIME) },
      { status: 415 },
    );
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const result = await parseImportedItems(bytes);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'parse_failed';
    return NextResponse.json({ error: 'parse_failed', detail: message }, { status: 500 });
  }
}
