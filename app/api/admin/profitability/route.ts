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

type ApiUsageUserRow = {
  user_id: string | null;
  user_email: string | null;

  call_count:
    | number
    | string
    | null;

  tokens_in:
    | number
    | string
    | null;

  tokens_out:
    | number
    | string
    | null;

  tokens_cached:
    | number
    | string
    | null;

  cost_usd_cents:
    | number
    | string
    | null;
};

type ApiDailyRow = {
  day: string;

  provider: string;

  operation: string;

  call_count:
    | number
    | string
    | null;

  tokens_in:
    | number
    | string
    | null;

  tokens_out:
    | number
    | string
    | null;

  tokens_cached:
    | number
    | string
    | null;

  cost_usd_cents:
    | number
    | string
    | null;
};

type SubscriptionRow =
  Record<string, unknown> & {
    user_id?: string;

    status?: string;

    plan?: string | null;

    plan_slug?: string | null;

    base_price?:
      | number
      | string
      | null;

    custom_price?:
      | number
      | string
      | null;

    current_period_end?:
      | string
      | null;
  };

type ProfileRow = {
  id: string;

  email:
    | string
    | null;

  role:
    | string
    | null;
};

/* =========================================================
   RANGES
========================================================= */

const ALLOWED_RANGES = [
  1,
  7,
  30,
  90,
] as const;

/* =========================================================
   HELPERS
========================================================= */

function numberValue(
  value: unknown,
  fallback = 0,
) {
  const number =
    Number(value);

  return Number.isFinite(
    number,
  )
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

/* =========================================================
   PREÇO DA ASSINATURA
========================================================= */

function getSubscriptionPrice(
  subscription:
    | SubscriptionRow
    | undefined,

  defaultPlanPrice: number,
) {
  if (!subscription) {
    return 0;
  }

  const status =
    String(
      subscription.status ??
        '',
    ).toLowerCase();

  /*
   * Trial não entra como receita.
   */
  if (
    status ===
    'trialing'
  ) {
    return 0;
  }

  /*
   * Status considerados
   * como assinatura pagante.
   */
  const revenueStatuses = [
    'active',
    'paid',
    'confirmed',
    'received',
  ];

  if (
    !revenueStatuses.includes(
      status,
    )
  ) {
    return 0;
  }

  /*
   * Preço personalizado.
   */
  const customPrice =
    numberValue(
      subscription.custom_price,
    );

  if (
    customPrice > 0
  ) {
    return customPrice;
  }

  /*
   * Preço base da assinatura.
   */
  const basePrice =
    numberValue(
      subscription.base_price,
    );

  if (
    basePrice > 0
  ) {
    return basePrice;
  }

  /*
   * Preço padrão.
   */
  return defaultPlanPrice;
}

/* =========================================================
   GET
========================================================= */

export async function GET(
  req: Request,
) {
  /* =======================================================
     AUTORIZAÇÃO
  ======================================================= */

  try {
    await requireAdmin();
  } catch (err) {
    if (
      err instanceof
      NotAdmin
    ) {
      return new NextResponse(
        'Not Found',
        {
          status: 404,
        },
      );
    }

    throw err;
  }

  /* =======================================================
     RANGE
  ======================================================= */

  const url =
    new URL(
      req.url,
    );

  const rangeRaw =
    Number(
      url.searchParams.get(
        'range',
      ) ?? 30,
    );

  const rangeDays =
    (
      ALLOWED_RANGES as readonly number[]
    ).includes(
      rangeRaw,
    )
      ? rangeRaw
      : 30;

  const sb =
    getServerSupabase();

  /* =======================================================
     CONFIGURAÇÕES DA RENTABILIDADE

     Aqui vem a cotação USD -> BRL.
  ======================================================= */

  const {
    data:
      profitabilitySettings,

    error:
      profitabilitySettingsError,
  } = await sb
    .from(
      'profitability_settings',
    )
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (
    profitabilitySettingsError
  ) {
    console.warn(
      '[profitability] settings:',
      profitabilitySettingsError.message,
    );
  }

  const usdBrl =
    numberValue(
      profitabilitySettings
        ?.usd_brl,

      5.5,
    );

  /* =======================================================
     CUSTOS FIXOS / INFRAESTRUTURA

     Agora cada custo pode estar em:
     BRL
     USD
  ======================================================= */

  const {
    data:
      fixedCostsData,

    error:
      fixedCostsError,
  } = await sb
    .from(
      'profitability_fixed_costs',
    )
    .select('*')
    .eq(
      'active',
      true,
    )
    .order(
      'sort_order',
      {
        ascending: true,
      },
    );

  if (
    fixedCostsError
  ) {
    console.warn(
      '[profitability] fixed costs:',
      fixedCostsError.message,
    );
  }

  const fixedCosts =
    (
      fixedCostsData ??
      []
    ).map(
      (item) => {
        const billingCycle =
          normalizeBillingCycle(
            item.billing_cycle,
          );

        const currency =
          normalizeCurrency(
            item.currency,
          );

        /*
         * monthly_amount continua
         * na moeda original.
         *
         * Exemplos:
         *
         * Hostinger:
         * 69.99 BRL/mês
         *
         * Supabase:
         * 25 USD/mês
         */
        const monthlyAmount =
          numberValue(
            item.monthly_amount,
          );

        let billingAmount =
          numberValue(
            item.billing_amount,
            NaN,
          );

        /*
         * Compatibilidade com
         * registros antigos.
         */
        if (
          !Number.isFinite(
            billingAmount,
          )
        ) {
          billingAmount =
            billingCycle ===
            'annual'
              ? monthlyAmount *
                12
              : monthlyAmount;
        }

        /*
         * Valor convertido para BRL.
         *
         * ESTE é o valor utilizado
         * nos cálculos financeiros.
         */
        const monthlyAmountBrl =
          currency ===
          'USD'
            ? monthlyAmount *
              usdBrl
            : monthlyAmount;

        return {
          id:
            item.id,

          name:
            item.name,

          description:
            item.description,

          /*
           * Valor original informado.
           */
          billingAmount,

          /*
           * BRL ou USD.
           */
          currency,

          billingCycle,

          /*
           * Equivalente mensal
           * na moeda original.
           */
          monthlyAmount,

          /*
           * Equivalente mensal
           * convertido para BRL.
           */
          monthlyAmountBrl,

          active:
            Boolean(
              item.active,
            ),

          sortOrder:
            numberValue(
              item.sort_order,
            ),
        };
      },
    );

  /* =======================================================
     TOTAL FIXO MENSAL

     IMPORTANTE:

     Tudo é convertido para BRL
     antes de somar.
  ======================================================= */

  const monthlyFixedCosts =
    fixedCosts.reduce(
      (
        total,
        item,
      ) =>
        total +
        item.monthlyAmountBrl,

      0,
    );

  /* =======================================================
     CUSTO TOTAL DAS APIs

     Mesma RPC utilizada em:
     /admin/costs

     Portanto os números dos dois
     painéis devem bater.
  ======================================================= */

  const {
    data:
      apiDailyData,

    error:
      apiDailyError,
  } = await sb.rpc(
    'admin_api_usage_daily',
    {
      p_days:
        rangeDays,
    },
  );

  if (
    apiDailyError
  ) {
    console.warn(
      '[profitability] api daily RPC:',
      apiDailyError.message,
    );

    return NextResponse.json(
      {
        error:
          'api_usage_failed',
      },
      {
        status: 500,
      },
    );
  }

  const apiDailyRows =
    (
      apiDailyData ??
      []
    ) as ApiDailyRow[];

  /* =======================================================
     TOTAL API
  ======================================================= */

  const apiCostUsdCents =
    apiDailyRows.reduce(
      (
        total,
        row,
      ) =>
        total +
        numberValue(
          row.cost_usd_cents,
        ),

      0,
    );

  const apiCostUsd =
    apiCostUsdCents /
    100;

  const apiCostBrl =
    apiCostUsd *
    usdBrl;

  /* =======================================================
     POR PROVEDOR

     OpenAI
     Cohere
     Voyage
  ======================================================= */

  const providerMap =
    new Map<
      string,
      {
        provider: string;

        costUsdCents: number;

        calls: number;

        tokensIn: number;

        tokensOut: number;
      }
    >();

  for (
    const row
    of apiDailyRows
  ) {
    const provider =
      row.provider ||
      'unknown';

    const current =
      providerMap.get(
        provider,
      ) ?? {
        provider,

        costUsdCents:
          0,

        calls:
          0,

        tokensIn:
          0,

        tokensOut:
          0,
      };

    current.costUsdCents +=
      numberValue(
        row.cost_usd_cents,
      );

    current.calls +=
      numberValue(
        row.call_count,
      );

    current.tokensIn +=
      numberValue(
        row.tokens_in,
      );

    current.tokensOut +=
      numberValue(
        row.tokens_out,
      );

    providerMap.set(
      provider,
      current,
    );
  }

  const apiByProvider =
    [
      ...providerMap.values(),
    ]
      .map(
        (
          item,
        ) => {
          const costUsd =
            item.costUsdCents /
            100;

          return {
            provider:
              item.provider,

            costUsd,

            costUsdCents:
              item.costUsdCents,

            costBrl:
              costUsd *
              usdBrl,

            calls:
              item.calls,

            tokensIn:
              item.tokensIn,

            tokensOut:
              item.tokensOut,
          };
        },
      )
      .sort(
        (
          a,
          b,
        ) =>
          b.costUsd -
          a.costUsd,
      );

  /* =======================================================
     POR OPERAÇÃO

     multimodal-parse
     chat-generate
     rerank
     etc.
  ======================================================= */

  const operationMap =
    new Map<
      string,
      {
        key: string;

        operation:
          string;

        provider:
          string;

        costUsdCents:
          number;

        calls:
          number;

        tokensIn:
          number;

        tokensOut:
          number;
      }
    >();

  for (
    const row
    of apiDailyRows
  ) {
    const provider =
      row.provider ||
      'unknown';

    const operation =
      row.operation ||
      'unknown';

    const key =
      `${provider}:${operation}`;

    const current =
      operationMap.get(
        key,
      ) ?? {
        key,

        operation,

        provider,

        costUsdCents:
          0,

        calls:
          0,

        tokensIn:
          0,

        tokensOut:
          0,
      };

    current.costUsdCents +=
      numberValue(
        row.cost_usd_cents,
      );

    current.calls +=
      numberValue(
        row.call_count,
      );

    current.tokensIn +=
      numberValue(
        row.tokens_in,
      );

    current.tokensOut +=
      numberValue(
        row.tokens_out,
      );

    operationMap.set(
      key,
      current,
    );
  }

  const apiByOperation =
    [
      ...operationMap.values(),
    ]
      .map(
        (
          item,
        ) => {
          const costUsd =
            item.costUsdCents /
            100;

          return {
            key:
              item.key,

            operation:
              item.operation,

            provider:
              item.provider,

            costUsd,

            costUsdCents:
              item.costUsdCents,

            costBrl:
              costUsd *
              usdBrl,

            calls:
              item.calls,

            tokensIn:
              item.tokensIn,

            tokensOut:
              item.tokensOut,
          };
        },
      )
      .sort(
        (
          a,
          b,
        ) =>
          b.costUsd -
          a.costUsd,
      );

  /* =======================================================
     CUSTO DE API POR USUÁRIO
  ======================================================= */

  const {
    data:
      usageData,

    error:
      usageError,
  } = await sb.rpc(
    'admin_api_usage_by_user',
    {
      p_days:
        rangeDays,
    },
  );

  if (
    usageError
  ) {
    console.warn(
      '[profitability] usage RPC:',
      usageError.message,
    );

    return NextResponse.json(
      {
        error:
          'usage_rpc_failed',
      },
      {
        status: 500,
      },
    );
  }

  const usageRows =
    (
      usageData ??
      []
    ) as ApiUsageUserRow[];

  /* =======================================================
     PERFIS
  ======================================================= */

  const {
    data:
      profilesData,

    error:
      profilesError,
  } = await sb
    .from(
      'profiles_with_email',
    )
    .select(
      'id, email, role',
    );

  if (
    profilesError
  ) {
    console.warn(
      '[profitability] profiles:',
      profilesError.message,
    );
  }

  const profiles =
    (
      profilesData ??
      []
    ) as ProfileRow[];

  /* =======================================================
     ASSINATURAS
  ======================================================= */

  const {
    data:
      subscriptionsData,

    error:
      subscriptionsError,
  } = await sb
    .from(
      'subscriptions',
    )
    .select('*');

  if (
    subscriptionsError
  ) {
    console.warn(
      '[profitability] subscriptions:',
      subscriptionsError.message,
    );
  }

  const subscriptions =
    (
      subscriptionsData ??
      []
    ) as SubscriptionRow[];

  const subscriptionMap =
    new Map<
      string,
      SubscriptionRow
    >();

  for (
    const subscription
    of subscriptions
  ) {
    if (
      subscription.user_id
    ) {
      subscriptionMap.set(
        subscription.user_id,
        subscription,
      );
    }
  }

  /* =======================================================
     PREÇO PADRÃO DO PLANO
  ======================================================= */

  const {
    data:
      billingSettings,

    error:
      billingSettingsError,
  } = await sb
    .from(
      'billing_settings',
    )
    .select(
      'plan_price',
    )
    .eq(
      'id',
      1,
    )
    .maybeSingle();

  if (
    billingSettingsError
  ) {
    console.warn(
      '[profitability] billing settings:',
      billingSettingsError.message,
    );
  }

  const defaultPlanPrice =
    numberValue(
      billingSettings
        ?.plan_price,

      0,
    );

  /* =======================================================
     MAPA DE USO POR CLIENTE
  ======================================================= */

  const usageMap =
    new Map<
      string,
      ApiUsageUserRow
    >();

  let unattributedApiCostUsdCents =
    0;

  for (
    const usage
    of usageRows
  ) {
    /*
     * Chamadas sem usuário:
     * pré-feature,
     * processos internos etc.
     */
    if (
      !usage.user_id
    ) {
      unattributedApiCostUsdCents +=
        numberValue(
          usage.cost_usd_cents,
        );

      continue;
    }

    usageMap.set(
      usage.user_id,
      usage,
    );
  }

  const unattributedApiCostUsd =
    unattributedApiCostUsdCents /
    100;

  const unattributedApiCostBrl =
    unattributedApiCostUsd *
    usdBrl;

  /* =======================================================
     CLIENTES PAGANTES
  ======================================================= */

  const payingUsers =
    profiles.filter(
      (
        profile,
      ) => {
        /*
         * Admin / gestor não entram
         * na receita.
         */
        if (
          profile.role !==
          'user'
        ) {
          return false;
        }

        const subscription =
          subscriptionMap.get(
            profile.id,
          );

        const price =
          getSubscriptionPrice(
            subscription,
            defaultPlanPrice,
          );

        return (
          price > 0
        );
      },
    );

  /* =======================================================
     RATEIO DA INFRAESTRUTURA

     monthlyFixedCosts já está 100% em BRL.
  ======================================================= */

  const infraPerClient =
    payingUsers.length >
    0
      ? monthlyFixedCosts /
        payingUsers.length
      : 0;

  /* =======================================================
     RENTABILIDADE POR CLIENTE
  ======================================================= */

  const customers =
    payingUsers.map(
      (
        profile,
      ) => {
        const subscription =
          subscriptionMap.get(
            profile.id,
          );

        const usage =
          usageMap.get(
            profile.id,
          );

        const monthlyRevenue =
          getSubscriptionPrice(
            subscription,
            defaultPlanPrice,
          );

        /* ===============================================
           API DO CLIENTE
        =============================================== */

        const userApiCostUsdCents =
          numberValue(
            usage
              ?.cost_usd_cents,
          );

        const userApiCostUsd =
          userApiCostUsdCents /
          100;

        const userApiCostBrl =
          userApiCostUsd *
          usdBrl;

        /* ===============================================
           CUSTOS
        =============================================== */

        const totalCostBrl =
          userApiCostBrl +
          infraPerClient;

        const profitBrl =
          monthlyRevenue -
          totalCostBrl;

        const margin =
          monthlyRevenue >
          0
            ? (
                profitBrl /
                monthlyRevenue
              ) * 100
            : 0;

        return {
          userId:
            profile.id,

          email:
            profile.email ??
            '—',

          plan:
            subscription
              ?.plan_slug ??
            subscription
              ?.plan ??
            '—',

          status:
            subscription
              ?.status ??
            'none',

          monthlyRevenue,

          apiCostUsd:
            userApiCostUsd,

          apiCostBrl:
            userApiCostBrl,

          /*
           * Sempre BRL.
           */
          infraCostBrl:
            infraPerClient,

          totalCostBrl,

          profitBrl,

          margin,

          calls:
            numberValue(
              usage
                ?.call_count,
            ),
        };
      },
    );

  customers.sort(
    (
      a,
      b,
    ) =>
      b.monthlyRevenue -
      a.monthlyRevenue,
  );

  /* =======================================================
     RECEITA MENSAL
  ======================================================= */

  const revenue =
    customers.reduce(
      (
        total,
        customer,
      ) =>
        total +
        customer.monthlyRevenue,

      0,
    );

  /* =======================================================
     FATOR DO PERÍODO
  ======================================================= */

  const periodFactor =
    rangeDays /
    30;

  /* =======================================================
     INFRAESTRUTURA NO PERÍODO
  ======================================================= */

  const periodFixedCosts =
    monthlyFixedCosts *
    periodFactor;

  /* =======================================================
     CUSTO TOTAL
  ======================================================= */

  const totalCost =
    apiCostBrl +
    periodFixedCosts;

  const profit =
    revenue -
    totalCost;

  const margin =
    revenue > 0
      ? (
          profit /
          revenue
        ) * 100
      : 0;

  /* =======================================================
     PONTO DE EQUILÍBRIO
  ======================================================= */

  const averageTicket =
    payingUsers.length >
    0
      ? revenue /
        payingUsers.length
      : 0;

  /*
   * API do período convertida para
   * equivalente mensal.
   */
  const monthlyApiCost =
    periodFactor >
    0
      ? apiCostBrl /
        periodFactor
      : 0;

  const averageApiCost =
    payingUsers.length >
    0
      ? monthlyApiCost /
        payingUsers.length
      : 0;

  const contributionMargin =
    averageTicket -
    averageApiCost;

  const breakEvenCustomers =
    contributionMargin >
    0
      ? Math.ceil(
          monthlyFixedCosts /
            contributionMargin,
        )
      : 0;

  /* =======================================================
     TOTAL TÉCNICO DE CHAMADAS/TOKENS
  ======================================================= */

  const totalCalls =
    apiDailyRows.reduce(
      (
        total,
        row,
      ) =>
        total +
        numberValue(
          row.call_count,
        ),

      0,
    );

  const totalTokensIn =
    apiDailyRows.reduce(
      (
        total,
        row,
      ) =>
        total +
        numberValue(
          row.tokens_in,
        ),

      0,
    );

  const totalTokensOut =
    apiDailyRows.reduce(
      (
        total,
        row,
      ) =>
        total +
        numberValue(
          row.tokens_out,
        ),

      0,
    );

  const totalTokensCached =
    apiDailyRows.reduce(
      (
        total,
        row,
      ) =>
        total +
        numberValue(
          row.tokens_cached,
        ),

      0,
    );

  /* =======================================================
     RESPONSE
  ======================================================= */

  return NextResponse.json({
    rangeDays,

    /* =====================================================
       COTAÇÃO
    ===================================================== */

    currency: {
      usdBrl,
    },

    /* =====================================================
       TOTAIS
    ===================================================== */

    totals: {
      /*
       * Receita mensal base.
       */
      revenue,

      /*
       * APIs.
       */
      apiCostUsd,

      apiCostUsdCents,

      apiCostBrl,

      /*
       * Infraestrutura convertida
       * para BRL.
       */
      fixedCostsBrl:
        periodFixedCosts,

      monthlyFixedCostsBrl:
        monthlyFixedCosts,

      /*
       * Resultado.
       */
      totalCostBrl:
        totalCost,

      profitBrl:
        profit,

      margin,

      /*
       * Clientes.
       */
      activePayingCustomers:
        payingUsers.length,

      /*
       * API não atribuída.
       */
      unattributedApiCostUsd,

      unattributedApiCostBrl,
    },

    /* =====================================================
       BREAK EVEN
    ===================================================== */

    breakEven: {
      averageTicket,

      averageApiCost,

      contributionMargin,

      customersRequired:
        breakEvenCustomers,

      activeCustomers:
        payingUsers.length,

      difference:
        payingUsers.length -
        breakEvenCustomers,
    },

    /* =====================================================
       CUSTOS FIXOS

       Cada item possui:
       - currency
       - monthlyAmount original
       - monthlyAmountBrl convertido
    ===================================================== */

    fixedCosts,

    /* =====================================================
       CLIENTES
    ===================================================== */

    customers,

    /* =====================================================
       USO DE API
    ===================================================== */

    apiUsage: {
      costUsd:
        apiCostUsd,

      costUsdCents:
        apiCostUsdCents,

      costBrl:
        apiCostBrl,

      calls:
        totalCalls,

      tokensIn:
        totalTokensIn,

      tokensOut:
        totalTokensOut,

      tokensCached:
        totalTokensCached,

      /*
       * OpenAI / Cohere / Voyage
       */
      byProvider:
        apiByProvider,

      /*
       * Top operações.
       */
      byOperation:
        apiByOperation,
    },
  });
}