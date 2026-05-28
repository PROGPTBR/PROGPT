import { NextResponse } from 'next/server';
import { requireUser, NotAuthenticated } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';
import { getSubscription } from '@/lib/billing/subscription';
import { cancelAsaasSubscription, AsaasError } from '@/lib/billing/asaas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Sub-projeto 27 — POST /api/billing/cancel
//
// Cancela a subscription do user no Asaas. Local: marca
// cancel_at_period_end=true. User mantém Pro até webhook
// SUBSCRIPTION_DELETED chegar (Asaas dispara após fim do ciclo) ou
// até current_period_end.

export async function POST() {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof NotAuthenticated) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    throw err;
  }

  const sub = await getSubscription(user.id);
  if (!sub || !sub.asaas_subscription_id) {
    return NextResponse.json({ error: 'no_subscription' }, { status: 404 });
  }
  if (sub.status === 'cancelled' || sub.status === 'expired') {
    return NextResponse.json({ error: 'already_cancelled' }, { status: 409 });
  }

  try {
    await cancelAsaasSubscription(sub.asaas_subscription_id);
  } catch (err) {
    console.error('[billing/cancel] Asaas cancel failed:', err);
    if (err instanceof AsaasError && err.status === 404) {
      // Asaas já não tem — segue mesmo assim pra limpar local
    } else {
      return NextResponse.json({ error: 'billing_provider_error' }, { status: 502 });
    }
  }

  const svc = getServerSupabase();
  const { error } = await svc
    .from('subscriptions')
    .update({
      cancel_at_period_end: true,
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', sub.id);
  if (error) {
    console.error('[billing/cancel] update failed:', error.message);
    return NextResponse.json({ error: 'persist_failed' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    accessUntil: sub.current_period_end,
  });
}
