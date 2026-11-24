import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';

import { medicoOuErro } from '@/lib/medico/acesso-servidor';
import { enviarAvisoPara, enviarAvisosDoDia, enviarLembretesDaAgenda, horaDeAvisar, horaDeLembrar } from '@/lib/medico/avisos';
import { renovarConexoes } from '@/lib/medico/btg';
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
    // Mesma rotina do agendador interno: mantém viva a autorização do BTG e,
    // de manhã (8h às 12h de Brasília), manda os avisos. Pode ser chamada de
    // hora em hora: cada médico recebe no máximo um aviso por dia.
    const btg = await renovarConexoes().catch(() => ({ renovadas: 0, falhas: 0 }));
    const avisos = horaDeAvisar() ? await enviarAvisosDoDia() : { medicos: 0, enviados: 0 };
    const lembretes = horaDeLembrar() ? await enviarLembretesDaAgenda() : { enviados: 0 };
    return NextResponse.json({ ...avisos, lembretes: lembretes.enviados, btg });
  }

  const u = await medicoOuErro();
  if (u instanceof NextResponse) return u;
  const r = await enviarAvisoPara(u.id, u.email ?? null);
  if (!r.enviado) return NextResponse.json({ error: 'nao_enviado', message: r.motivo ?? 'Nada foi enviado.' }, { status: 400 });
  return NextResponse.json(r);
}
