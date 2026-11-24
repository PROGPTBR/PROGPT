import { NextResponse } from 'next/server';

import { medicoOuErro } from '@/lib/medico/acesso-servidor';
import { salvarConfig } from '@/lib/medico/service';
import { ConfigSchema } from '@/lib/medico/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(req: Request) {
  const u = await medicoOuErro();
  if (u instanceof NextResponse) return u;
  const body = ConfigSchema.partial().safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'invalid_body', message: 'Confira os dados.' }, { status: 400 });
  if (!(await salvarConfig(u.id, body.data))) {
    return NextResponse.json({ error: 'persist_failed', message: 'Não foi possível salvar agora.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
