import { randomInt } from 'crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { configuredAppUrl } from '@/lib/app-url';
import { getCurrentUser, getProfile } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';
import { getEmailConfigStatus } from '@/lib/email/client';
import { btgConfigurado } from '@/lib/medico/btg';
import { estadoDaInstancia, INSTANCIA_AVISOS, whatsappConfigurado } from '@/lib/medico/evolution';
import { recordAuditLog } from '@/lib/observability/audit-log';
import { hojeEmBrasilia } from '@/lib/vitrine/datas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Quem tem conta de médico (sub-projeto 105). Só o super admin da 2B Supply
// lista, convida e remove. O médico não se cadastra sozinho: recebe o convite
// por e-mail, cria a senha e entra direto na Área Médica.

async function superAdminOu404() {
  const user = await getCurrentUser();
  const profile = user ? await getProfile(user.id).catch(() => null) : null;
  if (!user || profile?.super_admin !== true) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return user;
}

export async function GET() {
  const u = await superAdminOu404();
  if (u instanceof NextResponse) return u;
  const db = getServerSupabase();
  const { data: perfis } = await db.from('profiles').select('id, area_medica').in('area_medica', ['medico', 'equipe']);
  const ids = (perfis ?? []).map((p) => p.id as string);
  if (ids.length === 0) return NextResponse.json({ acessos: [], avisos: await estadoDosAvisos() }, { headers: { 'Cache-Control': 'private, no-store' } });

  // Só números: o painel da 2B Supply não mostra paciente nem valor por cirurgia.
  const hoje = hojeEmBrasilia();
  const [emails, hospitais, cirurgias, demonstrativos, configs, contas] = await Promise.all([
    db.from('profiles_with_email').select('id, email, last_sign_in_at').in('id', ids),
    db.from('medico_hospitais').select('user_id').in('user_id', ids).eq('exemplo', false),
    db.from('medico_cirurgias').select('user_id, demonstrativo_id, data').in('user_id', ids).eq('exemplo', false).limit(20000),
    db.from('medico_demonstrativos').select('user_id, valor_total, pago_em').in('user_id', ids).eq('exemplo', false).limit(5000),
    db.from('medico_config').select('user_id, medico_nome, grupo_jid').in('user_id', ids),
    db.from('medico_banco').select('user_id').in('user_id', ids),
  ]);
  const conta = <T extends { user_id: unknown }>(linhas: T[] | null, id: string, filtro: (l: T) => boolean = () => true) => (linhas ?? []).filter((l) => l.user_id === id && filtro(l)).length;

  const acessos = (perfis ?? [])
    .map((p) => {
      const id = p.id as string;
      const e = (emails.data ?? []).find((x) => x.id === id);
      const cfg = (configs.data ?? []).find((x) => x.user_id === id);
      const abertos = (demonstrativos.data ?? []).filter((d) => d.user_id === id && !d.pago_em);
      return {
        id,
        tipo: p.area_medica as string,
        email: (e?.email as string) ?? '',
        nome: (cfg?.medico_nome as string) ?? '',
        ultimo_acesso: (e?.last_sign_in_at as string | null) ?? null,
        hospitais: conta(hospitais.data, id),
        cirurgias: conta(cirurgias.data, id),
        pendencias: conta(cirurgias.data, id, (c) => !c.demonstrativo_id && (c.data as string) <= hoje),
        demonstrativos: conta(demonstrativos.data, id),
        a_receber: Math.round(abertos.reduce((soma, d) => soma + Number(d.valor_total ?? 0), 0) * 100) / 100,
        whatsapp: !!cfg?.grupo_jid,
        banco: (contas.data ?? []).some((c) => c.user_id === id),
      };
    })
    .sort((a, b) => a.email.localeCompare(b.email));
  return NextResponse.json({ acessos, avisos: await estadoDosAvisos() }, { headers: { 'Cache-Control': 'private, no-store' } });
}

/** O que está ligado para o produto inteiro (número de avisos, e-mail, banco). */
async function estadoDosAvisos() {
  const whatsapp = whatsappConfigurado() ? await estadoDaInstancia(INSTANCIA_AVISOS).catch(() => 'close' as const) : null;
  return { whatsapp, email: getEmailConfigStatus().hasKey, btg: btgConfigurado() };
}

/** Fácil de ditar: sem letras e números que se confundem. */
function senhaTemporaria(): string {
  const pedaco = (n: number, alfabeto: string) => Array.from({ length: n }, () => alfabeto[randomInt(alfabeto.length)]).join('');
  return `${pedaco(4, 'abcdefghjkmnpqrstuvwxyz')}-${pedaco(4, '23456789')}-${pedaco(4, 'ABCDEFGHJKMNPQRSTUVWXYZ')}`;
}

const Convite = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  tipo: z.enum(['medico', 'equipe']).default('medico'),
  /** 'convite': e-mail com link para criar a senha. 'senha': senha temporária mostrada uma vez a quem cadastrou. */
  modo: z.enum(['convite', 'senha']).default('convite'),
});

export async function POST(req: Request) {
  const u = await superAdminOu404();
  if (u instanceof NextResponse) return u;
  const body = Convite.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'invalid_body', message: 'Informe um e-mail válido.' }, { status: 400 });
  const { email, tipo, modo } = body.data;
  const db = getServerSupabase();

  // Conta que já existe só muda de tipo; conta nova recebe o convite (ou a senha temporária).
  let { data: existente } = await db.from('profiles_with_email').select('id').eq('email', email).maybeSingle();
  let convidado = false;
  let senha: string | null = null;
  if (modo === 'senha') {
    senha = senhaTemporaria();
    if (existente) {
      const { error } = await db.auth.admin.updateUserById(existente.id as string, { password: senha, user_metadata: { trocar_senha: true } });
      if (error) return NextResponse.json({ error: 'persist_failed', message: 'Não foi possível gerar a senha agora.' }, { status: 502 });
    } else {
      const { data, error } = await db.auth.admin.createUser({ email, password: senha, email_confirm: true, user_metadata: { trocar_senha: true } });
      if (error || !data.user) return NextResponse.json({ error: 'persist_failed', message: 'Não foi possível criar a conta agora.' }, { status: 502 });
      existente = { id: data.user.id };
    }
  } else if (!existente) {
    const { data, error } = await db.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${configuredAppUrl()}/auth/callback?next=/reset-password`,
    });
    if (error || !data.user) {
      console.error('[medico/acessos] convite falhou:', error?.message);
      return NextResponse.json({ error: 'invite_failed', message: 'Não foi possível enviar o convite agora.' }, { status: 502 });
    }
    existente = { id: data.user.id };
    convidado = true;
  }

  const { error } = await db.from('profiles').update({ area_medica: tipo }).eq('id', existente.id);
  if (error) return NextResponse.json({ error: 'persist_failed', message: 'O convite saiu, mas não consegui liberar o acesso. Tente de novo.' }, { status: 500 });
  void recordAuditLog({ actorId: u.id, actorEmail: u.email ?? null, action: 'area_medica.grant', resourceType: 'user', resourceId: existente.id as string, metadata: { email, tipo, convidado, senha_temporaria: !!senha } });
  // A senha temporária aparece uma vez, para quem cadastrou passar ao médico. Não é gravada em lugar nenhum.
  return NextResponse.json({ ok: true, convidado, senha }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function DELETE(req: Request) {
  const u = await superAdminOu404();
  if (u instanceof NextResponse) return u;
  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  const { error } = await getServerSupabase().from('profiles').update({ area_medica: '' }).eq('id', id);
  if (error) return NextResponse.json({ error: 'persist_failed', message: 'Não foi possível remover agora.' }, { status: 500 });
  void recordAuditLog({ actorId: u.id, actorEmail: u.email ?? null, action: 'area_medica.revoke', resourceType: 'user', resourceId: id, metadata: {} });
  return NextResponse.json({ ok: true });
}
