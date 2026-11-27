import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getCurrentUser, getProfile } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';
import { sendEmail } from '@/lib/email/client';
import { enviarTexto, estadoDaInstancia, INSTANCIA_AVISOS, numeroLimpo, whatsappConfigurado } from '@/lib/medico/evolution';
import { recordAuditLog } from '@/lib/observability/audit-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Envia a mensagem de acesso ao médico pelo próprio sistema (sub-projeto 119):
// e-mail pelo nosso SMTP e WhatsApp pelo número de avisos da 2B Supply. Só
// super admin. O destinatário sai do cadastro no servidor (e-mail da conta e
// WhatsApp do medico_config); o navegador só pode informar o WhatsApp quando
// ele ainda não está cadastrado, e aí ele fica gravado.

const Corpo = z.object({
  id: z.string().uuid(),
  texto: z.string().trim().min(20).max(6000),
  whatsapp: z.string().trim().max(30).default(''),
});

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function POST(req: Request) {
  const user = await getCurrentUser();
  const profile = user ? await getProfile(user.id).catch(() => null) : null;
  if (!user || profile?.super_admin !== true) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const body = Corpo.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'invalid_body', message: 'Mensagem inválida.' }, { status: 400 });
  const { id, texto } = body.data;

  const db = getServerSupabase();
  const [{ data: alvo }, { data: conta }, { data: cfg }] = await Promise.all([
    db.from('profiles').select('area_medica').eq('id', id).maybeSingle(),
    db.from('profiles_with_email').select('email').eq('id', id).maybeSingle(),
    db.from('medico_config').select('whatsapp_numero').eq('user_id', id).maybeSingle(),
  ]);
  if (!alvo || !['medico', 'equipe'].includes(alvo.area_medica as string) || !conta?.email) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  let numero = numeroLimpo((cfg?.whatsapp_numero as string) ?? '');
  if (!numero && body.data.whatsapp) {
    numero = numeroLimpo(body.data.whatsapp);
    if (numero) await db.from('medico_config').upsert({ user_id: id, whatsapp_numero: body.data.whatsapp });
  }

  const email = await sendEmail({
    to: conta.email as string,
    subject: 'Seu acesso à Área Médica',
    text: texto.replace(/\*/g, ''),
    html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;white-space:pre-wrap">${esc(texto).replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>')}</div>`,
  });

  let whatsapp: 'enviado' | 'sem_numero' | 'desligado' | 'falhou' = 'sem_numero';
  if (numero) {
    if (!whatsappConfigurado() || (await estadoDaInstancia(INSTANCIA_AVISOS).catch(() => 'close')) !== 'open') whatsapp = 'desligado';
    else {
      try {
        await enviarTexto(INSTANCIA_AVISOS, numero, texto);
        whatsapp = 'enviado';
      } catch {
        whatsapp = 'falhou';
      }
    }
  }

  // O texto leva a senha temporária: não vai para o log de auditoria.
  void recordAuditLog({ actorId: user.id, actorEmail: user.email ?? null, action: 'area_medica.access_message', resourceType: 'user', resourceId: id, metadata: { email: email.ok, whatsapp } });
  return NextResponse.json({ email: email.ok, whatsapp }, { headers: { 'Cache-Control': 'private, no-store' } });
}
