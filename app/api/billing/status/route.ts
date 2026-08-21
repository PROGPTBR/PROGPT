import {
  NextResponse,
} from 'next/server';

import {
  requireUser,
  NotAuthenticated,
} from '@/lib/auth';

import {
  getSubscription,
} from '@/lib/billing/subscription';

export const runtime =
  'nodejs';

export const dynamic =
  'force-dynamic';

// ============================================================
// GET /api/billing/status
//
// Retorna somente o status da assinatura do usuário autenticado.
//
// Essa rota é usada pela página:
//
// /account/billing/confirmando
//
// para aguardar:
//
// pending → active
// ============================================================

export async function GET() {
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

          message:
            'Você precisa estar autenticado.',
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
        error:
          'authentication_error',

        message:
          'Não foi possível validar sua sessão.',
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
    const subscription =
      await getSubscription(
        user.id,
      );

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
    // STATUS
    // --------------------------------------------------------

    const status =
      subscription.status ??
      null;

    // --------------------------------------------------------
    // PAGAMENTO CONFIRMADO
    // --------------------------------------------------------

    if (status === 'active') {
      return NextResponse.json(
        {
          status:
            'active',

          accessGranted:
            true,

          message:
            'Pagamento confirmado. Seu acesso foi liberado.',
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
    // PAGAMENTO EM PROCESSAMENTO
    // --------------------------------------------------------

    if (
      status === 'pending' ||
      status === 'trialing'
    ) {
      return NextResponse.json(
        {
          status,

          accessGranted:
            false,

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

    // --------------------------------------------------------
    // PAGAMENTO EM ATRASO
    // --------------------------------------------------------

    if (
      status === 'past_due'
    ) {
      return NextResponse.json(
        {
          status:
            'past_due',

          accessGranted:
            false,

          message:
            'O pagamento ainda não foi confirmado.',
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
    // CANCELADA / EXPIRADA
    // --------------------------------------------------------

    if (
      status === 'cancelled' ||
      status === 'expired'
    ) {
      return NextResponse.json(
        {
          status,

          accessGranted:
            false,

          message:
            'Esta assinatura não está ativa.',
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
    // QUALQUER OUTRO STATUS
    // --------------------------------------------------------

    return NextResponse.json(
      {
        status,

        accessGranted:
          false,

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
        error:
          'subscription_status_error',

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