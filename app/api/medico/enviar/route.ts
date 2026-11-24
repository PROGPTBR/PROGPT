import { NextResponse } from 'next/server';

import { checkChatRateLimit } from '@/lib/rate-limit';
import { medicoOuErro } from '@/lib/medico/acesso-servidor';
import { enviarMensagem, type Anexo, type TipoDeEnvio } from '@/lib/medico/envio';
import { RegraMedica } from '@/lib/medico/service';
import { hojeEmBrasilia } from '@/lib/vitrine/datas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TIPOS: TipoDeEnvio[] = ['pedido_nota', 'envio_nota', 'cobranca_hospital', 'cobranca_paciente'];
const MAX_ANEXO = 10 * 1024 * 1024;

// POST /api/medico/enviar (multipart): o sistema envia o e-mail, ou o WhatsApp
// ao paciente, em nome do médico, e avança a etapa. O destinatário sai do
// cadastro no servidor; o navegador só manda o texto ajustado e o anexo.
export async function POST(req: Request) {
  const u = await medicoOuErro();
  if (u instanceof NextResponse) return u;
  const limite = await checkChatRateLimit();
  if (!limite.allowed) {
    return NextResponse.json({ error: 'rate_limited', message: 'Muitos envios em pouco tempo. Aguarde um minuto.' }, { status: 429 });
  }

  const fd = await req.formData().catch(() => null);
  const tipo = String(fd?.get('tipo') ?? '') as TipoDeEnvio;
  const canal = String(fd?.get('canal') ?? 'email');
  const id = String(fd?.get('id') ?? '');
  if (!fd || !TIPOS.includes(tipo) || !['email', 'whatsapp'].includes(canal) || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'invalid_body', message: 'Pedido inválido.' }, { status: 400 });
  }

  let anexo: Anexo | null = null;
  const f = fd.get('arquivo');
  if (f instanceof File && f.size > 0) {
    if (f.size > MAX_ANEXO) return NextResponse.json({ error: 'anexo_grande', message: 'O anexo passa de 10 MB.' }, { status: 400 });
    anexo = { nome: (f.name || 'nota.pdf').replace(/[\r\n"]/g, ' ').slice(0, 120), buf: Buffer.from(await f.arrayBuffer()), mime: f.type || 'application/pdf' };
  }

  try {
    await enviarMensagem(u.id, { tipo, canal: canal as 'email' | 'whatsapp', id, corpo: String(fd.get('corpo') ?? ''), anexo }, hojeEmBrasilia());
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof RegraMedica) return NextResponse.json({ error: 'nao_enviado', message: err.message }, { status: 400 });
    console.error('[medico/enviar]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'falhou', message: 'Não foi possível enviar agora. Tente de novo em instantes.' }, { status: 502 });
  }
}
