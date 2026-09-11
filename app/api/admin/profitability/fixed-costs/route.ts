import { NextResponse } from 'next/server';

import {
  requireAdmin,
  NotAdmin,
} from '@/lib/auth';

import {
  getServerSupabase,
} from '@/lib/db/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* =========================================================
   TYPES
========================================================= */

type BillingCycle =
  | 'monthly'
  | 'annual';

type CostCurrency =
  | 'BRL'
  | 'USD';

/* =========================================================
   HELPERS
========================================================= */

function unauthorizedResponse() {
  return new NextResponse(
    'Not Found',
    {
      status: 404,
    },
  );
}

function toNumber(
  value: unknown,
  fallback = 0,
) {
  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

function normalizeBillingCycle(
  value: unknown,
): BillingCycle {
  return value === 'annual'
    ? 'annual'
    : 'monthly';
}

function normalizeCurrency(
  value: unknown,
): CostCurrency {
  return value === 'USD'
    ? 'USD'
    : 'BRL';
}

function roundMoney(
  value: number,
) {
  return (
    Math.round(
      (value + Number.EPSILON) *
        100,
    ) / 100
  );
}

/* =========================================================
   POST
   Criar novo custo fixo
========================================================= */

export async function POST(
  req: Request,
) {
  /* =======================================================
     AUTORIZAÇÃO
  ======================================================= */

  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof NotAdmin) {
      return unauthorizedResponse();
    }

    throw err;
  }

  try {
    const body =
      await req.json();

    /* =====================================================
       NOME
    ===================================================== */

    const name =
      typeof body.name === 'string'
        ? body.name.trim()
        : '';

    if (!name) {
      return NextResponse.json(
        {
          error:
            'invalid_name',

          message:
            'O nome do custo é obrigatório.',
        },
        {
          status: 400,
        },
      );
    }

    /* =====================================================
       DESCRIÇÃO
    ===================================================== */

    const description =
      typeof body.description ===
      'string'
        ? body.description.trim()
        : '';

    /* =====================================================
       MOEDA
    ===================================================== */

    const currency =
      normalizeCurrency(
        body.currency,
      );

    /* =====================================================
       PERIODICIDADE
    ===================================================== */

    const billingCycle =
      normalizeBillingCycle(
        body.billingCycle,
      );

    /* =====================================================
       VALOR COBRADO

       billing_amount guarda o valor
       na moeda original do custo.

       Exemplos:
       Supabase: 25 USD/mês
       Hostinger: 839.88 BRL/ano
    ===================================================== */

    const billingAmount =
      toNumber(
        body.billingAmount ??
          body.monthlyAmount,
        -1,
      );

    if (
      !Number.isFinite(
        billingAmount,
      ) ||
      billingAmount < 0
    ) {
      return NextResponse.json(
        {
          error:
            'invalid_billing_amount',

          message:
            'O valor do custo não pode ser negativo.',
        },
        {
          status: 400,
        },
      );
    }

    /* =====================================================
       EQUIVALENTE MENSAL NA MOEDA ORIGINAL

       Importante:
       - BRL continua em BRL
       - USD continua em USD

       A conversão USD -> BRL acontece na rota
       /api/admin/profitability usando a cotação configurada.
    ===================================================== */

    const monthlyAmountRaw =
      billingCycle === 'annual'
        ? billingAmount / 12
        : billingAmount;

    const monthlyAmount =
      roundMoney(
        monthlyAmountRaw,
      );

    /* =====================================================
       STATUS
    ===================================================== */

    const active =
      typeof body.active ===
      'boolean'
        ? body.active
        : true;

    /* =====================================================
       ORDEM
    ===================================================== */

    const sortOrder =
      Math.max(
        0,
        Math.trunc(
          toNumber(
            body.sortOrder,
            0,
          ),
        ),
      );

    /* =====================================================
       SUPABASE
    ===================================================== */

    const supabase =
      getServerSupabase();

    const {
      data,
      error,
    } = await supabase
      .from(
        'profitability_fixed_costs',
      )
      .insert({
        name,

        description:
          description || null,

        billing_amount:
          billingAmount,

        currency,

        billing_cycle:
          billingCycle,

        monthly_amount:
          monthlyAmount,

        active,

        sort_order:
          sortOrder,

        updated_at:
          new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) {
      console.error(
        '[profitability/fixed-costs POST]',
        error,
      );

      return NextResponse.json(
        {
          error:
            'insert_failed',

          message:
            'Não foi possível cadastrar o custo.',
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json(
      {
        cost: {
          id:
            data.id,

          name:
            data.name,

          description:
            data.description,

          billingAmount:
            Number(
              data.billing_amount,
            ),

          currency:
            normalizeCurrency(
              data.currency,
            ),

          billingCycle:
            normalizeBillingCycle(
              data.billing_cycle,
            ),

          monthlyAmount:
            Number(
              data.monthly_amount,
            ),

          active:
            Boolean(
              data.active,
            ),

          sortOrder:
            Number(
              data.sort_order,
            ),

          createdAt:
            data.created_at,

          updatedAt:
            data.updated_at,
        },
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      '[profitability/fixed-costs POST]',
      error,
    );

    return NextResponse.json(
      {
        error:
          'internal_error',

        message:
          'Erro interno ao cadastrar custo.',
      },
      {
        status: 500,
      },
    );
  }
}
