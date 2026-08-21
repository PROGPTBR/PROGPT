import { NextResponse } from 'next/server';

import { getServerSupabase } from '@/lib/db/supabase';

import { sendEmail } from '@/lib/email/client';

import {
  buildPaymentConfirmedEmail,
  buildPaymentOverdueEmail,
} from '@/lib/email/templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============================================================
// WEBHOOK ASAAS
//
// Fonte de verdade do estado financeiro da assinatura.
//
// Checkout antigo:
// pending → PAYMENT_CREATED → trialing
//
// Checkout novo após trial vencido:
// pending → PAYMENT_CREATED → continua pending
// pending → PAYMENT_CONFIRMED → active
//
// Nunca liberamos acesso apenas porque PAYMENT_CREATED ocorreu.
// ============================================================

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

// ============================================================
// EVENTOS
// ============================================================

const PAID_EVENTS = [
  'PAYMENT_CONFIRMED',
  'PAYMENT_RECEIVED',
];

const PAST_DUE_EVENTS = [
  'PAYMENT_OVERDUE',
];

const PAYMENT_FAILED_EVENTS = [
  'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED',
  'PAYMENT_REPROVED_BY_RISK_ANALYSIS',

  // Chargeback: acesso fica bloqueado até resolução.
  'PAYMENT_CHARGEBACK_REQUESTED',
  'PAYMENT_CHARGEBACK_DISPUTE',
  'PAYMENT_AWAITING_CHARGEBACK_REVERSAL',
];

const CANCEL_EVENTS = [
  'PAYMENT_REFUNDED',
  'PAYMENT_REFUND_IN_PROGRESS',
  'PAYMENT_DELETED',

  'SUBSCRIPTION_DELETED',
  'SUBSCRIPTION_INACTIVATED',
];

/**
 * PAYMENT_CREATED é geração da cobrança.
 *
 * No fluxo ANTIGO ele também era usado como sinal de que
 * o cartão do trial havia sido cadastrado.
 *
 * Vamos preservar esse comportamento apenas quando:
 *
 * status = pending
 * +
 * trial_end ainda está no futuro
 *
 * Se trial_end já venceu, PAYMENT_CREATED NÃO reabre trial.
 */
const TRIAL_START_EVENTS = [
  'PAYMENT_CREATED',
];

const KNOWN_IGNORED_EVENTS = new Set([
  'PAYMENT_UPDATED',

  'PAYMENT_AWAITING_RISK_ANALYSIS',

  'PAYMENT_APPROVED_BY_RISK_ANALYSIS',

  'PAYMENT_AUTHORIZED',

  'PAYMENT_BANK_SLIP_VIEWED',

  'PAYMENT_CHECKOUT_VIEWED',

  'PAYMENT_ANTICIPATED',

  'PAYMENT_DUNNING_RECEIVED',

  'PAYMENT_DUNNING_REQUESTED',

  'PAYMENT_RESTORED',

  'SUBSCRIPTION_CREATED',

  'SUBSCRIPTION_UPDATED',
]);

const HANDLED_EVENTS = new Set([
  ...PAID_EVENTS,

  ...PAST_DUE_EVENTS,

  ...PAYMENT_FAILED_EVENTS,

  ...CANCEL_EVENTS,

  ...TRIAL_START_EVENTS,
]);

// ============================================================
// HELPERS
// ============================================================

function mapBillingType(
  type: string | undefined,
):
  | 'credit_card'
  | 'pix'
  | 'boleto'
  | null {
  switch (type) {
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

function addMonth(
  iso: string,
): string {
  const date = new Date(iso);

  const originalDay =
    date.getUTCDate();

  // Vai para o primeiro dia do mês para evitar:
  // 31/01 + 1 mês => março.
  date.setUTCDate(1);

  date.setUTCMonth(
    date.getUTCMonth() + 1,
  );

  const lastDay =
    new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        0,
      ),
    ).getUTCDate();

  date.setUTCDate(
    Math.min(
      originalDay,
      lastDay,
    ),
  );

  return date.toISOString();
}

function isFutureDate(
  value: unknown,
): boolean {
  if (
    typeof value !== 'string' ||
    !value
  ) {
    return false;
  }

  const time =
    new Date(value).getTime();

  return (
    Number.isFinite(time) &&
    time > Date.now()
  );
}

/**
 * Evita que:
 *
 * PAYMENT_CONFIRMED
 *      ↓
 * PAYMENT_RECEIVED
 *
 * conte como dois períodos diferentes.
 *
 * No cartão, PAYMENT_RECEIVED pode acontecer muito depois
 * de PAYMENT_CONFIRMED.
 *
 * Para uma renovação nova, dueDate será posterior ao início
 * do período que temos salvo.
 */
type SubscriptionPeriodState = {
  status: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
};

function shouldStartNewPeriod(
  sub: SubscriptionPeriodState,
  event: AsaasEvent,
): boolean {
  if (
    sub.status !== 'active'
  ) {
    return true;
  }

  if (
    !sub.current_period_start ||
    !sub.current_period_end
  ) {
    return true;
  }

  const dueDate =
    event.payment?.dueDate;

  if (!dueDate) {
    return false;
  }

  const currentStart =
    new Date(
      sub.current_period_start,
    )
      .toISOString()
      .slice(0, 10);

  return dueDate > currentStart;
}

function getPaidDate(
  event: AsaasEvent,
): string {
  const raw =
    event.payment
      ?.confirmedDate ??
    event.payment
      ?.paymentDate ??
    null;

  if (raw) {
    const date =
      new Date(raw);

    if (
      Number.isFinite(
        date.getTime(),
      )
    ) {
      return date.toISOString();
    }
  }

  return new Date().toISOString();
}

// ============================================================
// WEBHOOK
// ============================================================

export async function POST(
  req: Request,
) {
  // ==========================================================
  // TOKEN
  // ==========================================================

  const expected =
    process.env
      .ASAAS_WEBHOOK_TOKEN;

  const got =
    req.headers.get(
      'asaas-access-token',
    );

  if (
    !expected ||
    got !== expected
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

  // ==========================================================
  // BODY
  // ==========================================================

  let event: AsaasEvent;

  try {
    event =
      (await req.json()) as AsaasEvent;
  } catch {
    return NextResponse.json(
      {
        error:
          'invalid_body',
      },
      {
        status: 400,
      },
    );
  }

  if (
    !event?.id ||
    !event?.event
  ) {
    return NextResponse.json(
      {
        error:
          'missing_event_fields',
      },
      {
        status: 400,
      },
    );
  }

  const svc =
    getServerSupabase();

  // ==========================================================
  // IDEMPOTÊNCIA
  //
  // Se o evento já foi TOTALMENTE processado:
  // → 200 deduped
  //
  // Se existe, mas processed_at = null:
  // → tentativa anterior falhou
  // → processamos novamente
  // ==========================================================

  const {
    error: insertErr,
  } = await svc
    .from(
      'billing_webhook_events',
    )
    .insert({
      asaas_event_id:
        event.id,

      event_type:
        event.event,

      payload:
        event as unknown as Record<
          string,
          unknown
        >,
    });

  if (insertErr) {
    const code =
      (
        insertErr as {
          code?: string;
        }
      ).code;

    if (code === '23505') {
      const {
        data:
          existingWebhook,
        error:
          existingWebhookError,
      } = await svc
        .from(
          'billing_webhook_events',
        )
        .select(
          'processed_at',
        )
        .eq(
          'asaas_event_id',
          event.id,
        )
        .maybeSingle();

      if (
        existingWebhookError
      ) {
        console.error(
          '[billing/webhook] load existing event failed:',
          existingWebhookError.message,
        );

        return NextResponse.json(
          {
            error:
              'persist_failed',
          },
          {
            status: 500,
          },
        );
      }

      if (
        existingWebhook
          ?.processed_at
      ) {
        return NextResponse.json({
          ok: true,
          deduped: true,
        });
      }

      /**
       * Evento existe, mas não foi concluído.
       *
       * Continuamos o processamento.
       */
      console.warn(
        `[billing/webhook] retry de evento não concluído: ${event.id}`,
      );
    } else {
      console.error(
        '[billing/webhook] insert event failed:',
        insertErr.message,
      );

      return NextResponse.json(
        {
          error:
            'persist_failed',
        },
        {
          status: 500,
        },
      );
    }
  }

  // ==========================================================
  // IDENTIFICA ASSINATURA ASAAS
  // ==========================================================

  const asaasSubId =
    event.payment
      ?.subscription ??
    event.subscription
      ?.id ??
    null;

  if (!asaasSubId) {
    await svc
      .from(
        'billing_webhook_events',
      )
      .update({
        processed_at:
          new Date()
            .toISOString(),
      })
      .eq(
        'asaas_event_id',
        event.id,
      );

    return NextResponse.json({
      ok: true,
      skipped: true,
    });
  }

  // ==========================================================
  // ASSINATURA LOCAL
  // ==========================================================

  const {
    data: sub,
    error: loadErr,
  } = await svc
    .from('subscriptions')
    .select('*')
    .eq(
      'asaas_subscription_id',
      asaasSubId,
    )
    .maybeSingle();

  if (loadErr) {
    console.error(
      '[billing/webhook] load sub failed:',
      loadErr.message,
    );

    return NextResponse.json(
      {
        error:
          'persist_failed',
      },
      {
        status: 500,
      },
    );
  }

  // ==========================================================
  // ONBOARDING ANTIGO
  // ==========================================================

  if (!sub) {
    let finalized = false;

    if (
      PAID_EVENTS.includes(
        event.event,
      ) ||
      TRIAL_START_EVENTS.includes(
        event.event,
      )
    ) {
      try {
        const {
          finalizePendingSignupByAsaasSub,
        } = await import(
          '@/lib/billing/onboarding'
        );

        const fin =
          await finalizePendingSignupByAsaasSub(
            asaasSubId,
          );

        finalized =
          fin.ok;
      } catch (err) {
        console.error(
          '[billing/webhook] finalize pending signup failed:',
          err,
        );
      }
    }

    await svc
      .from(
        'billing_webhook_events',
      )
      .update({
        processed_at:
          new Date()
            .toISOString(),
      })
      .eq(
        'asaas_event_id',
        event.id,
      );

    return NextResponse.json({
      ok: true,

      finalized,

      orphan:
        !finalized,
    });
  }

  // ==========================================================
  // NOVO ESTADO
  // ==========================================================

  const now =
    new Date().toISOString();

  const update:
    Record<
      string,
      unknown
    > = {
    updated_at: now,
  };

  let resultingStatus =
    sub.status as string;

  let startedNewPeriod =
    false;

  // ==========================================================
  // PAGAMENTO CONFIRMADO
  // ==========================================================

  if (
    PAID_EVENTS.includes(
      event.event,
    )
  ) {
    resultingStatus =
      'active';

    update.status =
      'active';

    update.payment_method =
      mapBillingType(
        event.payment
          ?.billingType,
      ) ??
      sub.payment_method;

    /**
     * PAYMENT_CONFIRMED e PAYMENT_RECEIVED podem pertencer
     * à mesma cobrança.
     *
     * Só criamos novo período quando realmente for um
     * novo ciclo.
     */
    startedNewPeriod =
      shouldStartNewPeriod(
        sub,
        event,
      );

    if (
      startedNewPeriod
    ) {
      const paid =
        getPaidDate(event);

      const periodEnd =
        addMonth(paid);

      update.current_period_start =
        paid;

      update.current_period_end =
        periodEnd;

      update.last_payment_at =
        paid;

      update.next_due_date =
        periodEnd.slice(
          0,
          10,
        );
    }

    update.cancel_at_period_end =
      false;

    update.cancelled_at =
      null;
  }

  // ==========================================================
  // ATRASADO
  // ==========================================================

  else if (
    PAST_DUE_EVENTS.includes(
      event.event,
    )
  ) {
    resultingStatus =
      'past_due';

    update.status =
      'past_due';
  }

  // ==========================================================
  // CARTÃO RECUSADO / CHARGEBACK
  // ==========================================================

  else if (
    PAYMENT_FAILED_EVENTS.includes(
      event.event,
    )
  ) {
    resultingStatus =
      'past_due';

    update.status =
      'past_due';
  }

  // ==========================================================
  // CANCELADO / ESTORNADO
  // ==========================================================

  else if (
    CANCEL_EVENTS.includes(
      event.event,
    )
  ) {
    resultingStatus =
      'cancelled';

    update.status =
      'cancelled';

    update.cancelled_at =
      now;
  }

  // ==========================================================
  // PAYMENT_CREATED
  //
  // Só inicia trial quando o trial_end ainda estiver
  // no FUTURO.
  //
  // Cliente expirado:
  //
  // trial_end < agora
  // status pending
  // PAYMENT_CREATED
  //
  // continua PENDING.
  // ==========================================================

  else if (
    TRIAL_START_EVENTS.includes(
      event.event,
    )
  ) {
    const trialStillValid =
      isFutureDate(
        sub.trial_end,
      );

    if (
      sub.status ===
        'pending' &&
      trialStillValid
    ) {
      resultingStatus =
        'trialing';

      update.status =
        'trialing';

      update.payment_method =
        mapBillingType(
          event.payment
            ?.billingType,
        ) ??
        sub.payment_method;
    }
  }

  // ==========================================================
  // EVENTO DESCONHECIDO
  // ==========================================================

  const unhandledEvent =
    !HANDLED_EVENTS.has(
      event.event,
    ) &&
    !KNOWN_IGNORED_EVENTS.has(
      event.event,
    )
      ? event.event
      : null;

  if (unhandledEvent) {
    console.warn(
      `[billing/webhook] evento Asaas não tratado: ${unhandledEvent} (event_id=${event.id}, sub=${asaasSubId})`,
    );
  }

  // ==========================================================
  // ATUALIZA SUBSCRIPTIONS
  // ==========================================================

  if (
    Object.keys(update)
      .length > 1
  ) {
    const {
      error: updErr,
    } = await svc
      .from(
        'subscriptions',
      )
      .update(update)
      .eq(
        'id',
        sub.id,
      );

    if (updErr) {
      console.error(
        '[billing/webhook] update sub failed:',
        updErr.message,
      );

      /**
       * Não marcamos processed_at.
       *
       * No próximo retry, a idempotência acima detectará
       * processed_at = null e tentará novamente.
       */
      return NextResponse.json(
        {
          error:
            'persist_failed',
        },
        {
          status: 500,
        },
      );
    }
  }

  // ==========================================================
  // SINCRONIZA PROFILE
  //
  // O middleware usa subscriptions, mas outras partes
  // do sistema usam profiles.subscription_status.
  //
  // Mantemos os dois coerentes.
  // ==========================================================

  if (
    resultingStatus !==
    sub.status
  ) {
    const profileUpdate:
      Record<
        string,
        unknown
      > = {
      subscription_status:
        resultingStatus,

      asaas_subscription_id:
        asaasSubId,

      updated_at:
        now,
    };

    if (
      sub.asaas_customer_id
    ) {
      profileUpdate.asaas_customer_id =
        sub.asaas_customer_id;
    }

    if (
      sub.plan_slug
    ) {
      profileUpdate.selected_plan =
        sub.plan_slug;
    }

    if (sub.plan) {
      profileUpdate.plan =
        sub.plan;
    }

    const {
      error:
        profileUpdateError,
    } = await svc
      .from('profiles')
      .update(
        profileUpdate,
      )
      .eq(
        'id',
        sub.user_id,
      );

    if (
      profileUpdateError
    ) {
      console.error(
        '[billing/webhook] profile sync failed:',
        profileUpdateError.message,
      );

      /**
       * subscriptions já é nossa fonte de verdade.
       *
       * Não rejeitamos o webhook só por uma falha auxiliar
       * de sincronização do profile.
       */
    }
  }

  // ==========================================================
  // E-MAIL PAGAMENTO CONFIRMADO
  //
  // Só envia quando inicia um NOVO período.
  //
  // Assim:
  //
  // PAYMENT_CONFIRMED → envia
  // PAYMENT_RECEIVED da mesma cobrança → NÃO envia de novo
  // ==========================================================

  if (
    PAID_EVENTS.includes(
      event.event,
    ) &&
    startedNewPeriod
  ) {
    const userEmail =
      await fetchUserEmail(
        sub.user_id as string,
      );

    const currentPeriodEnd =
      update.current_period_end;

    if (
      userEmail &&
      typeof currentPeriodEnd ===
        'string'
    ) {
      const nextDue =
        new Date(
          currentPeriodEnd,
        ).toLocaleDateString(
          'pt-BR',
        );

      const amount =
        typeof event.payment
          ?.value ===
          'number'
          ? event.payment
              .value
          : Number(
              sub.base_price ??
                73,
            );

      const tpl =
        buildPaymentConfirmedEmail(
          {
            email:
              userEmail,

            amountBrl:
              amount,

            nextDueDate:
              nextDue,
          },
        );

      void sendEmail({
        to: userEmail,

        subject:
          tpl.subject,

        html:
          tpl.html,

        idempotencyKey:
          `paid:${event.id}`,
      });
    }
  }

  // ==========================================================
  // E-MAIL ATRASO
  // ==========================================================

  else if (
    PAST_DUE_EVENTS.includes(
      event.event,
    )
  ) {
    const userEmail =
      await fetchUserEmail(
        sub.user_id as string,
      );

    if (userEmail) {
      const accessUntil =
        sub.current_period_end
          ? new Date(
              sub.current_period_end as string,
            ).toLocaleDateString(
              'pt-BR',
            )
          : 'breve';

      const tpl =
        buildPaymentOverdueEmail(
          {
            email:
              userEmail,

            accessUntil,
          },
        );

      void sendEmail({
        to: userEmail,

        subject:
          tpl.subject,

        html:
          tpl.html,

        idempotencyKey:
          `overdue:${event.id}`,
      });
    }
  }

  // ==========================================================
  // MARCA EVENTO COMO PROCESSADO
  // ==========================================================

  const {
    error:
      processedError,
  } = await svc
    .from(
      'billing_webhook_events',
    )
    .update({
      processed_at:
        new Date()
          .toISOString(),
    })
    .eq(
      'asaas_event_id',
      event.id,
    );

  if (processedError) {
    console.error(
      '[billing/webhook] mark processed failed:',
      processedError.message,
    );

    return NextResponse.json(
      {
        error:
          'persist_failed',
      },
      {
        status: 500,
      },
    );
  }

  return NextResponse.json(
    unhandledEvent
      ? {
          ok: true,
          unhandled:
            unhandledEvent,
        }
      : {
          ok: true,

          status:
            resultingStatus,

          event:
            event.event,
        },
  );
}

// ============================================================
// BUSCA EMAIL
// ============================================================

async function fetchUserEmail(
  userId: string,
): Promise<string | null> {
  const svc =
    getServerSupabase();

  const {
    data,
    error,
  } =
    await svc.auth.admin.getUserById(
      userId,
    );

  if (error) {
    console.warn(
      '[billing/webhook] fetchUserEmail failed:',
      error.message,
    );

    return null;
  }

  return (
    data.user?.email ??
    null
  );
}