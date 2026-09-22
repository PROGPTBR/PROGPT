import { NextResponse } from 'next/server';

import { requireUser, NotAuthenticated } from '@/lib/auth';
import { getProcesso } from '@/lib/fluxo/process';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  let u;
  try {
    u = await requireUser();
  } catch (err) {
    if (err instanceof NotAuthenticated) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    throw err;
  }

  const carregado = await getProcesso(u.id, params.id);
  if (!carregado) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return NextResponse.json(carregado);
}
