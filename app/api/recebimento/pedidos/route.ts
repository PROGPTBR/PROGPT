import { NextResponse } from 'next/server';
import { z } from 'zod';

import { PedidoInputSchema } from '@/lib/recebimento/types';
import { criarPedido, emailValido, enviarLinks, getPedido, listarPedidos, type Papel } from '@/lib/recebimento/service';
import { usuarioOu401 } from '@/lib/recebimento/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = PedidoInputSchema.extend({
  enviar: z.array(z.enum(['fornecedor', 'almoxarifado', 'financeiro'])).max(3).default([]),
});

export async function GET() {
  const u = await usuarioOu401();
  if (u instanceof NextResponse) return u;
  return NextResponse.json({ pedidos: await listarPedidos(u.id) });
}

export async function POST(req: Request) {
  const u = await usuarioOu401();
  if (u instanceof NextResponse) return u;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: 'invalid_body', message: 'Confira o pedido: fornecedor e pelo menos um item com descrição e quantidade.' },
      { status: 400 },
    );
  }

  for (const [campo, rotulo] of [
    ['fornecedor_email', 'do fornecedor'],
    ['almoxarifado_email', 'do almoxarifado'],
    ['financeiro_email', 'do financeiro'],
  ] as const) {
    if (body[campo] && !emailValido(body[campo])) {
      return NextResponse.json({ error: 'email_invalido', message: `Confira o e-mail ${rotulo}.` }, { status: 400 });
    }
  }

  const pedido = await criarPedido(u.id, body);
  if (!pedido) {
    return NextResponse.json({ error: 'persist_failed', message: 'Não foi possível salvar o pedido agora.' }, { status: 500 });
  }

  const papeis = body.enviar.filter((p) => !!pedido[`${p}_email` as `${Papel}_email`]) as Papel[];
  if (papeis.length > 0) {
    const completo = await getPedido(u.id, pedido.id);
    if (completo) void enviarLinks(completo, papeis);
  }

  return NextResponse.json({ pedido: { id: pedido.id } });
}
