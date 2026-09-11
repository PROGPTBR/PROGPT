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

type RouteContext = {
  params: {
    id: string;
  };
};

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
   PATCH
   Editar custo fixo
========================================================= */

export async function PATCH(
  req: Request,
  context: RouteContext,
) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof NotAdmin) {
      return unauthorizedResponse();
    }

    throw err;
  }

  try {
    const { id } =
      context.params;

    if (!id) {
      return NextResponse.json(
        {
          error:
            'invalid_id',

          message:
            'ID do custo não informado.',
        },
        {
          status: 400,
        },
      );
    }

    const body =
      await req.json();

    const supabase =
      getServerSupabase();

    /* =====================================================
       REGISTRO ATUAL
    ===================================================== */

    const {
      data: existing,
      error: existingError,
    } = await supabase
      .from(
        'profitability_fixed_costs',
      )
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (existingError) {
      console.error(
        '[PATCH fixed cost FIND ERROR]',
        existingError,
      );

      return NextResponse.json(
        {
          error:
            'find_failed',

          message:
            'Não foi possível localizar o custo.',
        },
        {
          status: 500,
        },
      );
    }

    if (!existing) {
      return NextResponse.json(
        {
          error:
            'not_found',

          message:
            'Custo não encontrado.',
        },
        {
          status: 404,
        },
      );
    }

    /* =====================================================
       NOME
    ===================================================== */

    const name =
      Object.prototype.hasOwnProperty.call(
        body,
        'name',
      )
        ? typeof body.name === 'string'
          ? body.name.trim()
          : ''
        : String(
            existing.name ?? '',
          ).trim();

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
      Object.prototype.hasOwnProperty.call(
        body,
        'description',
      )
        ? typeof body.description ===
          'string'
          ? body.description.trim() ||
            null
          : null
        : existing.description ??
          null;

    /* =====================================================
       MOEDA
    ===================================================== */

    const currency =
      Object.prototype.hasOwnProperty.call(
        body,
        'currency',
      )
        ? normalizeCurrency(
            body.currency,
          )
        : normalizeCurrency(
            existing.currency,
          );

    /* =====================================================
       PERIODICIDADE
    ===================================================== */

    const billingCycle =
      Object.prototype.hasOwnProperty.call(
        body,
        'billingCycle',
      )
        ? normalizeBillingCycle(
            body.billingCycle,
          )
        : normalizeBillingCycle(
            existing.billing_cycle,
          );

    /* =====================================================
       VALOR COBRADO NA MOEDA ORIGINAL
    ===================================================== */

    let billingAmount: number;

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        'billingAmount',
      )
    ) {
      billingAmount =
        Number(
          body.billingAmount,
        );
    } else if (
      Object.prototype.hasOwnProperty.call(
        body,
        'monthlyAmount',
      )
    ) {
      const oldMonthlyAmount =
        Number(
          body.monthlyAmount,
        );

      billingAmount =
        billingCycle === 'annual'
          ? oldMonthlyAmount * 12
          : oldMonthlyAmount;
    } else {
      const storedBillingAmount =
        Number(
          existing.billing_amount,
        );

      if (
        Number.isFinite(
          storedBillingAmount,
        )
      ) {
        billingAmount =
          storedBillingAmount;
      } else {
        const storedMonthlyAmount =
          toNumber(
            existing.monthly_amount,
            0,
          );

        billingAmount =
          billingCycle === 'annual'
            ? storedMonthlyAmount * 12
            : storedMonthlyAmount;
      }
    }

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
            'Informe um valor válido para o custo.',
        },
        {
          status: 400,
        },
      );
    }

    /* =====================================================
       MENSALIZAÇÃO

       O valor permanece na moeda original.
       Conversão para BRL acontece na rota principal
       de Rentabilidade.
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
       STATUS / ORDEM
    ===================================================== */

    const active =
      typeof body.active ===
      'boolean'
        ? body.active
        : Boolean(
            existing.active,
          );

    const sortOrder =
      Object.prototype.hasOwnProperty.call(
        body,
        'sortOrder',
      )
        ? Math.max(
            0,
            Math.trunc(
              toNumber(
                body.sortOrder,
                0,
              ),
            ),
          )
        : Math.max(
            0,
            Math.trunc(
              toNumber(
                existing.sort_order,
                0,
              ),
            ),
          );

    /* =====================================================
       UPDATE
    ===================================================== */

    const updatePayload = {
      name,

      description,

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
    };

    const {
      data: updated,
      error: updateError,
    } = await supabase
      .from(
        'profitability_fixed_costs',
      )
      .update(
        updatePayload,
      )
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (updateError) {
      console.error(
        '[PATCH fixed cost UPDATE ERROR]',
        updateError,
      );

      return NextResponse.json(
        {
          error:
            'update_failed',

          message:
            'Não foi possível atualizar o custo.',
        },
        {
          status: 500,
        },
      );
    }

    if (!updated) {
      return NextResponse.json(
        {
          error:
            'not_found',

          message:
            'Nenhum registro foi atualizado.',
        },
        {
          status: 404,
        },
      );
    }

    /* =====================================================
       CONFIRMAÇÃO DO QUE FICOU NO BANCO
    ===================================================== */

    const {
      data: persisted,
      error: verifyError,
    } = await supabase
      .from(
        'profitability_fixed_costs',
      )
      .select(
        `
          id,
          name,
          description,
          billing_amount,
          currency,
          billing_cycle,
          monthly_amount,
          active,
          sort_order,
          created_at,
          updated_at
        `,
      )
      .eq('id', id)
      .maybeSingle();

    if (verifyError) {
      console.error(
        '[PATCH fixed cost VERIFY ERROR]',
        verifyError,
      );

      return NextResponse.json(
        {
          error:
            'verify_failed',

          message:
            'O custo foi atualizado, mas não foi possível confirmar os valores gravados.',
        },
        {
          status: 500,
        },
      );
    }

    if (!persisted) {
      return NextResponse.json(
        {
          error:
            'verify_not_found',

          message:
            'O custo não foi encontrado após a atualização.',
        },
        {
          status: 500,
        },
      );
    }

    const persistedBillingAmount =
      Number(
        persisted.billing_amount,
      );

    const persistedMonthlyAmount =
      Number(
        persisted.monthly_amount,
      );

    const persistedBillingCycle =
      normalizeBillingCycle(
        persisted.billing_cycle,
      );

    const persistedCurrency =
      normalizeCurrency(
        persisted.currency,
      );

    const billingMatches =
      Math.abs(
        persistedBillingAmount -
          billingAmount,
      ) < 0.001;

    const monthlyMatches =
      Math.abs(
        persistedMonthlyAmount -
          monthlyAmount,
      ) < 0.001;

    const cycleMatches =
      persistedBillingCycle ===
      billingCycle;

    const currencyMatches =
      persistedCurrency ===
      currency;

    if (
      !billingMatches ||
      !monthlyMatches ||
      !cycleMatches ||
      !currencyMatches
    ) {
      console.error(
        '[PATCH fixed cost PERSIST MISMATCH]',
        {
          expected: {
            billingAmount,
            currency,
            billingCycle,
            monthlyAmount,
          },

          persisted: {
            billingAmount:
              persistedBillingAmount,

            currency:
              persistedCurrency,

            billingCycle:
              persistedBillingCycle,

            monthlyAmount:
              persistedMonthlyAmount,
          },
        },
      );

      return NextResponse.json(
        {
          error:
            'persist_mismatch',

          message:
            'O Supabase não manteve os valores enviados.',

          expected: {
            billingAmount,
            currency,
            billingCycle,
            monthlyAmount,
          },

          persisted: {
            billingAmount:
              persistedBillingAmount,

            currency:
              persistedCurrency,

            billingCycle:
              persistedBillingCycle,

            monthlyAmount:
              persistedMonthlyAmount,
          },
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      success: true,

      cost: {
        id:
          persisted.id,

        name:
          persisted.name,

        description:
          persisted.description,

        billingAmount:
          persistedBillingAmount,

        currency:
          persistedCurrency,

        billingCycle:
          persistedBillingCycle,

        monthlyAmount:
          persistedMonthlyAmount,

        active:
          Boolean(
            persisted.active,
          ),

        sortOrder:
          Number(
            persisted.sort_order,
          ),

        createdAt:
          persisted.created_at,

        updatedAt:
          persisted.updated_at,
      },
    });
  } catch (error) {
    console.error(
      '[PATCH fixed cost INTERNAL ERROR]',
      error,
    );

    return NextResponse.json(
      {
        error:
          'internal_error',

        message:
          'Erro interno ao atualizar custo.',
      },
      {
        status: 500,
      },
    );
  }
}

/* =========================================================
   DELETE
========================================================= */

export async function DELETE(
  _req: Request,
  context: RouteContext,
) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof NotAdmin) {
      return unauthorizedResponse();
    }

    throw err;
  }

  try {
    const { id } =
      context.params;

    if (!id) {
      return NextResponse.json(
        {
          error:
            'invalid_id',

          message:
            'ID do custo não informado.',
        },
        {
          status: 400,
        },
      );
    }

    const supabase =
      getServerSupabase();

    const {
      data: existing,
      error: findError,
    } = await supabase
      .from(
        'profitability_fixed_costs',
      )
      .select(
        'id, name',
      )
      .eq('id', id)
      .maybeSingle();

    if (findError) {
      console.error(
        '[DELETE fixed cost FIND ERROR]',
        findError,
      );

      return NextResponse.json(
        {
          error:
            'find_failed',

          message:
            'Não foi possível localizar o custo.',
        },
        {
          status: 500,
        },
      );
    }

    if (!existing) {
      return NextResponse.json(
        {
          error:
            'not_found',

          message:
            'Custo não encontrado.',
        },
        {
          status: 404,
        },
      );
    }

    const {
      error: deleteError,
    } = await supabase
      .from(
        'profitability_fixed_costs',
      )
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error(
        '[DELETE fixed cost ERROR]',
        deleteError,
      );

      return NextResponse.json(
        {
          error:
            'delete_failed',

          message:
            'Não foi possível excluir o custo.',
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      success: true,

      deleted: {
        id:
          existing.id,

        name:
          existing.name,
      },
    });
  } catch (error) {
    console.error(
      '[DELETE fixed cost INTERNAL ERROR]',
      error,
    );

    return NextResponse.json(
      {
        error:
          'internal_error',

        message:
          'Erro interno ao excluir custo.',
      },
      {
        status: 500,
      },
    );
  }
}
