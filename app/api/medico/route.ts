import { NextResponse } from 'next/server';

import { medicoOuErro } from '@/lib/medico/acesso-servidor';
import { estadoCompleto } from '@/lib/medico/integracoes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/medico: tudo o que a tela da Área Médica mostra (sub-projeto 100).
export async function GET() {
  const u = await medicoOuErro();
  if (u instanceof NextResponse) return u;
  return NextResponse.json(await estadoCompleto(u.id), { headers: { 'Cache-Control': 'private, no-store' } });
}
