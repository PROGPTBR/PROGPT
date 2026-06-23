import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/db/supabase';
import { sendEmail } from '@/lib/email/client';
import {
  buildPaymentConfirmedEmail,
  buildPaymentOverdueEmail,
} from '@/lib/email/templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Sub-projeto 27 — webhook receiver do Asaas.
//
// Asaas envia POST com JSON `{ id, event, payment: { subscription, ... } }`
// e header `asaas-access-token: <ASAAS_WEBHOOK_TOKEN>` (configurado no
// painel Asaas).
//
// Idempotência: insert no `billing_webhook_events` com unique
// constraint em asaas_event_id. Asaas re-envia 3x em caso de erro
// de processamento — só processamos a primeira.
//
// Source-of-truth do estado da subscription: este endpoint.

type AsaasEvent = {
  id: string;
  event: string;
  payment?: {
    id: string;
    subscription?: string;
    status?: string;
    billingType?: string;
    value?: number;
    confirmedDate?: string;
    paymentDate?: string;
    dueDate?: string;
  };
  subscription?: {
    id: string;
    status?: string;
  };
};

const PAID_EVENTS = ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'];
const PAST_DUE_EVENTS = ['PAYMENT_OVERDUE'];
const CANCEL_EVENTS = [
  'PAYMENT_REFUNDED',
  'PAYMENT_REFUND_IN_PROGRESS',
  'PAYMENT_DELETED',
  'SUBSCRIPTION_DELETED',
];
// Sub-projeto 36 — cartão cadastrado no checkout → Asaas cria a 1ª cobrança
// (datada pós-trial) e dispara PAYMENT_CREATED. Numa assinatura ainda
// 'pending', isso significa "cartão confirmado" → libera os 3 dias de trial.
const TRIAL_START_EVENTS = ['PAYMENT_CREATED'];

// Eventos informativos do Asaas que NÃO mudam o estado da nossa
// subscription — ignoramos de propósito, sem ruído de log. Qualquer
// evento fora desta lista E fora dos buckets acima é "unhandled": logamos
// um warn (vira sinal no Railway / Sentry) pra não dropar em silêncio um
// evento que talvez devesse mexer no estado (ex.: chargeback novo).
const KNOWN_IGNORED_EVENTS = new Set([
  'PAYMENT_UPDATED',
  'PAYMENT_AWAITING_RISK_ANALYSIS',
  'PAYMENT_APPROVED_BY_RISK_ANALYSIS',
  'PAYMENT_REPROVED_BY_RISK_ANALYSIS',
  'PAYMENT_BANK_SLIP_VIEWED',
  'PAYMENT_CHECKOUT_VIEWED',
  'PAYMENT_ANTICIPATED',
  'PAYMENT_DUNNING_RECEIVED',
  'PAYMENT_DUNNING_REQUESTED',
  'SUBSCRIPTION_CREATED',
  'SUBSCRIPTION_UPDATED',
]);

const HANDLED_EVENTS = new Set([
  ...PAID_EVENTS,
  ...PAST_DUE_EVENTS,
  ...CANCEL_EVENTS,
  ...TRIAL_START_EVENTS,
]);

function mapBillingType(t: string | undefined): 'credit_card' | 'pix' | 'boleto' | null {
  switch (t) {
    case 'CREDIT_CARD':
      return 'credit_card';
    case 'PIX':
      return 'pix';
    case 'BOLETO':
      return 'boleto';
    default:
      return null;
  }
}

function addMonth(iso: string): string {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

export async function POST(req: Request) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  const got = req.headers.get('asaas-access-token');
  if (!expected || got !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let event: AsaasEvent;
  try {
    event = (await req.json()) as AsaasEvent;
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  if (!event?.id || !event?.event) {
    return NextResponse.json({ error: 'missing_event_fields' }, { status: 400 });
  }

  const svc = getServerSupabase();

  // Idempotency insert. Se conflito (já processado) → 200.
  const { error: insertErr } = await svc
    .from('billing_webhook_events')
    .insert({
      asaas_event_id: event.id,
      event_type: event.event,
      payload: event as unknown as Record<string, unknown>,
    });
  if (insertErr) {
    // Pg unique violation code 23505 → já processado
    if ((insertErr as { code?: string }).code === '23505') {
      return NextResponse.json({ ok: true, deduped: true });
    }
    console.error('[billing/webhook] insert event failed:', insertErr.message);
    return NextResponse.json({ error: 'persist_failed' }, { status: 500 });
  }

  // Resolve subscription_id alvo
  const asaasSubId =
    event.payment?.subscription ?? event.subscription?.id ?? null;
  if (!asaasSubId) {
    // Evento sem subscription_id — só log e marca processado (ex.: eventos
    // de customer-level que não nos interessam)
    await svc
      .from('billing_webhook_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('asaas_event_id', event.id);
    return NextResponse.json({ ok: true, skipped: true });
  }

  // Carrega subscription do nosso DB
  const { data: sub, error: loadErr } = await svc
    .from('subscriptions')
    .select('*')
    .eq('asaas_subscription_id', asaasSubId)
    .maybeSingle();
  if (loadErr) {
    console.error('[billing/webhook] load sub failed:', loadErr.message);
    return NextResponse.json({ error: 'persist_failed' }, { status: 500 });
  }
  if (!sub) {
    // Subscription nossa não encontrada — pode ter sido apagada via
    // account-delete enquanto o webhook estava em retry. Marca
    // processado e segue.
    await svc
      .from('billing_webhook_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('asaas_event_id', event.id);
    return NextResponse.json({ ok: true, orphan: true });
  }

  // Compute new state
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (PAID_EVENTS.includes(event.event)) {
    update.status = 'active';
    update.payment_method = mapBillingType(event.payment?.billingType);
    const paid =
      event.payment?.confirmedDate ?? event.payment?.paymentDate ?? null;
    if (paid) {
      update.current_period_start = new Date(paid).toISOString();
      update.current_period_end = addMonth(paid);
    }
    // Se estava cancel_at_period_end e voltou a pagar, reset (raro)
    update.cancel_at_period_end = false;
    update.cancelled_at = null;
  } else if (PAST_DUE_EVENTS.includes(event.event)) {
    update.status = 'past_due';
  } else if (CANCEL_EVENTS.includes(event.event)) {
    update.status = 'cancelled';
    update.cancelled_at = new Date().toISOString();
  } else if (TRIAL_START_EVENTS.includes(event.event)) {
    // Cartão cadastrado → libera o trial. Só transiciona quando ainda
    // 'pending' (cobranças de renovação também disparam PAYMENT_CREATED, mas
    // aí a sub já está active/trialing → no-op).
    if (sub.status === 'pending') {
      update.status = 'trialing';
      update.payment_method =
        mapBillingType(event.payment?.billingType) ?? sub.payment_method;
    }
  }

  // Evento que não cai em nenhum bucket conhecido nem na lista de
  // ignorados benignos — logar pra ficar visível (no silent drop).
  const unhandledEvent =
    !HANDLED_EVENTS.has(event.event) && !KNOWN_IGNORED_EVENTS.has(event.event)
      ? event.event
      : null;
  if (unhandledEvent) {
    console.warn(
      `[billing/webhook] evento Asaas não tratado: ${unhandledEvent} (event_id=${event.id}, sub=${asaasSubId}) — verificar se deveria mudar estado`,
    );
  }

  if (Object.keys(update).length > 1) {
    const { error: updErr } = await svc
      .from('subscriptions')
      .update(update)
      .eq('id', sub.id);
    if (updErr) {
      console.error('[billing/webhook] update sub failed:', updErr.message);
      // Não marca processed_at — Asaas re-envia
      return NextResponse.json({ error: 'persist_failed' }, { status: 500 });
    }
  }

  // Sub-projeto 30 — email transacional fire-and-forget.
  // Idempotency via Resend `idempotencyKey: event.id` (Asaas garante
  // unique). Subscription cancellation NÃO emite email pelo webhook —
  // /api/billing/cancel já mandou na hora do click. Webhook
  // SUBSCRIPTION_DELETED só persiste status final.
  if (PAID_EVENTS.includes(event.event)) {
    const userEmail = await fetchUserEmail(sub.user_id as string);
    if (userEmail && update.current_period_end) {
      const nextDue = new Date(update.current_period_end as string).toLocaleDateString('pt-BR');
      const tpl = buildPaymentConfirmedEmail({
        email: userEmail,
        amountBrl: typeof event.payment?.value === 'number' ? event.payment.value : 99,
        nextDueDate: nextDue,
      });
      void sendEmail({
        to: userEmail,
        subject: tpl.subject,
        html: tpl.html,
        idempotencyKey: `paid:${event.id}`,
      });
    }
  } else if (PAST_DUE_EVENTS.includes(event.event)) {
    const userEmail = await fetchUserEmail(sub.user_id as string);
    if (userEmail) {
      const accessUntil = sub.current_period_end
        ? new Date(sub.current_period_end as string).toLocaleDateString('pt-BR')
        : 'breve';
      const tpl = buildPaymentOverdueEmail({ email: userEmail, accessUntil });
      void sendEmail({
        to: userEmail,
        subject: tpl.subject,
        html: tpl.html,
        idempotencyKey: `overdue:${event.id}`,
      });
    }
  }

  // Marca processado
  await svc
    .from('billing_webhook_events')
    .update({ processed_at: new Date().toISOString() })
    .eq('asaas_event_id', event.id);

  return NextResponse.json(unhandledEvent ? { ok: true, unhandled: unhandledEvent } : { ok: true });
}

// Helper: busca email do user via auth.users (service-role).
async function fetchUserEmail(userId: string): Promise<string | null> {
  const svc = getServerSupabase();
  const { data, error } = await svc.auth.admin.getUserById(userId);
  if (error) {
    console.warn('[billing/webhook] fetchUserEmail failed:', error.message);
    return null;
  }
  return data.user?.email ?? null;
}
