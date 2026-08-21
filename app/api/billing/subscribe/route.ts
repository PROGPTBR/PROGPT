import {
  NextResponse,
} from 'next/server';

import { z } from 'zod';

import {
  requireUser,
  NotAuthenticated,
} from '@/lib/auth';

import {
  getServerSupabase,
} from '@/lib/db/supabase';

import {
  createAsaasCustomer,
  createAsaasSubscription,
  cancelAsaasSubscription,
  AsaasError,
} from '@/lib/billing/asaas';

import {
  getSubscription,
} from '@/lib/billing/subscription';

import {
  isValidCpf,
  formatCpf,
} from '@/lib/validators/cpf';

export const runtime =
  'nodejs';

export const dynamic =
  'force-dynamic';

// ============================================================
// POST /api/billing/subscribe
//
// Checkout interno do PROGPT.
//
// O cartão NÃO é salvo no Supabase.
// Ele é recebido por esta rota e enviado diretamente ao Asaas.
// ============================================================

const Body = z.object({
  plan: z.literal('pf-73'),

  customer: z.object({
    name: z
      .string()
      .trim()
      .min(2)
      .max(120),

    email: z
      .string()
      .trim()
      .email()
      .max(255),

    cpfCnpj: z.string(),

    phone: z.string(),

    postalCode: z.string(),

    addressNumber: z
      .string()
      .trim()
      .min(1)
      .max(20),
  }),

  creditCard: z.object({
    holderName: z
      .string()
      .trim()
      .min(2)
      .max(120),

    number: z
      .string()
      .min(13)
      .max(19),

    expiryMonth: z
      .string()
      .regex(
        /^(0[1-9]|1[0-2])$/,
      ),

    expiryYear: z
      .string()
      .regex(
        /^\d{4}$/,
      ),

    ccv: z
      .string()
      .regex(
        /^\d{3,4}$/,
      ),
  }),
});

// ============================================================
// HELPERS
// ============================================================

function onlyNumbers(
  value: string,
) {
  return value.replace(
    /\D/g,
    '',
  );
}

/**
 * Data atual no horário do Brasil.
 *
 * Será usada como nextDueDate.
 * Portanto o cliente que JÁ gastou o trial
 * será cobrado agora.
 */
function todayBrazil(): string {
  const parts =
    new Intl.DateTimeFormat(
      'en-US',
      {
        timeZone:
          'America/Sao_Paulo',

        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      },
    ).formatToParts(
      new Date(),
    );

  const year =
    parts.find(
      (p) =>
        p.type === 'year',
    )?.value;

  const month =
    parts.find(
      (p) =>
        p.type === 'month',
    )?.value;

  const day =
    parts.find(
      (p) =>
        p.type === 'day',
    )?.value;

  return `${year}-${month}-${day}`;
}

/**
 * IP real do dispositivo.
 *
 * Railway/proxy normalmente envia x-forwarded-for.
 */
function getRemoteIp(
  req: Request,
): string | null {
  const forwarded =
    req.headers.get(
      'x-forwarded-for',
    );

  if (forwarded) {
    const ip =
      forwarded
        .split(',')[0]
        ?.trim();

    if (ip) {
      return ip;
    }
  }

  const realIp =
    req.headers
      .get('x-real-ip')
      ?.trim();

  if (realIp) {
    return realIp;
  }

  /**
   * Apenas desenvolvimento local.
   *
   * Em produção não aceitamos fallback.
   */
  if (
    process.env.NODE_ENV !==
    'production'
  ) {
    return '127.0.0.1';
  }

  return null;
}

// ============================================================
// POST
// ============================================================

export async function POST(
  req: Request,
) {
  // ==========================================================
  // USUÁRIO
  // ==========================================================

  let user;

  try {
    user =
      await requireUser();
  } catch (err) {
    if (
      err instanceof
      NotAuthenticated
    ) {
      return NextResponse.json(
        {
          error:
            'unauthorized',
        },
        {
          status: 401,
        },
      );
    }

    throw err;
  }

  // ==========================================================
  // BODY
  // ==========================================================

  let parsed:
    z.infer<typeof Body>;

  try {
    parsed =
      Body.parse(
        await req.json(),
      );
  } catch (err) {
    console.error(
      '[billing/subscribe] invalid body',
      err,
    );

    return NextResponse.json(
      {
        error:
          'invalid_body',

        message:
          'Confira os dados informados.',
      },
      {
        status: 400,
      },
    );
  }

  // ==========================================================
  // NORMALIZA DADOS
  // ==========================================================

  const cpfFormatted =
    formatCpf(
      parsed.customer
        .cpfCnpj,
    );

  if (
    !isValidCpf(
      cpfFormatted,
    )
  ) {
    return NextResponse.json(
      {
        error:
          'invalid_cpf',

        message:
          'CPF inválido.',
      },
      {
        status: 400,
      },
    );
  }

  const cpf =
    onlyNumbers(
      cpfFormatted,
    );

  const phone =
    onlyNumbers(
      parsed.customer.phone,
    );

  const postalCode =
    onlyNumbers(
      parsed.customer
        .postalCode,
    );

  const cardNumber =
    onlyNumbers(
      parsed.creditCard
        .number,
    );

  const ccv =
    onlyNumbers(
      parsed.creditCard.ccv,
    );

  if (
    phone.length < 10 ||
    phone.length > 11
  ) {
    return NextResponse.json(
      {
        error:
          'invalid_phone',

        message:
          'Telefone inválido.',
      },
      {
        status: 400,
      },
    );
  }

  if (
    postalCode.length !== 8
  ) {
    return NextResponse.json(
      {
        error:
          'invalid_postal_code',

        message:
          'CEP inválido.',
      },
      {
        status: 400,
      },
    );
  }

  if (
    cardNumber.length < 13 ||
    cardNumber.length > 19
  ) {
    return NextResponse.json(
      {
        error:
          'invalid_card',

        message:
          'Número do cartão inválido.',
      },
      {
        status: 400,
      },
    );
  }

  // ==========================================================
  // IP
  // ==========================================================

  const remoteIp =
    getRemoteIp(req);

  if (!remoteIp) {
    return NextResponse.json(
      {
        error:
          'remote_ip_unavailable',

        message:
          'Não foi possível identificar a origem da compra.',
      },
      {
        status: 400,
      },
    );
  }

  // ==========================================================
  // SUPABASE
  // ==========================================================

  const svc =
    getServerSupabase();

  // ==========================================================
  // PLANO
  //
  // NUNCA confiar no preço enviado pelo navegador.
  // O valor vem do banco.
  // ==========================================================

  const {
    data: plan,
    error: planError,
  } = await svc
    .from('plans')
    .select(`
      id,
      slug,
      name,
      price
    `)
    .eq(
      'slug',
      parsed.plan,
    )
    .maybeSingle();

  if (
    planError ||
    !plan
  ) {
    console.error(
      '[billing/subscribe] plano não encontrado:',
      planError,
    );

    return NextResponse.json(
      {
        error:
          'invalid_plan',

        message:
          'Plano não encontrado.',
      },
      {
        status: 400,
      },
    );
  }

  const planPrice =
    Number(plan.price);

  if (
    !Number.isFinite(
      planPrice,
    ) ||
    planPrice <= 0
  ) {
    return NextResponse.json(
      {
        error:
          'invalid_plan_price',

        message:
          'O plano possui um valor inválido.',
      },
      {
        status: 500,
      },
    );
  }

  // ==========================================================
  // ASSINATURA ATUAL
  // ==========================================================

  const existing =
    await getSubscription(
      user.id,
    );

  /**
   * Cliente já pagante:
   * não criar outra assinatura.
   */
  if (
    existing
      ?.asaas_subscription_id &&
    (
      existing.status ===
        'active' ||
      existing.status ===
        'past_due'
    )
  ) {
    return NextResponse.json(
      {
        error:
          'already_subscribed',

        message:
          'Você já possui uma assinatura.',
      },
      {
        status: 409,
      },
    );
  }

  /**
   * Segurança contra assinatura duplicada.
   *
   * Se já houver uma assinatura Asaas pendente,
   * não criamos outra automaticamente.
   */
  if (
    existing
      ?.asaas_subscription_id &&
    existing.status ===
      'pending'
  ) {
    return NextResponse.json(
      {
        error:
          'checkout_in_progress',

        message:
          'Já existe uma tentativa de assinatura em andamento.',
      },
      {
        status: 409,
      },
    );
  }

  // ==========================================================
  // PERFIL
  // ==========================================================

  const {
    data: profile,
  } = await svc
    .from('profiles')
    .select(`
      asaas_customer_id
    `)
    .eq(
      'id',
      user.id,
    )
    .maybeSingle();

  /**
   * Atualiza somente dados pessoais.
   *
   * Nenhum dado do cartão é salvo.
   */
  const {
    error:
      profileUpdateError,
  } = await svc
    .from('profiles')
    .update({
      full_name:
        parsed.customer.name,

      cpf_cnpj:
        cpfFormatted,

      phone,
    })
    .eq(
      'id',
      user.id,
    );

  if (
    profileUpdateError
  ) {
    console.error(
      '[billing/subscribe] profile update:',
      profileUpdateError,
    );
  }

  // ==========================================================
  // CUSTOMER ASAAS
  // ==========================================================

  let asaasCustomerId =
    existing
      ?.asaas_customer_id ??
    profile
      ?.asaas_customer_id ??
    null;

  if (
    !asaasCustomerId
  ) {
    try {
      const customer =
        await createAsaasCustomer(
          {
            name:
              parsed.customer
                .name,

            email:
              user.email ??
              parsed.customer
                .email,

            cpfCnpj:
              cpf,

            mobilePhone:
              phone,

            postalCode,

            addressNumber:
              parsed.customer
                .addressNumber,
          },
        );

      asaasCustomerId =
        customer.id;

      /**
       * Guarda customer ID já agora.
       *
       * Assim, se o cartão for recusado,
       * uma nova tentativa reutiliza o cliente
       * em vez de criar duplicado no Asaas.
       */
      await svc
        .from('profiles')
        .update({
          asaas_customer_id:
            asaasCustomerId,
        })
        .eq(
          'id',
          user.id,
        );
    } catch (err) {
      console.error(
        '[billing/subscribe] create customer:',
        err,
      );

      if (
        err instanceof
          AsaasError &&
        err.status === 400
      ) {
        return NextResponse.json(
          {
            error:
              'invalid_customer_data',

            message:
              'Não foi possível validar os dados do titular.',
          },
          {
            status: 400,
          },
        );
      }

      return NextResponse.json(
        {
          error:
            'billing_provider_error',

          message:
            'Não foi possível conectar ao serviço de pagamento.',
        },
        {
          status: 502,
        },
      );
    }
  }

  // ==========================================================
  // ASSINATURA ASAAS
  //
  // IMPORTANTE:
  // O trial JÁ terminou.
  //
  // nextDueDate = hoje
  //
  // Não concedemos outros 3 dias.
  // ==========================================================

  const nextDueDate =
    todayBrazil();

  let subscriptionResult;

  try {
    subscriptionResult =
      await createAsaasSubscription(
        {
          customerId:
            asaasCustomerId,

          value:
            planPrice,

          cycle:
            'MONTHLY',

          billingType:
            'CREDIT_CARD',

          description:
            `${plan.name} · R$ ${planPrice
              .toFixed(2)
              .replace(
                '.',
                ',',
              )}/mês`,

          nextDueDate,

          creditCard: {
            holderName:
              parsed.creditCard
                .holderName,

            number:
              cardNumber,

            expiryMonth:
              parsed.creditCard
                .expiryMonth,

            expiryYear:
              parsed.creditCard
                .expiryYear,

            ccv,
          },

          creditCardHolderInfo:
            {
              name:
                parsed.customer
                  .name,

              email:
                parsed.customer
                  .email,

              cpfCnpj:
                cpf,

              postalCode,

              addressNumber:
                parsed.customer
                  .addressNumber,

              phone,

              mobilePhone:
                phone,
            },

          remoteIp,

          /**
           * Checkout transparente:
           * não queremos invoiceUrl.
           */
          skipInvoiceUrlLookup:
            true,
        },
      );
  } catch (err) {
    console.error(
      '[billing/subscribe] create subscription:',
      err,
    );

    if (
      err instanceof
        AsaasError &&
      err.status === 400
    ) {
      return NextResponse.json(
        {
          error:
            'card_rejected',

          message:
            'O pagamento não foi autorizado. Confira os dados do cartão ou tente outro cartão.',
        },
        {
          status: 400,
        },
      );
    }

    return NextResponse.json(
      {
        error:
          'billing_provider_error',

        message:
          'Não foi possível processar o pagamento agora.',
      },
      {
        status: 502,
      },
    );
  }

  // ==========================================================
  // SUPABASE
  //
  // Não colocamos ACTIVE aqui.
  //
  // A criação da assinatura não é confirmação
  // definitiva de recebimento.
  //
  // O webhook fará:
  //
  // pending → active
  // ==========================================================

  const now =
    new Date().toISOString();

  const subRow = {
    user_id:
      user.id,

    asaas_customer_id:
      asaasCustomerId,

    asaas_subscription_id:
      subscriptionResult.id,

    status:
      'pending' as const,

    plan:
      'pro',

    plan_slug:
      plan.slug,

    base_price:
      planPrice,

    payment_method:
      'credit_card' as const,

    next_due_date:
      nextDueDate,

    /**
     * Mantemos o trial_end antigo
     * apenas como histórico.
     */
    trial_end:
      existing?.trial_end ??
      null,

    current_period_start:
      null,

    current_period_end:
      null,

    cancel_at_period_end:
      false,

    cancelled_at:
      null,

    updated_at:
      now,
  };

  const {
    error: upsertError,
  } = await svc
    .from('subscriptions')
    .upsert(
      subRow,
      {
        onConflict:
          'user_id',
      },
    );

  if (upsertError) {
    console.error(
      '[billing/subscribe] subscription persist:',
      upsertError,
    );

    /**
     * Criamos a assinatura no Asaas,
     * mas falhamos em salvá-la.
     *
     * Tentamos cancelar para evitar cobrança órfã.
     */
    try {
      await cancelAsaasSubscription(
        subscriptionResult.id,
      );
    } catch (
      cancelError
    ) {
      console.error(
        '[billing/subscribe] ERRO CRÍTICO ao cancelar assinatura órfã:',
        cancelError,
      );
    }

    return NextResponse.json(
      {
        error:
          'persist_failed',

        message:
          'Não foi possível finalizar sua assinatura.',
      },
      {
        status: 500,
      },
    );
  }

  // ==========================================================
  // PROFILE BILLING
  // ==========================================================

  await svc
    .from('profiles')
    .update({
      asaas_customer_id:
        asaasCustomerId,

      asaas_subscription_id:
        subscriptionResult.id,

      subscription_status:
        'pending',

      selected_plan:
        plan.slug,

      plan:
        'pro',
    })
    .eq(
      'id',
      user.id,
    );

  // ==========================================================
  // RESPOSTA
  // ==========================================================

  return NextResponse.json({
    ok: true,

    /**
     * Ainda NÃO liberamos o chat.
     *
     * O webhook precisa confirmar o pagamento.
     */
    accessGranted: false,

    message:
      'Assinatura criada. Estamos confirmando o pagamento para liberar seu acesso.',
  });
}