import { NextResponse } from 'next/server';

import { getClientIp, hashIp } from '@/lib/captcha';
import { checkAnonRateLimit } from '@/lib/rate-limit';
import { getPedidoPorToken, urlDoArquivo } from '@/lib/recebimento/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Download do arquivo da nota pelo link do financeiro (sub-projeto 95).
export async function GET(req: Request, { params }: { params: { token: string; notaId: string } }) {
  const rate = await checkAnonRateLimit('recebimento-portal', hashIp(getClientIp(req)), 20, 120);
  if (!rate.allowed) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  const c = await getPedidoPorToken('financeiro', params.token);
  const nota = c?.notas.find((n) => n.id === params.notaId);
  if (!nota?.arquivo_path) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const url = await urlDoArquivo(nota.arquivo_path);
  if (!url) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.redirect(url);
}
