import { NextResponse } from 'next/server';

import { medicoOuErro } from '@/lib/medico/acesso-servidor';
import { enviarMensagem } from '@/lib/medico/envio';
import { criarDireto, RegraMedica } from '@/lib/medico/service';
import { DiretoSchema } from '@/lib/medico/types';
import { hojeEmBrasilia } from '@/lib/vitrine/datas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/medico/direto: cobrança direta ao paciente (quem recebe e emite a
// nota na hora, como o anestesista). Com `pedir_nota`, o e-mail ao contador já
// sai junto: registrar e pedir a nota é um passo só.
export async function POST(req: Request) {
  const u = await medicoOuErro();
  if (u instanceof NextResponse) return u;
  const body = DiretoSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: 'invalid_body', message: 'Informe hospital, data, paciente e valor.' }, { status: 400 });
  }
  try {
    const id = await criarDireto(u.id, body.data);
    let nota_pedida = false;
    let aviso: string | null = null;
    if (body.data.pedir_nota) {
      try {
        await enviarMensagem(u.id, { tipo: 'pedido_nota', canal: 'email', id }, hojeEmBrasilia());
        nota_pedida = true;
      } catch (err) {
        aviso = err instanceof RegraMedica ? err.message : 'A cobrança foi salva, mas o e-mail ao contador não saiu.';
      }
    }
    return NextResponse.json({ id, nota_pedida, aviso });
  } catch (err) {
    if (err instanceof RegraMedica) return NextResponse.json({ error: 'invalid_body', message: err.message }, { status: 400 });
    console.error('[medico/direto]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'persist_failed', message: 'Não foi possível salvar agora.' }, { status: 500 });
  }
}
