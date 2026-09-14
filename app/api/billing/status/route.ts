import { NextResponse } from 'next/server';

import {
  requireUser,
  NotAuthenticated,
} from '@/lib/auth';

import {
  getSubscription,
} from '@/lib/billing/subscription';

export const runtime = 'nodejs';

export const dynamic = 'force-dynamic';

// ============================================================
// GET /api/billing/status
//
// Retorna o status da assinatura do usuário autenticado.
//
// Usado pela página:
//
// /account/billing/confirmando
//
// A regra de acesso deve acompanhar a mesma lógica
// utilizada pelo middleware.
// ============================================================

export async function GET() {
  // ==========================================================
  // USUÁRIO
  // ==========================================================

  let user;

  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof NotAuthenticated) {
      return NextResponse.json(
        {
          error: 'unauthorized',
          message: 'Você precisa estar autenticado.',
        },
        {
          status: 401,
        },
      );
    }

    console.error(
      '[billing/status] erro de autenticação:',
      err,
    );

    return NextResponse.json(
      {
        error: 'authentication_error',
        message: 'Não foi possível validar sua sessão.',
      },
      {
        status: 500,
      },
    );
  }

  // ==========================================================
  // ASSINATURA
  // ==========================================================

  try {
    const subscription = await getSubscription(user.id);

    // --------------------------------------------------------
    // AINDA NÃO EXISTE ASSINATURA
    // --------------------------------------------------------

    if (!subscription) {
      return NextResponse.json(
        {
          status: null,
          accessGranted: false,
          message:
            'Ainda não encontramos uma assinatura para esta conta.',
        },
        {
          headers: {
            'Cache-Control':
              'no-store, no-cache, must-revalidate',
          },
        },
      );
    }

    // --------------------------------------------------------
    // DADOS DA ASSINATURA
    // --------------------------------------------------------

    const status =
      subscription.status?.toLowerCase() ?? '';

    const now = Date.now();

    const currentPeriodEnd =
      subscription.current_period_end
        ? new Date(
            subscription.current_period_end,
          ).getTime()
        : null;

    const trialEnd =
      subscription.trial_end
        ? new Date(
            subscription.trial_end,
          ).getTime()
        : null;

    const periodStillValid =
      currentPeriodEnd !== null &&
      !Number.isNaN(currentPeriodEnd) &&
      currentPeriodEnd > now;

    const trialStillValid =
      trialEnd !== null &&
      !Number.isNaN(trialEnd) &&
      trialEnd > now;

    // ========================================================
    // ASSINATURA ATIVA
    // ========================================================

    const activeAccess =
      status === 'active' &&
      (
        !subscription.current_period_end ||
        periodStillValid
      );

    if (activeAccess) {
      return NextResponse.json(
        {
          status,
          accessGranted: true,
          message:
            'Pagamento confirmado. Seu acesso está liberado.',
        },
        {
          headers: {
            'Cache-Control':
              'no-store, no-cache, must-revalidate',
          },
        },
      );
    }

    // ========================================================
    // TRIAL ATIVO
    // ========================================================

    const trialAccess =
      status === 'trialing' &&
      trialStillValid;

    if (trialAccess) {
      return NextResponse.json(
        {
          status,
          accessGranted: true,
          message:
            'Seu período de teste está ativo.',
        },
        {
          headers: {
            'Cache-Control':
              'no-store, no-cache, must-revalidate',
          },
        },
      );
    }

    // ========================================================
    // ASSINATURA CANCELADA, MAS PERÍODO JÁ PAGO AINDA VÁLIDO
    //
    // Exemplo:
    //
    // pagamento: 05/09
    // cancelamento: 14/09
    // período pago até: 05/10
    //
    // O cancelamento impede a renovação, mas não remove
    // o acesso ao período já pago.
    // ========================================================

    const cancelledButPaid =
      (
        status === 'cancelled' ||
        status === 'canceled'
      ) &&
      subscription.cancel_at_period_end === true &&
      periodStillValid;

    if (cancelledButPaid) {
      return NextResponse.json(
        {
          status,
          accessGranted: true,
          message:
            'Sua assinatura foi cancelada para renovação, mas seu acesso permanece ativo até o fim do período já pago.',
        },
        {
          headers: {
            'Cache-Control':
              'no-store, no-cache, must-revalidate',
          },
        },
      );
    }

    // ========================================================
    // PAGAMENTO EM ATRASO, MAS PERÍODO ANTERIOR AINDA VÁLIDO
    // ========================================================

    const pastDueButValid =
      status === 'past_due' &&
      periodStillValid;

    if (pastDueButValid) {
      return NextResponse.json(
        {
          status,
          accessGranted: true,
          message:
            'Existe uma pendência de pagamento, mas seu período atual ainda está válido.',
        },
        {
          headers: {
            'Cache-Control':
              'no-store, no-cache, must-revalidate',
          },
        },
      );
    }

    // ========================================================
    // PAGAMENTO EM PROCESSAMENTO
    // ========================================================

    if (status === 'pending') {
      return NextResponse.json(
        {
          status,
          accessGranted: false,
          message:
            'Estamos aguardando a confirmação do pagamento.',
        },
        {
          headers: {
            'Cache-Control':
              'no-store, no-cache, must-revalidate',
          },
        },
      );
    }

    // ========================================================
    // TRIAL ENCERRADO
    // ========================================================

    if (status === 'trialing') {
      return NextResponse.json(
        {
          status,
          accessGranted: false,
          message:
            'Seu período de teste terminou.',
        },
        {
          headers: {
            'Cache-Control':
              'no-store, no-cache, must-revalidate',
          },
        },
      );
    }

    // ========================================================
    // PAGAMENTO EM ATRASO E PERÍODO ENCERRADO
    // ========================================================

    if (status === 'past_due') {
      return NextResponse.json(
        {
          status,
          accessGranted: false,
          message:
            'O pagamento está pendente e seu período de acesso terminou.',
        },
        {
          headers: {
            'Cache-Control':
              'no-store, no-cache, must-revalidate',
          },
        },
      );
    }

    // ========================================================
    // CANCELADA / EXPIRADA
    // ========================================================

    if (
      status === 'cancelled' ||
      status === 'canceled' ||
      status === 'expired'
    ) {
      return NextResponse.json(
        {
          status,
          accessGranted: false,
          message:
            'Esta assinatura não possui mais um período de acesso válido.',
        },
        {
          headers: {
            'Cache-Control':
              'no-store, no-cache, must-revalidate',
          },
        },
      );
    }

    // ========================================================
    // QUALQUER OUTRO STATUS
    // ========================================================

    return NextResponse.json(
      {
        status,
        accessGranted: false,
        message:
          'Aguardando atualização da assinatura.',
      },
      {
        headers: {
          'Cache-Control':
            'no-store, no-cache, must-revalidate',
        },
      },
    );
  } catch (err) {
    console.error(
      '[billing/status] erro ao consultar assinatura:',
      err,
    );

    return NextResponse.json(
      {
        error: 'subscription_status_error',
        message:
          'Não foi possível consultar o status da assinatura.',
      },
      {
        status: 500,

        headers: {
          'Cache-Control':
            'no-store, no-cache, must-revalidate',
        },
      },
    );
  }
}