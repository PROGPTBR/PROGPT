import { NextResponse } from 'next/server';

import { medicoOuErro } from '@/lib/medico/acesso-servidor';
import { apagarDocumento, linkDoDocumento } from '@/lib/medico/documentos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const idValido = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

// GET /api/medico/documentos/{id}: baixa o documento (link assinado de 2 minutos, só para o dono).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const u = await medicoOuErro();
  if (u instanceof NextResponse) return u;
  const link = idValido(params.id) ? await linkDoDocumento(u.id, params.id) : null;
  if (!link) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.redirect(link, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const u = await medicoOuErro();
  if (u instanceof NextResponse) return u;
  if (!idValido(params.id) || !(await apagarDocumento(u.id, params.id))) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
