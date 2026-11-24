import { NextResponse } from 'next/server';
import { z } from 'zod';

import { medicoOuErro } from '@/lib/medico/acesso-servidor';
import {
  apagar,
  atualizarCirurgia,
  atualizarDemonstrativo,
  atualizarHospital,
  RECURSOS,
  RegraMedica,
  type Recurso,
} from '@/lib/medico/service';
import { CirurgiaPatchSchema, DemonstrativoPatchSchema, HospitalSchema } from '@/lib/medico/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: { recurso: string; id: string } };

async function entrada(ctx: Ctx) {
  const u = await medicoOuErro();
  if (u instanceof NextResponse) return u;
  const ok = RECURSOS.includes(ctx.params.recurso as Recurso) && z.string().uuid().safeParse(ctx.params.id).success;
  if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return { userId: u.id, recurso: ctx.params.recurso as Recurso, id: ctx.params.id };
}

const falhou = () => NextResponse.json({ error: 'persist_failed', message: 'Não foi possível salvar agora.' }, { status: 500 });

// PATCH /api/medico/{recurso}/{id}
export async function PATCH(req: Request, ctx: Ctx) {
  const e = await entrada(ctx);
  if (e instanceof NextResponse) return e;
  const json = await req.json().catch(() => null);
  const invalido = () => NextResponse.json({ error: 'invalid_body', message: 'Confira os dados.' }, { status: 400 });
  const vazio = (d: object) => Object.keys(d).length === 0;
  try {
    let ok: boolean;
    if (e.recurso === 'hospitais') {
      const body = HospitalSchema.partial().safeParse(json);
      if (!body.success || vazio(body.data)) return invalido();
      ok = await atualizarHospital(e.userId, e.id, body.data);
    } else if (e.recurso === 'cirurgias') {
      const body = CirurgiaPatchSchema.safeParse(json);
      if (!body.success || vazio(body.data)) return invalido();
      ok = await atualizarCirurgia(e.userId, e.id, body.data);
    } else {
      const body = DemonstrativoPatchSchema.safeParse(json);
      if (!body.success || vazio(body.data)) return invalido();
      ok = await atualizarDemonstrativo(e.userId, e.id, body.data);
    }
    return ok ? NextResponse.json({ ok: true }) : falhou();
  } catch (err) {
    if (err instanceof RegraMedica) return NextResponse.json({ error: 'invalid_body', message: err.message }, { status: 400 });
    throw err;
  }
}

// DELETE /api/medico/{recurso}/{id}
export async function DELETE(_req: Request, ctx: Ctx) {
  const e = await entrada(ctx);
  if (e instanceof NextResponse) return e;
  return (await apagar(e.userId, e.recurso, e.id)) ? NextResponse.json({ ok: true }) : falhou();
}
