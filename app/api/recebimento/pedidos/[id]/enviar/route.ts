import { NextResponse } from 'next/server';
import { z } from 'zod';

import { enviarLinks, getPedido } from '@/lib/recebimento/service';
import { usuarioOu401 } from '@/lib/recebimento/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({ papeis: z.array(z.enum(['fornecedor', 'almoxarifado', 'financeiro'])).min(1).max(3) });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const u = await usuarioOu401();
  if (u instanceof NextResponse) return u;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const c = await getPedido(u.id, params.id);
  if (!c) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const enviados = await enviarLinks(c, body.papeis);
  return NextResponse.json({ enviados });
}
