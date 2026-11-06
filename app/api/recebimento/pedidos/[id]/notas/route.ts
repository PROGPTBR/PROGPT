import { NextResponse } from 'next/server';

import { checkChatRateLimit } from '@/lib/rate-limit';
import { getPedido, registrarNota } from '@/lib/recebimento/service';
import { lerUploadDaNota, respostaDeErroDaNota, usuarioOu401 } from '@/lib/recebimento/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// O comprador anexa a nota em nome do fornecedor (ex.: nota chegou por e-mail).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const u = await usuarioOu401();
  if (u instanceof NextResponse) return u;

  const rate = await checkChatRateLimit();
  if (!rate.allowed) {
    return NextResponse.json({ error: 'rate_limited', message: 'Muitos envios seguidos. Aguarde um minuto.' }, { status: 429 });
  }

  const c = await getPedido(u.id, params.id);
  if (!c) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const up = await lerUploadDaNota(req);
  if (up instanceof NextResponse) return up;

  try {
    const r = await registrarNota({ completo: c, arquivo: up.arquivo, finalidade: up.finalidade, enviadoPor: 'comprador' });
    return NextResponse.json({ nota: r.nota });
  } catch (err) {
    return respostaDeErroDaNota(err);
  }
}
