import { NextResponse } from 'next/server';
import { z } from 'zod';

import { configuredAppUrl } from '@/lib/app-url';
import { getCurrentUser, getProfile } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';
import { recordAuditLog } from '@/lib/observability/audit-log';

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
  const { data: emails } = ids.length ? await db.from('profiles_with_email').select('id, email, last_sign_in_at').in('id', ids) : { data: [] };
  const acessos = (perfis ?? [])
    .map((p) => {
      const e = (emails ?? []).find((x) => x.id === p.id);
      return { id: p.id as string, tipo: p.area_medica as string, email: (e?.email as string) ?? '', ultimo_acesso: (e?.last_sign_in_at as string | null) ?? null };
    })
    .sort((a, b) => a.email.localeCompare(b.email));
  return NextResponse.json({ acessos }, { headers: { 'Cache-Control': 'private, no-store' } });
}

const Convite = z.object({ email: z.string().trim().toLowerCase().email().max(200), tipo: z.enum(['medico', 'equipe']).default('medico') });

export async function POST(req: Request) {
  const u = await superAdminOu404();
  if (u instanceof NextResponse) return u;
  const body = Convite.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'invalid_body', message: 'Informe um e-mail válido.' }, { status: 400 });
  const { email, tipo } = body.data;
  const db = getServerSupabase();

  // Conta que já existe só muda de tipo; conta nova recebe o convite para criar a senha.
  let { data: existente } = await db.from('profiles_with_email').select('id').eq('email', email).maybeSingle();
  let convidado = false;
  if (!existente) {
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
  void recordAuditLog({ actorId: u.id, actorEmail: u.email ?? null, action: 'area_medica.grant', resourceType: 'user', resourceId: existente.id as string, metadata: { email, tipo, convidado } });
  return NextResponse.json({ ok: true, convidado });
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
