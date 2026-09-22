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
import {
  parseSeats,
  seatsTotal,
  seatsLabel,
  seatsChargeSummary,
  normalizeSeatEmails,
  MIN_SEATS,
  MAX_SEATS,
} from '@/lib/billing/seats';
import { callbackBaseUrl } from '@/lib/billing/callback';
import { isValidCpf, formatCpf } from '@/lib/validators/cpf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  name: z.string().trim().min(2).max(120),
  cpf: z.string(),
  phone: z.string().optional(),
  professionalRequirement: z.string().trim().max(255).optional(),
  seats: z.coerce.number().int().min(MIN_SEATS).max(MAX_SEATS).optional(),
  seatEmails: z.array(z.string()).max(MAX_SEATS).optional(),
});

const PENDING_GRACE_MS = 60 * 60 * 1000;

function firstChargeDate(trialDays: number): { date: string; iso: string } {
  const d = new Date();
  d.setDate(d.getDate() + Math.max(0, trialDays));

  return {
    date: d.toISOString().slice(0, 10),
    iso: d.toISOString(),
  };
}

export async function POST(req: Request) {
  let user;

  try {
    user = await requireUser();
    console.log('USER ID:', user.id);
  } catch (err) {
    if (err instanceof NotAuthenticated) {
      return NextResponse.json(
        {
          error: 'unauthorized',
          message: 'Sua sessão expirou. Faça login novamente para continuar.',
        },
        { status: 401 },
      );
    }

    throw err;
  }

  let parsed: z.infer<typeof Body>;

  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json(
      {
        error: 'invalid_body',
        message: 'Alguns dados estão inválidos. Verifique os campos e tente novamente.',
      },
      { status: 400 },
    );
  }

  const cpf = formatCpf(parsed.cpf);

  if (!isValidCpf(cpf)) {
    return NextResponse.json(
      {
        error: 'invalid_cpf',
        message: 'CPF inválido. Verifique o número informado e tente novamente.',
      },
      { status: 400 },
    );
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

  // =========================================================
  // PROTEÇÃO CONTRA ASSINATURA DUPLICADA
  // =========================================================

  const existing = await getSubscription(user.id);

  if (existing) {
    const hasPaidSubscription = !!existing.asaas_subscription_id;

    if (
      hasPaidSubscription &&
      (existing.status === 'active' ||
        existing.status === 'past_due')
    ) {
      return NextResponse.json(
        {
          error: 'already_subscribed',
          message: 'Você já possui uma assinatura ativa.',
        },
        { status: 409 },
      );
    }

    if (existing.status === 'pending') {
      const ageMs =
        Date.now() -
        new Date(existing.created_at).getTime();

      if (
        ageMs < PENDING_GRACE_MS &&
        existing.asaas_subscription_id
      ) {
        return NextResponse.json(
          {
            error: 'checkout_in_progress',
            message:
              'Já existe uma contratação em andamento. Aguarde alguns instantes antes de tentar novamente.',
          },
          { status: 409 },
        );
      }
    }
  }

  // =========================================================
  // CLIENTE ASAAS
  // =========================================================

  let asaasCustomerId =
    existing?.asaas_customer_id ?? null;

  if (!asaasCustomerId) {
    try {
      const customer =
        await createAsaasCustomer({
          name: parsed.name,
          email: user.email ?? '',
          cpfCnpj: cpf,
        });

      asaasCustomerId = customer.id;
    } catch (err) {
      console.error(
        '[billing/checkout] createCustomer failed:',
        err,
      );

      if (
        err instanceof AsaasError &&
        err.status === 400
      ) {
        return NextResponse.json(
          {
            error: 'invalid_customer_data',
            message:
              'Não foi possível validar seus dados. Verifique o nome e o CPF informados.',
          },
          { status: 400 },
        );
      }

      return NextResponse.json(
        {
          error: 'billing_provider_error',
          message:
            'Não foi possível acessar o sistema de pagamentos agora. Tente novamente em alguns instantes.',
        },
        { status: 502 },
      );
    }
  }

  // =========================================================
  // CONFIGURAÇÃO DA ASSINATURA
  // =========================================================

  const settings =
    await getBillingSettings();

  const charge =
    firstChargeDate(settings.trialDays);

  const seats =
    parseSeats(parsed.seats);

  const seatEmails =
    normalizeSeatEmails(
      parsed.seatEmails,
      seats,
    );

  const monthlyTotal =
    seatsTotal(
      settings.planPrice,
      seats,
    );

  const priceLabel =
    seatsChargeSummary(
      settings.planPrice,
      seats,
    );

  // =========================================================
  // CRIA ASSINATURA ASAAS
  // =========================================================

  let subscriptionResult;

  try {
    subscriptionResult =
      await createAsaasSubscription({
        customerId: asaasCustomerId,
        value: monthlyTotal,
        cycle: 'MONTHLY',
        billingType: 'CREDIT_CARD',

        description:
          `PROGPT Pro · ${seatsLabel(seats)} · ${priceLabel} (${settings.trialDays} dias grátis)`,

        nextDueDate: charge.date,

        callback: {
          successUrl:
            `${callbackBaseUrl(req)}/assinar/concluido`,

          autoRedirect: true,
        },
      });
  } catch (err) {
    console.error(
      '[billing/checkout] createSubscription failed:',
      err,
    );

    return NextResponse.json(
      {
        error: 'billing_provider_error',
        message:
          'Não foi possível iniciar o pagamento. Tente novamente em alguns instantes.',
      },
      { status: 502 },
    );
  }

  // =========================================================
  // SALVA ASSINATURA
  // =========================================================

  const subRow = {
    user_id: user.id,
    asaas_customer_id: asaasCustomerId,
    asaas_subscription_id:
      subscriptionResult.id,

    status: 'pending' as const,
    plan: 'pro',

    seats,
    seat_emails: seatEmails,

    payment_method:
      'credit_card' as const,

    current_period_start: null,
    current_period_end: null,

    trial_end: charge.iso,

    cancel_at_period_end: false,
    cancelled_at: null,

    updated_at:
      new Date().toISOString(),
  };

  const { error: upsertErr } =
    await svc
      .from('subscriptions')
      .upsert(
        subRow,
        {
          onConflict: 'user_id',
        },
      );

  if (upsertErr) {
    console.error(
      '[billing/checkout] upsert failed:',
      upsertErr.message,
    );

    return NextResponse.json(
      {
        error: 'persist_failed',
        message:
          'O pagamento foi iniciado, mas houve um problema ao salvar sua assinatura. Tente novamente.',
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    checkoutUrl:
      subscriptionResult.invoiceUrl,
  });
}