import { getServerSupabase } from '@/lib/db/supabase';
import { sendEmail, getAppUrl } from '@/lib/email/client';
import { buildSetPasswordEmail } from '@/lib/email/templates';
import { CURRENT_LEGAL_VERSION } from '@/lib/legal/constants';

// Sub-projeto 36.2 — onboarding card-first.
//
// finalizePendingSignup cria a conta (auth.users) DEPOIS do cartão confirmado,
// cria a assinatura local (trialing) e dispara o e-mail "defina sua senha".
// É chamado em dois lugares (retorno do checkout via token + webhook do Asaas)
// e precisa ser idempotente — usamos um CLAIM atômico no `status` pra garantir
// que a conta seja criada uma única vez mesmo com os dois disparando juntos.

export type PendingSignup = {
  id: string;
  token: string;
  email: string;
  full_name: string;
  cpf: string;
  phone: string | null;
  professional_requirement: string | null;
  asaas_customer_id: string;
  asaas_subscription_id: string;
  trial_end: string;
  status: 'awaiting_card' | 'completed';
  user_id: string | null;
};

export type FinalizeResult =
  | { ok: true; email: string; alreadyDone: boolean }
  | { ok: false; reason: 'not_found' | 'no_user' };

function strongRandomPassword(): string {
  // Senha temporária forte (o usuário define a real via link de recovery).
  return (
    'Aa1!' +
    crypto.randomUUID().replace(/-/g, '') +
    crypto.randomUUID().replace(/-/g, '').toUpperCase()
  );
}

async function finalize(pending: PendingSignup): Promise<FinalizeResult> {
  const svc = getServerSupabase();

  // CLAIM atômico: só prossegue quem conseguir virar awaiting_card → completed.
  const { data: claimed } = await svc
    .from('pending_signups')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', pending.id)
    .eq('status', 'awaiting_card')
    .select('id');

  if (!claimed || claimed.length === 0) {
    // Já finalizado por outro caminho (retorno/webhook) — idempotente.
    return { ok: true, email: pending.email, alreadyDone: true };
  }

  // Resolve/cria o usuário.
  let userId: string | null = null;
  const { data: created } = await svc.auth.admin.createUser({
    email: pending.email,
    password: strongRandomPassword(),
    email_confirm: true,
    user_metadata: { full_name: pending.full_name },
  });
  if (created?.user) {
    userId = created.user.id;
  } else {
    // E-mail já existe (raro nesse fluxo) → reaproveita a conta.
    const { data: existingId } = await svc.rpc('user_id_by_email', {
      p_email: pending.email,
    });
    userId = (existingId as string | null) ?? null;
  }
  if (!userId) {
    return { ok: false, reason: 'no_user' };
  }

  // Atualiza perfil com os dados coletados + aceite de termos.
  await svc
    .from('profiles')
    .update({
      full_name: pending.full_name,
      cpf_cnpj: pending.cpf,
      phone: pending.phone,
      professional_requirement: pending.professional_requirement,
      terms_accepted_at: new Date().toISOString(),
      terms_version: CURRENT_LEGAL_VERSION,
    })
    .eq('id', userId);

  // Assinatura local em trial (cartão já cadastrado no Asaas).
  await svc.from('subscriptions').upsert(
    {
      user_id: userId,
      asaas_customer_id: pending.asaas_customer_id,
      asaas_subscription_id: pending.asaas_subscription_id,
      status: 'trialing',
      plan: 'pro',
      payment_method: 'credit_card',
      current_period_start: null,
      current_period_end: null,
      trial_end: pending.trial_end,
      cancel_at_period_end: false,
      cancelled_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  // Vincula a conta criada ao pending (auditoria).
  await svc
    .from('pending_signups')
    .update({ user_id: userId })
    .eq('id', pending.id);

  // E-mail "defina sua senha" (link de recovery → /reset-password).
  try {
    const { data: linkData } = await svc.auth.admin.generateLink({
      type: 'recovery',
      email: pending.email,
      options: { redirectTo: `${getAppUrl()}/reset-password` },
    });
    const actionLink = (
      linkData as { properties?: { action_link?: string } } | null
    )?.properties?.action_link;
    if (actionLink) {
      const tpl = buildSetPasswordEmail({ name: pending.full_name, link: actionLink });
      void sendEmail({
        to: pending.email,
        subject: tpl.subject,
        html: tpl.html,
        idempotencyKey: `setpw:${pending.id}`,
      });
    }
  } catch (err) {
    console.error('[onboarding] set-password email failed:', err);
  }

  return { ok: true, email: pending.email, alreadyDone: false };
}

export async function finalizePendingSignupByToken(
  token: string,
): Promise<FinalizeResult> {
  const svc = getServerSupabase();
  const { data } = await svc
    .from('pending_signups')
    .select('*')
    .eq('token', token)
    .maybeSingle();
  if (!data) return { ok: false, reason: 'not_found' };
  return finalize(data as PendingSignup);
}

export async function finalizePendingSignupByAsaasSub(
  asaasSubId: string,
): Promise<FinalizeResult> {
  const svc = getServerSupabase();
  const { data } = await svc
    .from('pending_signups')
    .select('*')
    .eq('asaas_subscription_id', asaasSubId)
    .maybeSingle();
  if (!data) return { ok: false, reason: 'not_found' };
  return finalize(data as PendingSignup);
}
