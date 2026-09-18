import { randomBytes } from 'crypto';

import { getServerSupabase } from '@/lib/db/supabase';
import { parseSeats } from '@/lib/billing/seats';
import { configuredAppUrl } from '@/lib/app-url';
import { sendEmail } from '@/lib/email/client';
import { buildSeatInviteEmail } from '@/lib/email/templates';

// Licenças de uma assinatura (sub-projeto 64).
//
// O titular paga por N usuários (subscriptions.seats) e convida os outros
// N-1 por e-mail. O acesso do convidado é DERIVADO da assinatura do titular
// (RPC `resolve_subscription_access`, migration 0057) — não existe liberação
// manual nem assinatura separada pra ele.
//
// Tudo aqui roda com service-role porque mexe em linhas de outro usuário
// (o convidado) e em auth.users; a autorização é feita pelo chamador
// (rotas com requireUser + filtro por owner_id explícito).

export type SeatRow = {
  id: string;
  email: string;
  member_id: string | null;
  invited_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
};

export type SeatState = {
  /** Quantidade de usuários contratados (inclui o titular). */
  seats: number;
  /** Acessos além do titular. */
  extraSeats: number;
  /** Convites vivos (pendentes + aceitos). */
  used: number;
  available: number;
  members: SeatRow[];
  subscriptionId: string | null;
};

export function normalizeEmail(input: unknown): string {
  return typeof input === 'string' ? input.trim().toLowerCase() : '';
}

/** Validação frouxa e suficiente — o e-mail é verificado de fato quando a
 *  pessoa recebe (ou não recebe) o convite. */
export function looksLikeEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255;
}

export function newInviteToken(): string {
  return randomBytes(32).toString('base64url');
}

export async function getSeatState(ownerId: string): Promise<SeatState> {
  const svc = getServerSupabase();

  const { data: sub } = await svc
    .from('subscriptions')
    .select('id, seats')
    .eq('user_id', ownerId)
    .maybeSingle();

  const seats = parseSeats((sub as { seats?: number } | null)?.seats ?? 1);
  const subscriptionId = (sub as { id?: string } | null)?.id ?? null;
  const extraSeats = Math.max(0, seats - 1);

  if (!subscriptionId) {
    return { seats, extraSeats, used: 0, available: extraSeats, members: [], subscriptionId: null };
  }

  const { data } = await svc
    .from('subscription_seats')
    .select('id, email, member_id, invited_at, accepted_at, revoked_at')
    .eq('subscription_id', subscriptionId)
    .is('revoked_at', null)
    .order('invited_at', { ascending: true });

  const members = (data ?? []) as SeatRow[];

  return {
    seats,
    extraSeats,
    used: members.length,
    available: Math.max(0, extraSeats - members.length),
    subscriptionId,
  members,
  };
}

export type InviteResult =
  | { ok: true; seat: SeatRow; token: string }
  | { ok: false; reason: 'invalid_email' | 'no_subscription' | 'no_seats_available' | 'already_invited' | 'self' | 'persist_failed' };

export async function inviteSeat(args: {
  ownerId: string;
  ownerEmail: string | null;
  email: string;
}): Promise<InviteResult> {
  const email = normalizeEmail(args.email);

  if (!looksLikeEmail(email)) return { ok: false, reason: 'invalid_email' };
  if (email === normalizeEmail(args.ownerEmail)) return { ok: false, reason: 'self' };

  const state = await getSeatState(args.ownerId);
  if (!state.subscriptionId) return { ok: false, reason: 'no_subscription' };
  if (state.members.some((m) => m.email === email)) return { ok: false, reason: 'already_invited' };
  if (state.available <= 0) return { ok: false, reason: 'no_seats_available' };

  const token = newInviteToken();
  const svc = getServerSupabase();

  const { data, error } = await svc
    .from('subscription_seats')
    .insert({
      subscription_id: state.subscriptionId,
      owner_id: args.ownerId,
      email,
      invite_token: token,
    })
    .select('id, email, member_id, invited_at, accepted_at, revoked_at')
    .maybeSingle();

  if (error || !data) {
    console.error('[seats] invite persist failed:', error?.message);
    return { ok: false, reason: 'persist_failed' };
  }

  return { ok: true, seat: data as SeatRow, token };
}

/** Revogar libera a vaga na hora e derruba o acesso do convidado (o RPC de
 *  acesso ignora linhas revogadas). */
export async function revokeSeat(ownerId: string, seatId: string): Promise<boolean> {
  const svc = getServerSupabase();

  const { data, error } = await svc
    .from('subscription_seats')
    .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', seatId)
    .eq('owner_id', ownerId) // defesa em profundidade: nunca revogar acesso de outro titular
    .is('revoked_at', null)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[seats] revoke failed:', error.message);
    return false;
  }
  return !!data;
}

export async function getSeatByToken(token: string): Promise<
  | {
      seat: SeatRow & { owner_id: string; subscription_id: string };
      ownerName: string | null;
      ownerEmail: string | null;
    }
  | null
> {
  if (!token) return null;
  const svc = getServerSupabase();

  const { data } = await svc
    .from('subscription_seats')
    .select('id, email, member_id, invited_at, accepted_at, revoked_at, owner_id, subscription_id')
    .eq('invite_token', token)
    .is('revoked_at', null)
    .maybeSingle();

  if (!data) return null;

  const seat = data as SeatRow & { owner_id: string; subscription_id: string };

  const { data: ownerProfile } = await svc
    .from('profiles_with_email')
    .select('email, full_name, display_name')
    .eq('id', seat.owner_id)
    .maybeSingle();

  const owner = ownerProfile as
    | { email?: string | null; full_name?: string | null; display_name?: string | null }
    | null;

  return {
    seat,
    ownerName: owner?.full_name ?? owner?.display_name ?? null,
    ownerEmail: owner?.email ?? null,
  };
}

export type AcceptResult =
  | { ok: true; email: string; created: boolean }
  | { ok: false; reason: 'invalid_token' | 'already_accepted' | 'weak_password' | 'create_failed' };

/** Aceita o convite: cria a conta (ou vincula uma já existente) e marca a
 *  licença como ativa. A partir daí o acesso vem da assinatura do titular. */
export async function acceptInvite(args: {
  token: string;
  password: string;
  fullName?: string;
}): Promise<AcceptResult> {
  const found = await getSeatByToken(args.token);
  if (!found) return { ok: false, reason: 'invalid_token' };
  if (found.seat.accepted_at) return { ok: false, reason: 'already_accepted' };

  const svc = getServerSupabase();
  const email = found.seat.email;

  // Conta já existe? Então é só vincular — não mexemos na senha de ninguém.
  const { data: existingId } = await svc.rpc('user_id_by_email', { p_email: email });
  let userId = (existingId as string | null) ?? null;
  let created = false;

  if (!userId) {
    if (!args.password || args.password.length < 8) {
      return { ok: false, reason: 'weak_password' };
    }

    const { data, error } = await svc.auth.admin.createUser({
      email,
      password: args.password,
      email_confirm: true, // o convite chegou no e-mail: já é prova de posse
      user_metadata: args.fullName ? { full_name: args.fullName } : undefined,
    });

    if (error || !data.user) {
      console.error('[seats] createUser failed:', error?.message);
      return { ok: false, reason: 'create_failed' };
    }

    userId = data.user.id;
    created = true;

    if (args.fullName) {
      await svc.from('profiles').update({ full_name: args.fullName }).eq('id', userId);
    }
  }

  const { error: linkError } = await svc
    .from('subscription_seats')
    .update({
      member_id: userId,
      accepted_at: new Date().toISOString(),
      invite_token: null, // token é de uso único
      updated_at: new Date().toISOString(),
    })
    .eq('id', found.seat.id);

  if (linkError) {
    console.error('[seats] link failed:', linkError.message);
    return { ok: false, reason: 'create_failed' };
  }

  return { ok: true, email, created };
}

export function inviteUrl(token: string): string {
  return `${configuredAppUrl()}/convite/${token}`;
}

/** Envio fail-soft (mesmo padrão dos outros e-mails do produto): se o SMTP
 *  não estiver configurado ou falhar, a licença continua criada e o titular
 *  pode reenviar. Nunca derruba o fluxo de quem chamou. */
export async function sendSeatInvite(args: {
  to: string;
  token: string;
  inviterName: string | null;
  inviterEmail: string | null;
}): Promise<{ ok: boolean }> {
  try {
    const { subject, html } = buildSeatInviteEmail({
      inviterName: args.inviterName,
      inviterEmail: args.inviterEmail,
      link: inviteUrl(args.token),
    });

    const res = await sendEmail({ to: args.to, subject, html });
    return { ok: res.ok };
  } catch (err) {
    console.error('[seats] invite email failed:', err);
    return { ok: false };
  }
}

/** Token de um convite ainda pendente, pra reenvio. Owner-scoped. */
export async function getPendingToken(
  ownerId: string,
  seatId: string,
): Promise<{ token: string; email: string } | null> {
  const svc = getServerSupabase();

  const { data } = await svc
    .from('subscription_seats')
    .select('invite_token, email, accepted_at')
    .eq('id', seatId)
    .eq('owner_id', ownerId)
    .is('revoked_at', null)
    .maybeSingle();

  const row = data as { invite_token: string | null; email: string; accepted_at: string | null } | null;
  if (!row || row.accepted_at || !row.invite_token) return null;

  return { token: row.invite_token, email: row.email };
}

/** Cria as licenças e dispara os convites logo após o cadastro, a partir dos
 *  e-mails que o comprador digitou no passo "Plano". Fail-soft por completo:
 *  qualquer erro aqui não pode derrubar um cadastro que já foi pago — o
 *  titular sempre pode convidar depois em /account/billing. */
export async function provisionSeatsFromSignup(args: {
  ownerId: string;
  ownerEmail: string | null;
  ownerName: string | null;
  emails: string[];
}): Promise<void> {
  try {
    for (const raw of args.emails) {
      const result = await inviteSeat({
        ownerId: args.ownerId,
        ownerEmail: args.ownerEmail,
        email: raw,
      });

      if (!result.ok) {
        console.warn('[seats] convite pulado no cadastro:', result.reason);
        continue;
      }

      await sendSeatInvite({
        to: result.seat.email,
        token: result.token,
        inviterName: args.ownerName,
        inviterEmail: args.ownerEmail,
      });
    }
  } catch (err) {
    console.error('[seats] provisionamento pós-cadastro falhou:', err);
  }
}
