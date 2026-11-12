import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth';
import { municipios } from '@/lib/reforma/calculadora';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const uf = new URL(req.url).searchParams.get('uf') ?? '';
  if (!/^[A-Za-z]{2}$/.test(uf)) return NextResponse.json({ error: 'uf_invalida' }, { status: 400 });
  try {
    return NextResponse.json({ municipios: await municipios(uf) });
  } catch (err) {
    console.error('[reforma] municipios falhou:', err);
    return NextResponse.json({ error: 'indisponivel', message: 'Não foi possível carregar os municípios.' }, { status: 502 });
  }
}
