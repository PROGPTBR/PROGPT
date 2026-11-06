import { NextResponse } from 'next/server';

import { cancelarPedido, getPedido, linkDoPapel } from '@/lib/recebimento/service';
import { usuarioOu401 } from '@/lib/recebimento/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const u = await usuarioOu401();
  if (u instanceof NextResponse) return u;

  const c = await getPedido(u.id, params.id);
  if (!c) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return NextResponse.json(
    {
      ...c,
      links: {
        fornecedor: linkDoPapel('fornecedor', c.pedido.fornecedor_token),
        almoxarifado: linkDoPapel('almoxarifado', c.pedido.almoxarifado_token),
        financeiro: linkDoPapel('financeiro', c.pedido.financeiro_token),
      },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const u = await usuarioOu401();
  if (u instanceof NextResponse) return u;

  const ok = await cancelarPedido(u.id, params.id);
  if (!ok) {
    return NextResponse.json(
      { error: 'not_cancelled', message: 'Este pedido não pode ser cancelado (não existe ou já teve o pagamento liberado).' },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true });
}
