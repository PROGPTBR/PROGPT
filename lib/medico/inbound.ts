import { NextResponse } from 'next/server';

import { getServerSupabase } from '@/lib/db/supabase';
import { fetchInboundAttachmentsText, fetchReceivedEmailText } from '@/lib/email/inbound';

import { userIdDoAliasMedico } from './integracoes';
import { registrarEntrada } from './service';

// E-mail de entrada da Área Médica (sub-projeto 101). O Resend entrega todos
// os e-mails recebidos no mesmo webhook; as rotas de inbound que já existem
// (Equalizador e Proc2Pay) chamam esta função DEPOIS de conferir a assinatura.
// Se o destinatário é o endereço de um médico, o e-mail vira uma entrada para
// ele conferir; senão devolve null e a rota segue o caminho dela.

type DadosDoEmail = {
  email_id?: string;
  from?: string;
  to?: string[];
  subject?: string;
  attachments?: { id: string; filename?: string; content_type?: string }[];
};

export async function tratarEmailDaAreaMedica(data: DadosDoEmail | undefined): Promise<NextResponse | null> {
  const userId = userIdDoAliasMedico(data?.to);
  if (!userId || !data?.email_id) return null;

  // Só grava para quem já usa a Área Médica (tem configuração ou hospital).
  const { data: hospital } = await getServerSupabase().from('medico_hospitais').select('id').eq('user_id', userId).limit(1).maybeSingle();
  if (!hospital) return NextResponse.json({ ok: true, no_user: true });

  const corpo = await fetchReceivedEmailText(data.email_id);
  const anexos = await fetchInboundAttachmentsText(data.email_id, data.attachments ?? []);
  const texto = [corpo, anexos].filter((s) => s && s.trim()).join('\n\n').trim();
  if (!texto) return NextResponse.json({ ok: true, empty: true });

  await registrarEntrada(userId, {
    canal: 'email',
    origem_id: data.email_id,
    remetente: data.from ?? '',
    assunto: data.subject ?? '',
    texto,
  });
  return NextResponse.json({ ok: true, area_medica: true });
}
