import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser, NotAuthenticated } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';
import {
  createAsaasCustomer,
  createAsaasSubscription,
  AsaasError,
} from '@/lib/billing/asaas';
import { getSubscription } from '@/lib/billing/subscription';
import { getBillingSettings } from '@/lib/billing/settings';
import { callbackBaseUrl } from '@/lib/billing/callback';
import { isValidCpf, formatCpf } from '@/lib/validators/cpf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Sub-projeto 27 — POST /api/billing/checkout
//
// 1. requireUser
// 2. Body: { name, cpf } (CPF validado server-side)
// 3. Race protection: já tem subscription pending<1h ou active → 409
// 4. Reusa asaas_customer_id se existir (caso de re-assinatura)
// 5. Cria Asaas subscription com billingType='UNDEFINED' → user escolhe
//    cartão/Pix no hosted checkout
// 6. Persiste subscription row (status='pending')
// 7. Retorna { checkoutUrl } pro client redirecionar

const Body = z.object({
  name: z.string().trim().min(2).max(120),
  cpf: z.string(),
  phone: z.string().optional(),
  professionalRequirement: z.string().trim().max(255).optional(),
});

const PENDING_GRACE_MS = 60 * 60 * 1000; // 1h

/** Data da 1ª cobrança (YYYY-MM-DD) = hoje + trialDays. Antes disso o cliente
 *  usa os dias grátis com o cartão já cadastrado. */
function firstChargeDate(trialDays: number): { date: string; iso: string } {
  const d = new Date();
  d.setDate(d.getDate() + Math.max(0, trialDays));
  return { date: d.toISOString().slice(0, 10), iso: d.toISOString() };
}

export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser();
    console.log('USER ID:', user.id);
    
  } catch (err) {
    if (err instanceof NotAuthenticated) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    throw err;
  }

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

const cpf = formatCpf(parsed.cpf);

if (!isValidCpf(cpf)) {
  return NextResponse.json({ error: 'invalid_cpf' }, { status: 400 });
}

const svc = getServerSupabase();

const result = await svc
  .from('profiles')
  .update({
    full_name: parsed.name,
    cpf_cnpj: cpf,
    phone: parsed.phone ?? null,
    professional_requirement: parsed.professionalRequirement ?? null,
  })
  .eq('id', user.id)
  .select();

console.log('PROFILE UPDATE RESULT:', result);



  // Race protection
  const existing = await getSubscription(user.id);
if (existing) {
  const hasPaidSubscription =
    !!existing.asaas_subscription_id;

  if (
    hasPaidSubscription &&
    (existing.status === 'active' ||
      existing.status === 'past_due')
  ) {
    return NextResponse.json(
      { error: 'already_subscribed' },
      { status: 409 },
    );
  }
    if (existing.status === 'pending') {
      const ageMs = Date.now() - new Date(existing.created_at).getTime();
      if (ageMs < PENDING_GRACE_MS && existing.asaas_subscription_id) {
        // Subscription pendente recente — retorna o checkout existente
        // em vez de criar duplicate.
        // Vamos consultar Asaas pra pegar a invoiceUrl atual via
        // getAsaasSubscription? Por simplicidade, indicamos só ao
        // client recuperar via /account/billing.
        return NextResponse.json(
          { error: 'checkout_in_progress' },
          { status: 409 },
        );
      }
    }
  }

  // Cria ou reusa Asaas customer
  let asaasCustomerId = existing?.asaas_customer_id ?? null;
  if (!asaasCustomerId) {
    try {
      const customer = await createAsaasCustomer({
        name: parsed.name,
        email: user.email ?? '',
        cpfCnpj: cpf,
      });
      asaasCustomerId = customer.id;
    } catch (err) {
      console.error('[billing/checkout] createCustomer failed:', err);
      if (err instanceof AsaasError && err.status === 400) {
        return NextResponse.json({ error: 'invalid_customer_data' }, { status: 400 });
      }
      return NextResponse.json({ error: 'billing_provider_error' }, { status: 502 });
    }
  }

  // Config administrável (preço + dias de trial)
  const settings = await getBillingSettings();
  const charge = firstChargeDate(settings.trialDays);
  const priceLabel = `R$ ${settings.planPrice.toFixed(2).replace('.', ',')}`;

  // Cria Asaas subscription — cartão obrigatório (trial), 1ª cobrança só
  // após os dias grátis (nextDueDate = hoje + trialDays).
  let subscriptionResult;
  try {
    subscriptionResult = await createAsaasSubscription({
      customerId: asaasCustomerId,
      value: settings.planPrice,
      cycle: 'MONTHLY',
      billingType: 'CREDIT_CARD', // cartão pra cadastrar e cobrar pós-trial
      description: `PROGPT Pro · ${priceLabel}/mês (${settings.trialDays} dias grátis)`,
      nextDueDate: charge.date,
      callback: {
        // Volta do hosted checkout do Asaas → /assinar/concluido confirma o
        // trial (marca 'trialing') mesmo antes do webhook chegar, e manda o
        // usuário direto pro /chat já liberado.
        successUrl: `${callbackBaseUrl(req)}/assinar/concluido`,
        autoRedirect: true,
      },
    });
  } catch (err) {
    console.error('[billing/checkout] createSubscription failed:', err);
    return NextResponse.json({ error: 'billing_provider_error' }, { status: 502 });
  }

  // Persist subscription row. status='pending' até o webhook do Asaas
  // confirmar o cadastro do cartão → vira 'trialing' (acesso liberado até
  // trial_end). trial_end já é gravado aqui = data da 1ª cobrança.
  const subRow = {
    user_id: user.id,
    asaas_customer_id: asaasCustomerId,
    asaas_subscription_id: subscriptionResult.id,
    status: 'pending' as const,
    plan: 'pro',
    payment_method: 'credit_card' as const,
    current_period_start: null,
    current_period_end: null,
    trial_end: charge.iso,
    cancel_at_period_end: false,
    cancelled_at: null,
    updated_at: new Date().toISOString(),
  };
  const { error: upsertErr } = await svc
    .from('subscriptions')
    .upsert(subRow, { onConflict: 'user_id' });
  if (upsertErr) {
    console.error('[billing/checkout] upsert failed:', upsertErr.message);
    return NextResponse.json({ error: 'persist_failed' }, { status: 500 });
  }

  return NextResponse.json({ checkoutUrl: subscriptionResult.invoiceUrl });
}
