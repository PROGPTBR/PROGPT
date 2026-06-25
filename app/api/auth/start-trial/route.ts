import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSupabase } from '@/lib/db/supabase';
import { verifyTurnstileToken, getClientIp, hashIp } from '@/lib/captcha';
import { checkAnonRateLimit } from '@/lib/rate-limit';
import {
  createAsaasCustomer,
  createAsaasSubscription,
  AsaasError,
} from '@/lib/billing/asaas';
import { getBillingSettings } from '@/lib/billing/settings';
import { isValidCpf, formatCpf } from '@/lib/validators/cpf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Sub-projeto 36.2 — início do onboarding card-first.
//
// Coleta nome/CPF/e-mail (SEM senha), cria customer + subscription no Asaas e
// guarda um `pending_signups`. Retorna o checkoutUrl do Asaas pro cartão. A
// conta (auth.users) só nasce DEPOIS do cartão (ver lib/billing/onboarding.ts,
// chamado no retorno /assinar/concluido?token=... e no webhook).

const Body = z.object({
  email: z.string().email(),
  name: z.string().trim().min(2).max(120),
  cpf: z.string(),
  phone: z.string().optional(),
  professionalRequirement: z.string().trim().max(255).optional(),
  captchaToken: z.string().min(1).nullable().optional(),
  acceptedTerms: z.literal(true),
});

// Base do callback do Asaas — precisa ser o domínio aprovado no Asaas
// (APP_URL, ex.: https://app.2bsupply.com.br). Cai na origem do request só
// quando APP_URL não está setado.
function callbackBase(req: Request): string {
  const envUrl = process.env.APP_URL?.trim();
  if (envUrl) return envUrl.replace(/\/+$/, '');
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

function firstChargeDate(trialDays: number): { date: string; iso: string } {
  const d = new Date();
  d.setDate(d.getDate() + Math.max(0, trialDays));
  return { date: d.toISOString().slice(0, 10), iso: d.toISOString() };
}

export async function POST(req: Request) {
  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const ip = getClientIp(req);
  const captchaOk = await verifyTurnstileToken(parsed.captchaToken, ip);
  if (!captchaOk) {
    return NextResponse.json({ error: 'captcha_invalid' }, { status: 403 });
  }

  const rl = await checkAnonRateLimit('signup', hashIp(ip));
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', retry_after_secs: rl.retryAfterSecs },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSecs) } },
    );
  }

  const cpf = formatCpf(parsed.cpf);
  if (!isValidCpf(cpf)) {
    return NextResponse.json({ error: 'invalid_cpf' }, { status: 400 });
  }

  const svc = getServerSupabase();

  // E-mail já tem conta? → manda logar (não cria customer duplicado).
  const { data: existingUserId } = await svc.rpc('user_id_by_email', {
    p_email: parsed.email,
  });
  if (existingUserId) {
    return NextResponse.json({ error: 'user_already_exists' }, { status: 409 });
  }

  // Cria customer no Asaas.
  let asaasCustomerId: string;
  try {
    const customer = await createAsaasCustomer({
      name: parsed.name,
      email: parsed.email,
      cpfCnpj: cpf,
    });
    asaasCustomerId = customer.id;
  } catch (err) {
    console.error('[start-trial] createCustomer failed:', err);
    if (err instanceof AsaasError && err.status === 400) {
      return NextResponse.json({ error: 'invalid_customer_data' }, { status: 400 });
    }
    return NextResponse.json({ error: 'billing_provider_error' }, { status: 502 });
  }

  const settings = await getBillingSettings();
  const charge = firstChargeDate(settings.trialDays);
  const priceLabel = `R$ ${settings.planPrice.toFixed(2).replace('.', ',')}`;
  const token = crypto.randomUUID();

  // Cria subscription no Asaas com retorno carregando o token (identifica o
  // pending no retorno do checkout).
  let subscriptionResult;
  try {
    subscriptionResult = await createAsaasSubscription({
      customerId: asaasCustomerId,
      value: settings.planPrice,
      cycle: 'MONTHLY',
      billingType: 'CREDIT_CARD',
      description: `PROGPT Pro · ${priceLabel}/mês (${settings.trialDays} dias grátis)`,
      nextDueDate: charge.date,
      callback: {
        successUrl: `${callbackBase(req)}/assinar/concluido?token=${token}`,
        autoRedirect: true,
      },
    });
  } catch (err) {
    console.error('[start-trial] createSubscription failed:', err);
    return NextResponse.json({ error: 'billing_provider_error' }, { status: 502 });
  }

  // Guarda o pending. A conta NÃO é criada aqui — só após o cartão.
  const { error: insErr } = await svc.from('pending_signups').insert({
    token,
    email: parsed.email,
    full_name: parsed.name,
    cpf,
    phone: parsed.phone ?? null,
    professional_requirement: parsed.professionalRequirement ?? null,
    accepted_terms: true,
    asaas_customer_id: asaasCustomerId,
    asaas_subscription_id: subscriptionResult.id,
    trial_end: charge.iso,
    status: 'awaiting_card',
  });
  if (insErr) {
    console.error('[start-trial] pending insert failed:', insErr.message);
    return NextResponse.json({ error: 'persist_failed' }, { status: 500 });
  }

  return NextResponse.json({ checkoutUrl: subscriptionResult.invoiceUrl });
}
