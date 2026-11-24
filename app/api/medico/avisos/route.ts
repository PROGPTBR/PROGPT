import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';

import { medicoOuErro } from '@/lib/medico/acesso-servidor';
import { enviarAvisoPara, enviarAvisosDoDia } from '@/lib/medico/avisos';
import { tokenInterno } from '@/lib/medico/evolution';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/medico/avisos
//  - com o cabeçalho x-area-medica-token: roda a rodada diária para todos (é o
//    que um agendador externo chamaria; o servidor também roda sozinho, ver
//    instrumentation.ts);
//  - logado, sem o cabeçalho: manda agora o aviso de teste só para quem pediu.
export async function POST(req: Request) {
  const recebido = req.headers.get('x-area-medica-token');
  if (recebido) {
    const esperado = tokenInterno('avisos');
    if (!esperado || recebido.length !== esperado.length || !timingSafeEqual(Buffer.from(recebido), Buffer.from(esperado))) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    return NextResponse.json(await enviarAvisosDoDia());
  }

  const u = await medicoOuErro();
  if (u instanceof NextResponse) return u;
  const r = await enviarAvisoPara(u.id, u.email ?? null);
  if (!r.enviado) return NextResponse.json({ error: 'nao_enviado', message: r.motivo ?? 'Nada foi enviado.' }, { status: 400 });
  return NextResponse.json(r);
}
