import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { parseChatAttachment, AttachmentParseError, ACCEPTED_MIMES, mimeDoArquivo } from '@/lib/chat-attachments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/assistants/comprador/import  (multipart/form-data: file)
// Extrai texto de PDF/DOCX/XLSX/imagem e devolve { text } para colar no campo.
//
// Limites próprios do Equalizador (2026-10-08, cliente importando propostas
// em lote): a proposta precisa ser lida INTEIRA. O teto do chat (8 mil
// caracteres por arquivo) cortava as propostas e a análise saía sem os dados.
const LIMITE_BYTES: Record<string, number> = {
  'application/pdf': 25 * 1024 * 1024,
  'image/png': 10 * 1024 * 1024,
  'image/jpeg': 10 * 1024 * 1024,
};
const LIMITE_PADRAO = 15 * 1024 * 1024;
const MAX_CARACTERES = 60_000;
const MAX_LINHAS_PLANILHA = 1_000;
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

  const mime = mimeDoArquivo(file.name, file.type);
  if (!ACCEPTED_MIMES.has(mime)) {
    return NextResponse.json(
      { error: 'unsupported_mime', detail: 'Formato não aceito. Use PDF, Word (.docx), Excel (.xlsx) ou imagem (PNG ou JPG).' },
      { status: 400 },
    );
  }
  const limit = LIMITE_BYTES[mime] ?? LIMITE_PADRAO;
  if (file.size > limit) {
    return NextResponse.json(
      { error: 'too_large', detail: `Arquivo com mais de ${Math.round(limit / 1024 / 1024)} MB. Divida o documento ou envie uma versão menor.` },
      { status: 400 },
    );
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const parsed = await parseChatAttachment({ buf, mime, filename: file.name, maxChars: MAX_CARACTERES, xlsxMaxRows: MAX_LINHAS_PLANILHA });
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
