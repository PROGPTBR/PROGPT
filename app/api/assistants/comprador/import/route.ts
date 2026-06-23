import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  parseChatAttachment,
  AttachmentParseError,
  ACCEPTED_MIMES,
  SIZE_LIMITS,
} from '@/lib/chat-attachments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/assistants/comprador/import  (multipart/form-data: file)
// Extrai texto de PDF/DOCX/XLSX/imagem e devolve { text } para colar no campo.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let file: File | null = null;
  try {
    const fd = await req.formData();
    const f = fd.get('file');
    if (f instanceof File) file = f;
  } catch {
    return NextResponse.json({ error: 'invalid_form' }, { status: 400 });
  }
  if (!file) return NextResponse.json({ error: 'missing_file' }, { status: 400 });

  const mime = file.type;
  if (!ACCEPTED_MIMES.has(mime)) {
    return NextResponse.json(
      { error: 'unsupported_mime', detail: `Tipo não suportado: ${mime || 'desconhecido'}` },
      { status: 400 },
    );
  }
  const limit = SIZE_LIMITS[mime] ?? 5 * 1024 * 1024;
  if (file.size > limit) {
    return NextResponse.json({ error: 'too_large', detail: 'Arquivo acima do limite.' }, { status: 400 });
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const parsed = await parseChatAttachment({ buf, mime, filename: file.name });
    return NextResponse.json({ text: parsed.parsedText, filename: parsed.filename, kind: parsed.kind, truncated: parsed.truncated });
  } catch (err) {
    if (err instanceof AttachmentParseError) {
      return NextResponse.json({ error: err.code, detail: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : 'parse_failed';
    console.error('[api/assistants/comprador/import] failed:', err);
    return NextResponse.json({ error: 'parse_failed', detail: message }, { status: 500 });
  }
}
