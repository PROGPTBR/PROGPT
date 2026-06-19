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

const PRO_PRICE = 99.0;
const PENDING_GRACE_MS = 60 * 60 * 1000; // 1h

function originFrom(req: Request): string {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

function nextDueDate(): string {
  // Asaas exige YYYY-MM-DD na timezone America/Sao_Paulo. Setamos
  // tomorrow no horário local pra evitar criar charge "hoje" que pode
  // confundir billing cycle.
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
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

  // Cria Asaas subscription
  let subscriptionResult;
  try {
    subscriptionResult = await createAsaasSubscription({
      customerId: asaasCustomerId,
      value: PRO_PRICE,
      cycle: 'MONTHLY',
      billingType: 'UNDEFINED', // user escolhe no checkout
      description: 'PROGPT Pro · R$ 99/mês',
      nextDueDate: nextDueDate(),
      callback: {
        successUrl: `${originFrom(req)}/account/billing?success=1`,
        autoRedirect: true,
      },
    });
  } catch (err) {
    console.error('[billing/checkout] createSubscription failed:', err);
    return NextResponse.json({ error: 'billing_provider_error' }, { status: 502 });
  }

  // Persist subscription row (upsert — se existing.id, atualiza; senão insert)
  const subRow = {
    user_id: user.id,
    asaas_customer_id: asaasCustomerId,
    asaas_subscription_id: subscriptionResult.id,
    status: 'pending' as const,
    plan: 'pro',
    payment_method: null,
    current_period_start: null,
    current_period_end: null,
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
