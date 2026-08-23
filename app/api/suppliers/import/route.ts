import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { parseVendorListXlsx } from '@/lib/suppliers/import';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB cap
const ACCEPTED_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'application/octet-stream', // fallback for some browsers
]);

// POST /api/suppliers/import — multipart com o "vendor list" do cliente
// (.xlsx/.xls). Batch L do backlog do diretor (Kraljic: "poderia subir o
// vendor list do cliente"). Devolve linhas parseadas + warnings; o client
// faz o diff novo/atualizado e grava via supabaseBrowser na tabela
// `suppliers` já existente (sub-projeto "Minha base de fornecedores").
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
      { error: 'invalid_body', message: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'missing_file' }, { status: 400 });
  }

  const mime = file.type || 'application/octet-stream';
  const lower = (file.name || '').toLowerCase();
  const accepted = ACCEPTED_MIMES.has(mime) || lower.endsWith('.xlsx') || lower.endsWith('.xls');
  if (!accepted) {
    return NextResponse.json(
      { error: 'invalid_mime', mime, message: 'Aceito apenas XLSX ou XLS.' },
      { status: 415 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: 'too_large', max_bytes: MAX_BYTES, size_bytes: file.size, message: 'Arquivo acima de 10 MB.' },
      { status: 413 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());

  try {
    const { rows, warnings } = await parseVendorListXlsx(buf);
    return NextResponse.json({ rows, warnings });
  } catch (err) {
    console.error('[api/suppliers/import] failed:', err);
    return NextResponse.json(
      { error: 'parse_failed', message: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
