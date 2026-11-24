import { NextResponse } from 'next/server';

import { medicoOuErro } from '@/lib/medico/acesso-servidor';
import { apagarExemplo, carregarExemplo } from '@/lib/medico/service';
import { hojeEmBrasilia } from '@/lib/vitrine/datas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Dados fictícios para a apresentação, na conta de quem pediu. Apagar o
// exemplo não toca em dado real.
export async function POST() {
  const u = await medicoOuErro();
  if (u instanceof NextResponse) return u;
  await carregarExemplo(u.id, hojeEmBrasilia());
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const u = await medicoOuErro();
  if (u instanceof NextResponse) return u;
  await apagarExemplo(u.id);
  return NextResponse.json({ ok: true });
}
