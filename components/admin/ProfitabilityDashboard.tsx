'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';

import {
  AlertTriangle,
  CalendarDays,
  CircleDollarSign,
  Download,
  Pencil,
  Percent,
  Plus,
  RefreshCw,
  Save,
  Search,
  Server,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Users,
  WalletCards,
  X,
  type LucideIcon,
} from 'lucide-react';

import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

/* =========================================================
   TIPOS
========================================================= */

type RangeDays = 1 | 7 | 30 | 90;

type BillingCycle =
  | 'monthly'
  | 'annual';

type CostCurrency =
  | 'BRL'
  | 'USD';

type FixedCost = {
  id: string;

  name: string;

  description: string | null;

  /*
   * Estes dois campos são novos.
   *
   * Estão opcionais temporariamente para não quebrar
   * enquanto o GET /api/admin/profitability ainda não
   * devolver billing_amount e billing_cycle.
   */
  billingAmount?: number;

  billingCycle?: BillingCycle;

  currency?: CostCurrency;

  /*
   * Valor mensal equivalente na moeda original
   * do custo (BRL ou USD).
   */
  monthlyAmount: number;

  /*
   * Valor mensal convertido para BRL.
   * É este valor que entra nos cálculos financeiros.
   */
  monthlyAmountBrl?: number;

  active: boolean;

  sortOrder: number;
};

type Customer = {
  userId: string;

  email: string;

  plan: string;

  status: string;

  monthlyRevenue: number;

  apiCostUsd: number;

  apiCostBrl: number;

  infraCostBrl: number;

  totalCostBrl: number;

  profitBrl: number;

  margin: number;

  calls: number;
};

type ProfitabilityResponse = {
  rangeDays: number;

  currency: {
    usdBrl: number;
  };

  totals: {
    revenue: number;

    apiCostBrl: number;

    fixedCostsBrl: number;

    monthlyFixedCostsBrl: number;

    totalCostBrl: number;

    profitBrl: number;

    margin: number;

    activePayingCustomers: number;

    unattributedApiCostBrl: number;
  };

  breakEven: {
    averageTicket: number;

    averageApiCost: number;

    contributionMargin: number;

    customersRequired: number;

    activeCustomers: number;

    difference: number;
  };

  fixedCosts: FixedCost[];

  customers: Customer[];

  apiUsage: {
  costUsd: number;
  costUsdCents: number;
  costBrl: number;

  calls: number;
  tokensIn: number;
  tokensOut: number;
  tokensCached: number;

  byProvider: Array<{
    provider: string;

    costUsd: number;
    costUsdCents: number;
    costBrl: number;

    calls: number;

    tokensIn: number;
    tokensOut: number;
  }>;

  byOperation?: Array<{
    key: string;

    operation: string;
    provider: string;

    costUsd: number;
    costUsdCents: number;
    costBrl: number;

    calls: number;

    tokensIn: number;
    tokensOut: number;
  }>;
  };
};

type DisplayCustomer =
  Customer & {
    periodRevenue: number;

    periodInfra: number;

    periodTotalCost: number;

    periodProfit: number;

    periodMargin: number;
  };

type CostForm = {
  name: string;

  description: string;

  billingAmount: string;

  currency: CostCurrency;

  billingCycle: BillingCycle;

  sortOrder: string;
};

/* =========================================================
   FILTROS
========================================================= */

const RANGES = [
  {
    value: 1,
    label: 'Hoje',
  },
  {
    value: 7,
    label: '7 dias',
  },
  {
    value: 30,
    label: '30 dias',
  },
  {
    value: 90,
    label: '90 dias',
  },
] as const;

/* =========================================================
   FORM PADRÃO
========================================================= */

const EMPTY_COST_FORM: CostForm = {
  name: '',

  description: '',

  billingAmount: '',

  currency: 'BRL',

  billingCycle: 'monthly',

  sortOrder: '0',
};

/* =========================================================
   FORMATADORES
========================================================= */

const brlFormatter =
  new Intl.NumberFormat(
    'pt-BR',
    {
      style: 'currency',

      currency: 'BRL',

      minimumFractionDigits: 2,
    },
  );

const usdFormatter =
  new Intl.NumberFormat(
    'en-US',
    {
      style: 'currency',

      currency: 'USD',

      minimumFractionDigits: 2,

      maximumFractionDigits: 4,
    },
  );

const numberFormatter =
  new Intl.NumberFormat(
    'pt-BR',
  );

function fmtBrl(
  value: number,
) {
  return brlFormatter.format(
    Number.isFinite(value)
      ? value
      : 0,
  );
}

function fmtUsd(
  value: number,
) {
  return usdFormatter.format(
    Number.isFinite(value)
      ? value
      : 0,
  );
}

function fmtNum(
  value: number,
) {
  return numberFormatter.format(
    Number.isFinite(value)
      ? value
      : 0,
  );
}

function fmtPercent(
  value: number,
) {
  return `${(
    Number.isFinite(value)
      ? value
      : 0
  ).toFixed(1)}%`;
}

/* =========================================================
   HELPERS
========================================================= */

function parseDecimal(
  value: string,
) {
  const normalized = value
    .trim()
    .replace(/\s/g, '')
    .replace(',', '.');

  const parsed =
    Number(normalized);

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : NaN;
}

/*
 * Como billingAmount / billingCycle ainda podem não vir
 * do endpoint principal, utilizamos fallback.
 */
function getBillingCycle(
  cost: FixedCost,
): BillingCycle {
  return cost.billingCycle ===
    'annual'
    ? 'annual'
    : 'monthly';
}

function getBillingAmount(
  cost: FixedCost,
) {
  if (
    typeof cost.billingAmount ===
      'number' &&
    Number.isFinite(
      cost.billingAmount,
    )
  ) {
    return cost.billingAmount;
  }

  /*
   * Fallback temporário.
   */
  if (
    getBillingCycle(cost) ===
    'annual'
  ) {
    return (
      cost.monthlyAmount *
      12
    );
  }

  return cost.monthlyAmount;
}

function getCostCurrency(
  cost: FixedCost,
): CostCurrency {
  return cost.currency === 'USD'
    ? 'USD'
    : 'BRL';
}

function getMonthlyAmountBrl(
  cost: FixedCost,
  usdBrl: number,
) {
  if (
    typeof cost.monthlyAmountBrl === 'number' &&
    Number.isFinite(cost.monthlyAmountBrl)
  ) {
    return cost.monthlyAmountBrl;
  }

  return getCostCurrency(cost) === 'USD'
    ? cost.monthlyAmount * usdBrl
    : cost.monthlyAmount;
}

function formatCostAmount(
  value: number,
  currency: CostCurrency,
) {
  return currency === 'USD'
    ? fmtUsd(value)
    : fmtBrl(value);
}

async function getApiErrorMessage(
  response: Response,

  fallback: string,
) {
  try {
    const body =
      (await response.json()) as {
        message?: string;

        error?: string;
      };

    return (
      body.message ||
      body.error ||
      fallback
    );
  } catch {
    return fallback;
  }
}

/* =========================================================
   DASHBOARD
========================================================= */

export function ProfitabilityDashboard() {
  const [range, setRange] =
    useState<RangeDays>(30);

  const [data, setData] =
    useState<ProfitabilityResponse | null>(
      null,
    );

  const [loading, setLoading] =
    useState(true);

  const [search, setSearch] =
    useState('');

  /* =======================================================
     MODAL CUSTO
  ======================================================= */

  const [
    costModalOpen,
    setCostModalOpen,
  ] = useState(false);

  const [
    editingCost,
    setEditingCost,
  ] =
    useState<FixedCost | null>(
      null,
    );

  const [
    costForm,
    setCostForm,
  ] =
    useState<CostForm>(
      EMPTY_COST_FORM,
    );

  const [
    savingCost,
    setSavingCost,
  ] = useState(false);

  /* =======================================================
     MODAL EXCLUSÃO
  ======================================================= */

  const [
    deleteTarget,
    setDeleteTarget,
  ] =
    useState<FixedCost | null>(
      null,
    );

  const [
    deletingCost,
    setDeletingCost,
  ] = useState(false);

  /* =======================================================
     CARREGAR DADOS
  ======================================================= */

  const fetchData =
    useCallback(
      async (
        selectedRange: RangeDays,
      ) => {
        setLoading(true);

        try {
          const response =
            await fetch(
              `/api/admin/profitability?range=${selectedRange}`,
              {
                cache:
                  'no-store',
              },
            );

          if (
            !response.ok
          ) {
            throw new Error(
              `Erro ${response.status}`,
            );
          }

          const body =
            (await response.json()) as ProfitabilityResponse;

          setData(body);
        } catch (error) {
          console.error(
            '[ProfitabilityDashboard]',
            error,
          );

          toast.error(
            'Falha ao carregar rentabilidade',
            {
              description:
                String(error),
            },
          );
        } finally {
          setLoading(false);
        }
      },
      [],
    );

  useEffect(() => {
    void fetchData(range);
  }, [
    range,
    fetchData,
  ]);

  /* =======================================================
     FATOR DO PERÍODO
  ======================================================= */

  const periodFactor =
    range / 30;

  /* =======================================================
     CLIENTES
  ======================================================= */

  const displayCustomers =
    useMemo<
      DisplayCustomer[]
    >(() => {
      if (!data) {
        return [];
      }

      return data.customers.map(
        (customer) => {
          const periodRevenue =
            customer.monthlyRevenue *
            periodFactor;

          const periodInfra =
            customer.infraCostBrl *
            periodFactor;

          const periodTotalCost =
            customer.apiCostBrl +
            periodInfra;

          const periodProfit =
            periodRevenue -
            periodTotalCost;

          const periodMargin =
            periodRevenue >
            0
              ? (periodProfit /
                  periodRevenue) *
                100
              : 0;

          return {
            ...customer,

            periodRevenue,

            periodInfra,

            periodTotalCost,

            periodProfit,

            periodMargin,
          };
        },
      );
    }, [
      data,
      periodFactor,
    ]);

  /* =======================================================
     FINANCEIRO
  ======================================================= */

  const financial =
    useMemo(() => {
      if (!data) {
        return {
          revenue: 0,

          api: 0,

          infrastructure: 0,

          totalCost: 0,

          profit: 0,

          margin: 0,
        };
      }

      const revenue =
        data.totals
          .revenue *
        periodFactor;

      const api =
        data.totals
          .apiCostBrl;

      const infrastructure =
        data.totals
          .monthlyFixedCostsBrl *
        periodFactor;

      const totalCost =
        api +
        infrastructure;

      const profit =
        revenue -
        totalCost;

      const margin =
        revenue > 0
          ? (profit /
              revenue) *
            100
          : 0;

      return {
        revenue,

        api,

        infrastructure,

        totalCost,

        profit,

        margin,
      };
    }, [
      data,
      periodFactor,
    ]);

  /* =======================================================
     BREAK EVEN
  ======================================================= */

  const breakEven =
    useMemo(() => {
      if (!data) {
        return {
          averageTicket: 0,

          averageMonthlyApiCost:
            0,

          contributionMargin:
            0,

          customersRequired:
            0,

          activeCustomers: 0,

          difference: 0,
        };
      }

      const activeCustomers =
        data.totals
          .activePayingCustomers;

      const averageTicket =
        activeCustomers > 0
          ? data.totals
              .revenue /
            activeCustomers
          : 0;

      const monthlyApiTotal =
        periodFactor > 0
          ? data.totals
              .apiCostBrl /
            periodFactor
          : 0;

      const averageMonthlyApiCost =
        activeCustomers > 0
          ? monthlyApiTotal /
            activeCustomers
          : 0;

      const contributionMargin =
        averageTicket -
        averageMonthlyApiCost;

      const customersRequired =
        contributionMargin > 0
          ? Math.ceil(
              data.totals
                .monthlyFixedCostsBrl /
                contributionMargin,
            )
          : 0;

      return {
        averageTicket,

        averageMonthlyApiCost,

        contributionMargin,

        customersRequired,

        activeCustomers,

        difference:
          activeCustomers -
          customersRequired,
      };
    }, [
      data,
      periodFactor,
    ]);

  /* =======================================================
     BUSCA
  ======================================================= */

  const filteredCustomers =
    useMemo(() => {
      const term =
        search
          .trim()
          .toLowerCase();

      if (!term) {
        return displayCustomers;
      }

      return displayCustomers.filter(
        (customer) =>
          customer.email
            .toLowerCase()
            .includes(
              term,
            ) ||
          customer.plan
            .toLowerCase()
            .includes(
              term,
            ),
      );
    }, [
      displayCustomers,
      search,
    ]);

  /* =======================================================
     EQUIVALENTE MENSAL DO FORM
  ======================================================= */

  const formBillingAmount =
    useMemo(() => {
      const amount =
        parseDecimal(
          costForm.billingAmount,
        );

      return Number.isFinite(
        amount,
      )
        ? amount
        : 0;
    }, [
      costForm.billingAmount,
    ]);

  const formMonthlyEquivalent =
    useMemo(() => {
      if (
        costForm.billingCycle ===
        'annual'
      ) {
        return (
          formBillingAmount /
          12
        );
      }

      return formBillingAmount;
    }, [
      costForm.billingCycle,
      formBillingAmount,
    ]);

  const formMonthlyEquivalentBrl =
    useMemo(() => {
      if (!data) {
        return 0;
      }

      return costForm.currency === 'USD'
        ? formMonthlyEquivalent * data.currency.usdBrl
        : formMonthlyEquivalent;
    }, [
      costForm.currency,
      data,
      formMonthlyEquivalent,
    ]);

  /* =======================================================
     NOVO CUSTO
  ======================================================= */

  function openNewCostModal() {
    setEditingCost(null);

    const nextOrder =
      data?.fixedCosts.length
        ? Math.max(
            ...data.fixedCosts.map(
              (cost) =>
                cost.sortOrder,
            ),
          ) + 1
        : 1;

    setCostForm({
      ...EMPTY_COST_FORM,

      sortOrder:
        String(
          nextOrder,
        ),
    });

    setCostModalOpen(
      true,
    );
  }

  /* =======================================================
     EDITAR
  ======================================================= */

  function openEditCostModal(
    cost: FixedCost,
  ) {
    const billingCycle =
      getBillingCycle(cost);

    const billingAmount =
      getBillingAmount(cost);

    setEditingCost(cost);

    setCostForm({
      name:
        cost.name,

      description:
        cost.description ??
        '',

      billingAmount:
        String(
          billingAmount,
        ),

      currency:
        getCostCurrency(cost),

      billingCycle,

      sortOrder:
        String(
          cost.sortOrder,
        ),
    });

    setCostModalOpen(
      true,
    );
  }

  /* =======================================================
     FECHAR MODAL
  ======================================================= */

  function closeCostModal() {
    if (savingCost) {
      return;
    }

    setCostModalOpen(
      false,
    );

    setEditingCost(
      null,
    );

    setCostForm(
      EMPTY_COST_FORM,
    );
  }

  /* =======================================================
     SALVAR
  ======================================================= */

  async function handleSaveCost(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const name =
      costForm.name.trim();

    const description =
      costForm.description.trim();

    const billingAmount =
      parseDecimal(
        costForm.billingAmount,
      );

    const sortOrder =
      Number.parseInt(
        costForm.sortOrder,
        10,
      );

    if (!name) {
      toast.error(
        'Informe o nome do custo',
      );

      return;
    }

    if (
      !Number.isFinite(
        billingAmount,
      ) ||
      billingAmount <
        0
    ) {
      toast.error(
        'Informe um valor válido',
      );

      return;
    }

    setSavingCost(true);

    try {
      const editing =
        editingCost !==
        null;

      const url =
        editing
          ? `/api/admin/profitability/fixed-costs/${editingCost.id}`
          : '/api/admin/profitability/fixed-costs';

      const response =
        await fetch(
          url,
          {
            method:
              editing
                ? 'PATCH'
                : 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body: JSON.stringify(
              {
                name,

                description:
                  description ||
                  null,

                billingAmount,

                currency:
                  costForm.currency,

                billingCycle:
                  costForm.billingCycle,

                active: true,

                sortOrder:
                  Number.isFinite(
                    sortOrder,
                  )
                    ? sortOrder
                    : 0,
              },
            ),
          },
        );

      if (
        !response.ok
      ) {
        const message =
          await getApiErrorMessage(
            response,

            editing
              ? 'Não foi possível atualizar o custo.'
              : 'Não foi possível cadastrar o custo.',
          );

        throw new Error(
          message,
        );
      }

      toast.success(
        editing
          ? 'Custo atualizado'
          : 'Custo adicionado',
        {
          description:
            editing
              ? `${name} foi atualizado com sucesso.`
              : `${name} foi adicionado aos custos fixos.`,
        },
      );

      setCostModalOpen(
        false,
      );

      setEditingCost(
        null,
      );

      setCostForm(
        EMPTY_COST_FORM,
      );

      await fetchData(
        range,
      );
    } catch (error) {
      console.error(
        '[ProfitabilityDashboard save cost]',
        error,
      );

      toast.error(
        editingCost
          ? 'Falha ao atualizar custo'
          : 'Falha ao adicionar custo',
        {
          description:
            error instanceof
            Error
              ? error.message
              : String(
                  error,
                ),
        },
      );
    } finally {
      setSavingCost(false);
    }
  }

  /* =======================================================
     EXCLUIR
  ======================================================= */

  async function handleDeleteCost() {
    if (
      !deleteTarget
    ) {
      return;
    }

    setDeletingCost(
      true,
    );

    try {
      const response =
        await fetch(
          `/api/admin/profitability/fixed-costs/${deleteTarget.id}`,
          {
            method:
              'DELETE',
          },
        );

      if (
        !response.ok
      ) {
        const message =
          await getApiErrorMessage(
            response,

            'Não foi possível excluir o custo.',
          );

        throw new Error(
          message,
        );
      }

      toast.success(
        'Custo excluído',
        {
          description: `${deleteTarget.name} foi removido dos custos fixos.`,
        },
      );

      setDeleteTarget(
        null,
      );

      await fetchData(
        range,
      );
    } catch (error) {
      console.error(
        '[ProfitabilityDashboard delete cost]',
        error,
      );

      toast.error(
        'Falha ao excluir custo',
        {
          description:
            error instanceof
            Error
              ? error.message
              : String(
                  error,
                ),
        },
      );
    } finally {
      setDeletingCost(
        false,
      );
    }
  }

  /* =======================================================
     EXPORTAR CSV
  ======================================================= */

  type CsvValue =
    | string
    | number
    | null
    | undefined;

  function downloadCsv(
    filename: string,
    rows: CsvValue[][],
  ) {
    const escape = (
      value: CsvValue,
    ) => {
      const text =
        value == null
          ? ''
          : String(value);

      return `"${text.replace(
        /"/g,
        '""',
      )}"`;
    };

    const csv =
      '\uFEFF' +
      rows
        .map((row) =>
          row
            .map(escape)
            .join(';'),
        )
        .join('\n');

    const blob =
      new Blob(
        [csv],
        {
          type: 'text/csv;charset=utf-8;',
        },
      );

    const url =
      URL.createObjectURL(
        blob,
      );

    const anchor =
      document.createElement(
        'a',
      );

    anchor.href =
      url;

    anchor.download =
      filename;

    document.body.appendChild(
      anchor,
    );

    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(
      url,
    );
  }

  function exportCustomersCsv() {
    if (
      !filteredCustomers.length
    ) {
      toast.error(
        'Não há clientes para exportar',
      );

      return;
    }

    downloadCsv(
      `rentabilidade-clientes-${range}-dias.csv`,
      [
        [
          'Cliente',
          'Plano',
          'Receita (R$)',
          'Custo API (R$)',
          'Infraestrutura (R$)',
          'Custo total (R$)',
          'Lucro (R$)',
          'Margem (%)',
          'Chamadas',
        ],

        ...filteredCustomers.map(
          (customer) => [
            customer.email,
            customer.plan,
            customer.periodRevenue.toFixed(2),
            customer.apiCostBrl.toFixed(2),
            customer.periodInfra.toFixed(2),
            customer.periodTotalCost.toFixed(2),
            customer.periodProfit.toFixed(2),
            customer.periodMargin.toFixed(2),
            customer.calls,
          ],
        ),
      ],
    );
  }

  function exportProvidersCsv() {
    if (!data) {
      toast.error(
        'Os dados ainda não foram carregados',
      );

      return;
    }

    if (
      !data.apiUsage.byProvider.length
    ) {
      toast.error(
        'Não há custos de IA para exportar',
      );

      return;
    }

    downloadCsv(
      `custos-variaveis-ia-${range}-dias.csv`,
      [
        [
          'Provedor',
          'Custo USD',
          'Custo R$',
          'Chamadas',
          'Tokens in',
          'Tokens out',
        ],

        ...data.apiUsage.byProvider.map(
          (provider) => [
            provider.provider,
            provider.costUsd.toFixed(6),
            provider.costBrl.toFixed(2),
            provider.calls,
            provider.tokensIn,
            provider.tokensOut,
          ],
        ),

        [
          'Total',
          data.apiUsage.costUsd.toFixed(6),
          data.apiUsage.costBrl.toFixed(2),
          data.apiUsage.calls,
          data.apiUsage.tokensIn,
          data.apiUsage.tokensOut,
        ],
      ],
    );
  }

  function exportOperationsCsv() {
    if (!data) {
      toast.error(
        'Os dados ainda não foram carregados',
      );

      return;
    }

    const operations =
      (
        data.apiUsage.byOperation ??
        []
      ).slice(0, 10);

    if (!operations.length) {
      toast.error(
        'Não há operações para exportar',
      );

      return;
    }

    downloadCsv(
      `top-operacoes-custo-${range}-dias.csv`,
      [
        [
          'Operação',
          'Provedor',
          'Custo USD',
          'Custo R$',
          'Chamadas',
          'Tokens in',
          'Tokens out',
        ],

        ...operations.map(
          (operation) => [
            operation.operation,
            operation.provider,
            operation.costUsd.toFixed(6),
            operation.costBrl.toFixed(2),
            operation.calls,
            operation.tokensIn,
            operation.tokensOut,
          ],
        ),
      ],
    );
  }

  function exportFixedCostsCsv() {
    if (!data) {
      toast.error(
        'Os dados ainda não foram carregados',
      );

      return;
    }

    if (!data.fixedCosts.length) {
      toast.error(
        'Não há custos fixos para exportar',
      );

      return;
    }

    downloadCsv(
      'infraestrutura-servicos-fixos.csv',
      [
        [
          'Serviço',
          'Descrição',
          'Moeda',
          'Valor cobrado',
          'Periodicidade',
          'Equiv. mensal (moeda original)',
          'Equiv. mensal (R$)',
          'Status',
          'Ordem',
        ],

        ...data.fixedCosts.map(
          (cost) => {
            const currency =
              getCostCurrency(
                cost,
              );

            const billingCycle =
              getBillingCycle(
                cost,
              );

            return [
              cost.name,
              cost.description ?? '',
              currency,
              getBillingAmount(
                cost,
              ).toFixed(2),
              billingCycle === 'annual'
                ? 'Anual'
                : 'Mensal',
              cost.monthlyAmount.toFixed(2),
              getMonthlyAmountBrl(
                cost,
                data.currency.usdBrl,
              ).toFixed(2),
              cost.active
                ? 'Ativo'
                : 'Inativo',
              cost.sortOrder,
            ];
          },
        ),

        [
          'Total mensal considerado',
          '',
          'BRL',
          '',
          '',
          '',
          data.totals.monthlyFixedCostsBrl.toFixed(2),
          '',
          '',
        ],
      ],
    );
  }

  /* =======================================================
     LOADING
  ======================================================= */

  if (
    loading &&
    !data
  ) {
    return (
      <div className="space-y-6">
        <HeaderSkeleton />

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          {Array.from({
            length: 6,
          }).map(
            (_, index) => (
              <div
                key={
                  index
                }
                className="h-28 animate-pulse rounded-xl border border-border bg-card"
              />
            ),
          )}
        </div>

        <div className="h-72 animate-pulse rounded-xl border border-border bg-card" />

        <div className="h-80 animate-pulse rounded-xl border border-border bg-card" />
      </div>
    );
  }

  /* =======================================================
     SEM DADOS
  ======================================================= */

  if (!data) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-400" />

        <h2 className="text-lg font-semibold">
          Não foi possível
          carregar os dados
        </h2>

        <p className="mt-1 text-sm text-muted-foreground">
          Tente atualizar a
          página de rentabilidade.
        </p>

        <Button
          className="mt-4"
          variant="outline"
          onClick={() =>
            fetchData(
              range,
            )
          }
        >
          <RefreshCw className="mr-2 h-4 w-4" />

          Tentar novamente
        </Button>
      </div>
    );
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <>
      <div className="space-y-6">
        {/* =================================================
            HEADER
        ================================================= */}

        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand">
              <TrendingUp className="h-4 w-4" />

              Rentabilidade
            </div>

            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Custos e
              Rentabilidade
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Acompanhe receita,
              custos de IA,
              infraestrutura,
              lucro e margem por
              cliente.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex overflow-hidden rounded-lg border border-border bg-card">
              {RANGES.map(
                (item) => (
                  <button
                    key={
                      item.value
                    }
                    type="button"
                    onClick={() =>
                      setRange(
                        item.value,
                      )
                    }
                    className={`px-3 py-2 text-xs transition-colors ${
                      range ===
                      item.value
                        ? 'bg-brand/15 font-semibold text-brand'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}
                  >
                    {
                      item.label
                    }
                  </button>
                ),
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              disabled={
                loading
              }
              onClick={() =>
                fetchData(
                  range,
                )
              }
              title="Atualizar dados"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  loading
                    ? 'animate-spin'
                    : ''
                }`}
              />
            </Button>
          </div>
        </div>

        {/* =================================================
            CARDS
        ================================================= */}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <MetricCard
            label="Receita no período"
            value={fmtBrl(
              financial.revenue,
            )}
            icon={
              WalletCards
            }
            tone="green"
          />

          <MetricCard
            label="Custos de API"
            value={fmtBrl(
              financial.api,
            )}
            sub={
              data.currency
                .usdBrl >
              0
                ? fmtUsd(
                    financial.api /
                      data
                        .currency
                        .usdBrl,
                  )
                : undefined
            }
            icon={
              CircleDollarSign
            }
            tone="blue"
          />

          <MetricCard
            label="Infraestrutura"
            value={fmtBrl(
              financial.infrastructure,
            )}
            icon={
              Server
            }
            tone="purple"
          />

          <MetricCard
            label="Custo total"
            value={fmtBrl(
              financial.totalCost,
            )}
            icon={
              CircleDollarSign
            }
            tone="neutral"
          />

          <MetricCard
            label="Lucro estimado"
            value={fmtBrl(
              financial.profit,
            )}
            icon={
              financial.profit >=
              0
                ? TrendingUp
                : TrendingDown
            }
            tone={
              financial.profit >=
              0
                ? 'green'
                : 'red'
            }
          />

          <MetricCard
            label="Margem"
            value={fmtPercent(
              financial.margin,
            )}
            icon={
              Percent
            }
            tone={
              financial.margin >=
              50
                ? 'green'
                : financial.margin >=
                    20
                  ? 'yellow'
                  : 'red'
            }
          />
        </div>

        {/* =================================================
            ALERTA CUSTO NÃO ATRIBUÍDO
        ================================================= */}

        {data.totals
          .unattributedApiCostBrl >
          0 && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />

            <div>
              <div className="text-sm font-medium">
                Existe custo de
                API não atribuído a
                usuários
              </div>

              <div className="mt-0.5 text-xs text-muted-foreground">
                {fmtBrl(
                  data.totals
                    .unattributedApiCostBrl,
                )}{' '}
                no período
                selecionado foi
                classificado como
                custo geral da
                plataforma.
              </div>
            </div>
          </div>
        )}

        {/* =================================================
            COMPARATIVO
        ================================================= */}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
          <SectionCard
            title="Receita x Custos x Lucro"
            description="Comparação financeira do período selecionado."
          >
            <FinancialComparison
              revenue={
                financial.revenue
              }
              cost={
                financial.totalCost
              }
              profit={
                financial.profit
              }
            />
          </SectionCard>

          <SectionCard
            title="Ponto de equilíbrio"
            description="Estimativa mensal da operação."
            icon={
              Target
            }
          >
            <div className="space-y-3">
              <InfoRow
                label="Custos fixos mensais"
                value={fmtBrl(
                  data.totals
                    .monthlyFixedCostsBrl,
                )}
              />

              <InfoRow
                label="Ticket médio"
                value={fmtBrl(
                  breakEven
                    .averageTicket,
                )}
              />

              <InfoRow
                label="Custo variável médio"
                value={fmtBrl(
                  breakEven
                    .averageMonthlyApiCost,
                )}
              />

              <div className="my-3 border-t border-border" />

              <InfoRow
                label="Clientes necessários"
                value={fmtNum(
                  breakEven
                    .customersRequired,
                )}
                strong
              />

              <InfoRow
                label="Clientes pagantes"
                value={fmtNum(
                  breakEven
                    .activeCustomers,
                )}
                strong
              />

              <div
                className={`mt-4 rounded-lg border p-3 ${
                  breakEven.difference >=
                  0
                    ? 'border-emerald-500/20 bg-emerald-500/5'
                    : 'border-amber-500/20 bg-amber-500/5'
                }`}
              >
                <div
                  className={`flex items-center gap-2 text-sm font-semibold ${
                    breakEven.difference >=
                    0
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                  }`}
                >
                  {breakEven.difference >=
                  0 ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}

                  {breakEven.difference >=
                  0
                    ? 'Acima do ponto de equilíbrio'
                    : 'Abaixo do ponto de equilíbrio'}
                </div>

                <div className="mt-1 text-xl font-semibold tabular-nums">
                  {breakEven.difference >=
                  0
                    ? '+'
                    : ''}

                  {fmtNum(
                    breakEven.difference,
                  )}{' '}
                  clientes
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* =================================================
            CLIENTES
        ================================================= */}

        <SectionCard
          title="Rentabilidade por cliente"
          description="Receita, consumo de IA, custos e margem no período selecionado."
          icon={
            Users
          }
          actions={
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                <input
                  type="text"
                  value={
                    search
                  }
                  onChange={(
                    event,
                  ) =>
                    setSearch(
                      event
                        .target
                        .value,
                    )
                  }
                  placeholder="Buscar cliente..."
                  className="h-9 w-full min-w-[220px] rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none transition focus:border-brand sm:w-[260px]"
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={
                  exportCustomersCsv
                }
              >
                <Download className="mr-2 h-4 w-4" />

                Exportar CSV
              </Button>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    Cliente
                  </TableHead>

                  <TableHead>
                    Plano
                  </TableHead>

                  <TableHead className="text-right">
                    Receita
                  </TableHead>

                  <TableHead className="text-right">
                    API
                  </TableHead>

                  <TableHead className="text-right">
                    Infra
                  </TableHead>

                  <TableHead className="text-right">
                    Custo total
                  </TableHead>

                  <TableHead className="text-right">
                    Lucro
                  </TableHead>

                  <TableHead className="text-right">
                    Margem
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredCustomers.map(
                  (
                    customer,
                  ) => (
                    <TableRow
                      key={
                        customer.userId
                      }
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar
                            email={
                              customer.email
                            }
                          />

                          <div>
                            <div className="font-medium">
                              {
                                customer.email
                              }
                            </div>

                            <div className="mt-0.5 text-[11px] text-muted-foreground">
                              {fmtNum(
                                customer.calls,
                              )}{' '}
                              chamadas
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <PlanBadge
                          plan={
                            customer.plan
                          }
                        />
                      </TableCell>

                      <TableCell className="text-right tabular-nums">
                        {fmtBrl(
                          customer.periodRevenue,
                        )}
                      </TableCell>

                      <TableCell className="text-right tabular-nums">
                        <div>
                          {fmtBrl(
                            customer.apiCostBrl,
                          )}
                        </div>

                        <div className="text-[10px] text-muted-foreground">
                          {fmtUsd(
                            customer.apiCostUsd,
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="text-right tabular-nums">
                        {fmtBrl(
                          customer.periodInfra,
                        )}
                      </TableCell>

                      <TableCell className="text-right font-medium tabular-nums">
                        {fmtBrl(
                          customer.periodTotalCost,
                        )}
                      </TableCell>

                      <TableCell
                        className={`text-right font-semibold tabular-nums ${
                          customer.periodProfit >=
                          0
                            ? 'text-emerald-400'
                            : 'text-red-400'
                        }`}
                      >
                        {fmtBrl(
                          customer.periodProfit,
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        <MarginBadge
                          margin={
                            customer.periodMargin
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ),
                )}

                {filteredCustomers.length ===
                  0 && (
                  <TableRow>
                    <TableCell
                      colSpan={
                        8
                      }
                      className="h-28 text-center text-muted-foreground"
                    >
                      Nenhum
                      cliente
                      encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </SectionCard>


{/* =================================================
    CUSTOS VARIÁVEIS DE IA
================================================= */}

<SectionCard
  title="Custos variáveis de IA"
  description="Consumo automático registrado pelas APIs no período selecionado."
  icon={CircleDollarSign}
  actions={
    <Button
      variant="outline"
      size="sm"
      onClick={exportProvidersCsv}
    >
      <Download className="mr-2 h-4 w-4" />
      Exportar CSV
    </Button>
  }
>
  <div className="overflow-x-auto">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>
            Provedor
          </TableHead>

          <TableHead className="text-right">
            Custo USD
          </TableHead>

          <TableHead className="text-right">
            Custo R$
          </TableHead>

          <TableHead className="text-right">
            Chamadas
          </TableHead>

          <TableHead className="text-right">
            Tokens in
          </TableHead>

          <TableHead className="text-right">
            Tokens out
          </TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {data.apiUsage.byProvider.map(
          (provider) => (
            <TableRow
              key={
                provider.provider
              }
            >
              <TableCell className="font-medium capitalize">
                {
                  provider.provider
                }
              </TableCell>

              <TableCell className="text-right tabular-nums">
                {fmtUsd(
                  provider.costUsd,
                )}
              </TableCell>

              <TableCell className="text-right font-medium tabular-nums">
                {fmtBrl(
                  provider.costBrl,
                )}
              </TableCell>

              <TableCell className="text-right tabular-nums">
                {fmtNum(
                  provider.calls,
                )}
              </TableCell>

              <TableCell className="text-right tabular-nums">
                {fmtNum(
                  provider.tokensIn,
                )}
              </TableCell>

              <TableCell className="text-right tabular-nums">
                {fmtNum(
                  provider.tokensOut,
                )}
              </TableCell>
            </TableRow>
          ),
        )}
      </TableBody>

      <tfoot>
        <tr className="border-t border-border bg-muted/20">
          <td className="px-4 py-3 text-sm font-semibold">
            Total
          </td>

          <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums">
            {fmtUsd(
              data.apiUsage.costUsd,
            )}
          </td>

          <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums">
            {fmtBrl(
              data.apiUsage.costBrl,
            )}
          </td>

          <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums">
            {fmtNum(
              data.apiUsage.calls,
            )}
          </td>

          <td className="px-4 py-3 text-right text-sm text-muted-foreground">
            —
          </td>

          <td className="px-4 py-3 text-right text-sm text-muted-foreground">
            —
          </td>
        </tr>
      </tfoot>
    </Table>
  </div>

  <div className="mt-3 flex items-start gap-2 rounded-lg border border-brand/20 bg-brand/5 p-3">
    <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-brand" />

    <div className="text-xs text-muted-foreground">
      Estes valores são atualizados
      automaticamente a partir dos
      mesmos registros utilizados em{' '}
      <a
        href="/admin/costs"
        className="font-medium text-brand hover:underline"
      >
        Custos
      </a>
      . Não precisam ser cadastrados
      manualmente.
    </div>
  </div>
</SectionCard>

        {/* =================================================
            TOP OPERAÇÕES POR CUSTO
        ================================================= */}

        <SectionCard
          title="Top operações por custo"
          description="Operações que mais consumiram APIs no período selecionado."
          icon={TrendingUp}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={exportOperationsCsv}
              >
                <Download className="mr-2 h-4 w-4" />
                Exportar CSV
              </Button>

              <a
                href="/admin/costs"
                className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Ver todos em Custos
              </a>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Operação</TableHead>
                  <TableHead>Provedor</TableHead>
                  <TableHead className="text-right">Custo USD</TableHead>
                  <TableHead className="text-right">Custo R$</TableHead>
                  <TableHead className="text-right">Chamadas</TableHead>
                  <TableHead className="text-right">Tokens in</TableHead>
                  <TableHead className="text-right">Tokens out</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {(data.apiUsage.byOperation ?? [])
                  .slice(0, 10)
                  .map((operation) => (
                    <TableRow key={operation.key}>
                      <TableCell className="font-medium">
                        {operation.operation}
                      </TableCell>

                      <TableCell className="capitalize text-muted-foreground">
                        {operation.provider}
                      </TableCell>

                      <TableCell className="text-right tabular-nums">
                        {fmtUsd(operation.costUsd)}
                      </TableCell>

                      <TableCell className="text-right font-medium tabular-nums">
                        {fmtBrl(operation.costBrl)}
                      </TableCell>

                      <TableCell className="text-right tabular-nums">
                        {fmtNum(operation.calls)}
                      </TableCell>

                      <TableCell className="text-right tabular-nums">
                        {fmtNum(operation.tokensIn)}
                      </TableCell>

                      <TableCell className="text-right tabular-nums">
                        {fmtNum(operation.tokensOut)}
                      </TableCell>
                    </TableRow>
                  ))}

                {(data.apiUsage.byOperation ?? []).length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="h-24 text-center text-sm text-muted-foreground"
                    >
                      Sem dados de operação no período selecionado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-3 text-xs text-muted-foreground">
            Exibindo as 10 operações com maior custo no período. O detalhamento
            completo continua disponível em{' '}
            <a
              href="/admin/costs"
              className="font-medium text-brand hover:underline"
            >
              Custos
            </a>
            .
          </div>
        </SectionCard>

        {/* =================================================
            INFRAESTRUTURA
        ================================================= */}

        <SectionCard
          title="Infraestrutura e serviços fixos"
          description="Custos recorrentes utilizados no cálculo da rentabilidade."
          icon={
            Server
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={exportFixedCostsCsv}
              >
                <Download className="mr-2 h-4 w-4" />
                Exportar CSV
              </Button>

              <Button
                size="sm"
                onClick={
                  openNewCostModal
                }
              >
                <Plus className="mr-2 h-4 w-4" />

                Adicionar custo
              </Button>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    Serviço
                  </TableHead>

                  <TableHead>
                    Descrição
                  </TableHead>

                  <TableHead className="text-right">
                    Cobrança
                  </TableHead>

                  <TableHead className="text-right">
                    Equiv.
                    mensal
                  </TableHead>

                  <TableHead className="text-right">
                    Status
                  </TableHead>

                  <TableHead className="w-[120px] text-right">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {data.fixedCosts.map(
                  (cost) => {
                    const billingCycle =
                      getBillingCycle(
                        cost,
                      );

                    const billingAmount =
                      getBillingAmount(
                        cost,
                      );

                    const currency =
                      getCostCurrency(
                        cost,
                      );

                    const monthlyAmountBrl =
                      getMonthlyAmountBrl(
                        cost,
                        data.currency.usdBrl,
                      );

                    return (
                      <TableRow
                        key={
                          cost.id
                        }
                      >
                        <TableCell className="font-medium">
                          {
                            cost.name
                          }
                        </TableCell>

                        <TableCell className="text-muted-foreground">
                          {cost.description ||
                            '—'}
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="font-medium tabular-nums">
                            {formatCostAmount(
                              billingAmount,
                              currency,
                            )}
                          </div>

                          <div className="mt-0.5 text-[10px] text-muted-foreground">
                            {billingCycle ===
                            'annual'
                              ? 'por ano'
                              : 'por mês'}
                          </div>
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="font-medium tabular-nums">
                            {currency === 'USD'
                              ? fmtUsd(cost.monthlyAmount)
                              : fmtBrl(cost.monthlyAmount)}
                          </div>

                          {currency === 'USD' && (
                            <div className="mt-0.5 text-[10px] text-brand">
                              {fmtBrl(monthlyAmountBrl)} no cálculo
                            </div>
                          )}

                          {currency === 'BRL' &&
                            billingCycle === 'annual' && (
                              <div className="mt-0.5 text-[10px] text-brand">
                                mensalizado
                              </div>
                            )}
                        </TableCell>

                        <TableCell className="text-right">
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                              cost.active
                                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                                : 'border-border bg-muted text-muted-foreground'
                            }`}
                          >
                            {cost.active
                              ? 'Ativo'
                              : 'Inativo'}
                          </span>
                        </TableCell>

                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              title="Editar custo"
                              onClick={() =>
                                openEditCostModal(
                                  cost,
                                )
                              }
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              title="Excluir custo"
                              onClick={() =>
                                setDeleteTarget(
                                  cost,
                                )
                              }
                              className="text-red-400 hover:bg-red-500/10 hover:text-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  },
                )}

                {data.fixedCosts.length ===
                  0 && (
                  <TableRow>
                    <TableCell
                      colSpan={
                        6
                      }
                      className="h-28 text-center"
                    >
                      <div className="flex flex-col items-center">
                        <Server className="mb-2 h-6 w-6 text-muted-foreground" />

                        <div className="text-sm font-medium">
                          Nenhum
                          custo
                          cadastrado
                        </div>

                        <div className="mt-1 text-xs text-muted-foreground">
                          Adicione os
                          custos fixos
                          da operação
                          do PROGPT.
                        </div>

                        <Button
                          size="sm"
                          className="mt-3"
                          onClick={
                            openNewCostModal
                          }
                        >
                          <Plus className="mr-2 h-4 w-4" />

                          Adicionar
                          custo
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>

              {data.fixedCosts.length >
                0 && (
                <tfoot>
                  <tr className="border-t border-border bg-muted/20">
                    <td
                      colSpan={
                        3
                      }
                      className="px-4 py-3 text-sm font-semibold"
                    >
                      Total
                      mensal
                      considerado
                    </td>

                    <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums">
                      {fmtBrl(
                        data
                          .totals
                          .monthlyFixedCostsBrl,
                      )}
                    </td>

                    <td />

                    <td />
                  </tr>
                </tfoot>
              )}
            </Table>
          </div>
        </SectionCard>

        {/* =================================================
            RODAPÉ
        ================================================= */}

        <div className="flex flex-col gap-2 border-t border-border pt-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div>
            Cotação
            utilizada:{' '}

            <strong className="text-foreground">
              US$ 1 ={' '}
              {fmtBrl(
                data.currency
                  .usdBrl,
              )}
            </strong>
          </div>

          <div>
            Os custos
            detalhados de
            OpenAI, Cohere e
            Voyage continuam
            disponíveis em{' '}

            <a
              href="/admin/costs"
              className="font-medium text-brand hover:underline"
            >
              Custos
            </a>
            .
          </div>
        </div>
      </div>

      {/* ===================================================
          MODAL ADICIONAR / EDITAR
      =================================================== */}

      {costModalOpen && (
        <ModalOverlay
          onClose={
            closeCostModal
          }
        >
          <form
            onSubmit={
              handleSaveCost
            }
            className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-base font-semibold">
                  {editingCost
                    ? 'Editar custo'
                    : 'Adicionar custo'}
                </h2>

                <p className="mt-1 text-xs text-muted-foreground">
                  {editingCost
                    ? 'Atualize os dados deste custo.'
                    : 'Cadastre um novo custo da operação.'}
                </p>
              </div>

              <button
                type="button"
                disabled={
                  savingCost
                }
                onClick={
                  closeCostModal
                }
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              {/* NOME */}

              <FormField
                label="Nome do serviço"
                required
              >
                <input
                  autoFocus
                  type="text"
                  value={
                    costForm.name
                  }
                  onChange={(
                    event,
                  ) =>
                    setCostForm(
                      (
                        current,
                      ) => ({
                        ...current,

                        name:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  placeholder="Ex: Hostinger VPS KVM 4"
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition focus:border-brand"
                />
              </FormField>

              {/* DESCRIÇÃO */}

              <FormField label="Descrição">
                <textarea
                  value={
                    costForm.description
                  }
                  onChange={(
                    event,
                  ) =>
                    setCostForm(
                      (
                        current,
                      ) => ({
                        ...current,

                        description:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  placeholder="Ex: Servidor principal do PROGPT"
                  rows={
                    3
                  }
                  className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-brand"
                />
              </FormField>

              {/* VALOR + MOEDA + PERIODICIDADE */}

              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_110px_150px]">
                <FormField
                  label="Valor cobrado"
                  required
                >
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      {costForm.currency === 'USD'
                        ? 'US$'
                        : 'R$'}
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        costForm.billingAmount
                      }
                      onChange={(
                        event,
                      ) =>
                        setCostForm(
                          (
                            current,
                          ) => ({
                            ...current,

                            billingAmount:
                              event
                                .target
                                .value,
                          }),
                        )
                      }
                      placeholder="0,00"
                      className="h-10 w-full rounded-md border border-border bg-background pl-10 pr-3 text-sm outline-none transition focus:border-brand"
                    />
                  </div>
                </FormField>

                <FormField
                  label="Moeda"
                  required
                >
                  <select
                    value={
                      costForm.currency
                    }
                    onChange={(
                      event,
                    ) =>
                      setCostForm(
                        (
                          current,
                        ) => ({
                          ...current,

                          currency:
                            event
                              .target
                              .value ===
                            'USD'
                              ? 'USD'
                              : 'BRL',
                        }),
                      )
                    }
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition focus:border-brand"
                  >
                    <option value="BRL">
                      BRL
                    </option>

                    <option value="USD">
                      USD
                    </option>
                  </select>
                </FormField>

                <FormField
                  label="Periodicidade"
                  required
                >
                  <select
                    value={
                      costForm.billingCycle
                    }
                    onChange={(
                      event,
                    ) =>
                      setCostForm(
                        (
                          current,
                        ) => ({
                          ...current,

                          billingCycle:
                            event
                              .target
                              .value ===
                            'annual'
                              ? 'annual'
                              : 'monthly',
                        }),
                      )
                    }
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition focus:border-brand"
                  >
                    <option value="monthly">
                      Mensal
                    </option>

                    <option value="annual">
                      Anual
                    </option>
                  </select>
                </FormField>
              </div>

              {/* EQUIVALENTE MENSAL */}

              <div className="rounded-lg border border-brand/20 bg-brand/5 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                    <CalendarDays className="h-4 w-4" />
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground">
                      Custo mensal
                      considerado nos
                      cálculos
                    </div>

                    <div className="mt-1 text-xl font-semibold tabular-nums">
                      {formatCostAmount(
                        formMonthlyEquivalent,
                        costForm.currency,
                      )}
                    </div>

                    {costForm.currency === 'USD' && (
                      <div className="mt-1 text-sm font-medium text-brand tabular-nums">
                        {fmtBrl(
                          formMonthlyEquivalentBrl,
                        )}{' '}
                        no cálculo
                      </div>
                    )}

                    {costForm.billingCycle === 'annual' && (
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {formatCostAmount(
                          formBillingAmount,
                          costForm.currency,
                        )}{' '}
                        por ano ÷ 12 meses.
                      </div>
                    )}

                    {costForm.billingCycle === 'monthly' && (
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        O valor informado já corresponde ao custo mensal.
                      </div>
                    )}

                    {costForm.currency === 'USD' && data && (
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        Cotação usada: US$ 1 ={' '}
                        {fmtBrl(
                          data.currency.usdBrl,
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ORDEM */}

              <FormField label="Ordem">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={
                    costForm.sortOrder
                  }
                  onChange={(
                    event,
                  ) =>
                    setCostForm(
                      (
                        current,
                      ) => ({
                        ...current,

                        sortOrder:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition focus:border-brand"
                />
              </FormField>

              <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                O sistema mensaliza custos anuais e, quando a moeda for USD,
                converte automaticamente para reais usando a cotação configurada
                na Rentabilidade. O valor em BRL é usado em infraestrutura,
                rateio por cliente, custo total, lucro, margem e ponto de
                equilíbrio.
              </div>
            </div>

            {/* FOOTER */}

            <div className="flex justify-end gap-2 border-t border-border bg-muted/10 px-5 py-4">
              <Button
                type="button"
                variant="outline"
                disabled={
                  savingCost
                }
                onClick={
                  closeCostModal
                }
              >
                Cancelar
              </Button>

              <Button
                type="submit"
                disabled={
                  savingCost
                }
              >
                {savingCost ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}

                {savingCost
                  ? 'Salvando...'
                  : editingCost
                    ? 'Salvar alterações'
                    : 'Adicionar custo'}
              </Button>
            </div>
          </form>
        </ModalOverlay>
      )}

      {/* ===================================================
          MODAL EXCLUIR
      =================================================== */}

      {deleteTarget && (
        <ModalOverlay
          onClose={() => {
            if (
              !deletingCost
            ) {
              setDeleteTarget(
                null,
              );
            }
          }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
            <div className="p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10 text-red-400">
                <Trash2 className="h-5 w-5" />
              </div>

              <h2 className="mt-4 text-base font-semibold">
                Excluir custo?
              </h2>

              <p className="mt-2 text-sm text-muted-foreground">
                Você está
                prestes a
                excluir{' '}

                <strong className="text-foreground">
                  {
                    deleteTarget.name
                  }
                </strong>
                .
              </p>

              <div className="mt-4 rounded-lg border border-border bg-muted/20 p-3">
                <div className="text-xs text-muted-foreground">
                  Custo
                  considerado por
                  mês
                </div>

                <div className="mt-1 text-lg font-semibold tabular-nums">
                  {formatCostAmount(
                    deleteTarget.monthlyAmount,
                    getCostCurrency(deleteTarget),
                  )}
                </div>

                {getCostCurrency(deleteTarget) === 'USD' && data && (
                  <div className="mt-1 text-xs font-medium text-brand tabular-nums">
                    {fmtBrl(
                      getMonthlyAmountBrl(
                        deleteTarget,
                        data.currency.usdBrl,
                      ),
                    )}{' '}
                    no cálculo
                  </div>
                )}
              </div>

              <p className="mt-4 text-xs text-muted-foreground">
                Após a
                exclusão, os
                cálculos de
                infraestrutura,
                lucro, margem e
                ponto de
                equilíbrio serão
                atualizados.
              </p>
            </div>

            <div className="flex justify-end gap-2 border-t border-border bg-muted/10 px-5 py-4">
              <Button
                type="button"
                variant="outline"
                disabled={
                  deletingCost
                }
                onClick={() =>
                  setDeleteTarget(
                    null,
                  )
                }
              >
                Cancelar
              </Button>

              <Button
                type="button"
                disabled={
                  deletingCost
                }
                onClick={
                  handleDeleteCost
                }
                className="bg-red-600 text-white hover:bg-red-700"
              >
                {deletingCost ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}

                {deletingCost
                  ? 'Excluindo...'
                  : 'Excluir custo'}
              </Button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </>
  );
}

/* =========================================================
   MODAL
========================================================= */

function ModalOverlay({
  children,

  onClose,
}: {
  children: ReactNode;

  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(
        event,
      ) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      {children}
    </div>
  );
}

/* =========================================================
   FIELD
========================================================= */

function FormField({
  label,

  required = false,

  children,
}: {
  label: string;

  required?: boolean;

  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium">
        {label}

        {required && (
          <span className="ml-1 text-red-400">
            *
          </span>
        )}
      </span>

      {children}
    </label>
  );
}

/* =========================================================
   METRIC CARD
========================================================= */

function MetricCard({
  label,

  value,

  sub,

  icon: Icon,

  tone = 'neutral',
}: {
  label: string;

  value: string;

  sub?: string;

  icon: LucideIcon;

  tone?:
    | 'green'
    | 'blue'
    | 'purple'
    | 'yellow'
    | 'red'
    | 'neutral';
}) {
  const tones = {
    green:
      'border-emerald-500/20 bg-emerald-500/[0.04]',

    blue:
      'border-sky-500/20 bg-sky-500/[0.04]',

    purple:
      'border-violet-500/20 bg-violet-500/[0.04]',

    yellow:
      'border-amber-500/20 bg-amber-500/[0.04]',

    red:
      'border-red-500/20 bg-red-500/[0.04]',

    neutral:
      'border-border bg-card',
  };

  const iconTones = {
    green:
      'bg-emerald-500/10 text-emerald-400',

    blue:
      'bg-sky-500/10 text-sky-400',

    purple:
      'bg-violet-500/10 text-violet-400',

    yellow:
      'bg-amber-500/10 text-amber-400',

    red:
      'bg-red-500/10 text-red-400',

    neutral:
      'bg-muted text-muted-foreground',
  };

  return (
    <div
      className={`rounded-xl border p-4 ${tones[tone]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </div>

        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconTones[tone]}`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-3 text-xl font-semibold tracking-tight tabular-nums">
        {value}
      </div>

      {sub && (
        <div className="mt-1 text-[11px] text-muted-foreground">
          {sub}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   SECTION
========================================================= */

function SectionCard({
  title,

  description,

  icon: Icon,

  actions,

  children,
}: {
  title: string;

  description?: string;

  icon?: LucideIcon;

  actions?: ReactNode;

  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          {Icon && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand/20 bg-brand/10 text-brand">
              <Icon className="h-4 w-4" />
            </div>
          )}

          <div>
            <h2 className="text-sm font-semibold">
              {title}
            </h2>

            {description && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {
                  description
                }
              </p>
            )}
          </div>
        </div>

        {actions}
      </div>

      <div className="p-4">
        {children}
      </div>
    </section>
  );
}

/* =========================================================
   FINANCIAL COMPARISON
========================================================= */

function FinancialComparison({
  revenue,

  cost,

  profit,
}: {
  revenue: number;

  cost: number;

  profit: number;
}) {
  const values = [
    {
      label:
        'Receita',

      value:
        Math.max(
          revenue,
          0,
        ),

      className:
        'bg-emerald-500',

      textClass:
        'text-emerald-400',
    },

    {
      label:
        'Custos',

      value:
        Math.max(
          cost,
          0,
        ),

      className:
        'bg-red-500',

      textClass:
        'text-red-400',
    },

    {
      label:
        'Lucro',

      value:
        Math.max(
          profit,
          0,
        ),

      className:
        'bg-sky-500',

      textClass:
        'text-sky-400',
    },
  ];

  const maxValue =
    Math.max(
      ...values.map(
        (item) =>
          item.value,
      ),

      1,
    );

  return (
    <div className="flex min-h-[230px] flex-col justify-center space-y-6">
      {values.map(
        (item) => {
          const width =
            (item.value /
              maxValue) *
            100;

          return (
            <div
              key={
                item.label
              }
              className="space-y-2"
            >
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="font-medium">
                  {
                    item.label
                  }
                </span>

                <span
                  className={`font-semibold tabular-nums ${item.textClass}`}
                >
                  {fmtBrl(
                    item.value,
                  )}
                </span>
              </div>

              <div className="h-8 overflow-hidden rounded-lg border border-border bg-muted/30">
                <div
                  className={`h-full rounded-md transition-all duration-500 ${item.className}`}
                  style={{
                    width: `${Math.max(
                      width,

                      item.value >
                        0
                        ? 1
                        : 0,
                    )}%`,

                    opacity:
                      0.8,
                  }}
                />
              </div>
            </div>
          );
        },
      )}

      {profit < 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />

          O período
          apresenta prejuízo
          de{' '}
          {fmtBrl(
            Math.abs(
              profit,
            ),
          )}
          .
        </div>
      )}
    </div>
  );
}

/* =========================================================
   INFO ROW
========================================================= */

function InfoRow({
  label,

  value,

  strong = false,
}: {
  label: string;

  value: string;

  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">
        {label}
      </span>

      <span
        className={`text-right tabular-nums ${
          strong
            ? 'font-semibold text-foreground'
            : 'font-medium'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

/* =========================================================
   AVATAR
========================================================= */

function Avatar({
  email,
}: {
  email: string;
}) {
  const localPart =
    email
      ?.split('@')
      ?.[0] ?? '';

  const initials =
    localPart
      .split(
        /[._-]/,
      )
      .filter(Boolean)
      .slice(0, 2)
      .map((part) =>
        part
          .charAt(0)
          .toUpperCase(),
      )
      .join('');

  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand/20 bg-brand/10 text-[11px] font-semibold text-brand">
      {initials ||
        'U'}
    </div>
  );
}

/* =========================================================
   PLANO
========================================================= */

function PlanBadge({
  plan,
}: {
  plan: string;
}) {
  return (
    <span className="inline-flex rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium">
      {plan || '—'}
    </span>
  );
}

/* =========================================================
   MARGEM
========================================================= */

function MarginBadge({
  margin,
}: {
  margin: number;
}) {
  let classes =
    'border-red-500/20 bg-red-500/10 text-red-400';

  if (
    margin >= 70
  ) {
    classes =
      'border-emerald-500/20 bg-emerald-500/10 text-emerald-400';
  } else if (
    margin >= 40
  ) {
    classes =
      'border-sky-500/20 bg-sky-500/10 text-sky-400';
  } else if (
    margin >= 20
  ) {
    classes =
      'border-amber-500/20 bg-amber-500/10 text-amber-400';
  }

  return (
    <span
      className={`inline-flex min-w-[64px] justify-center rounded-full border px-2 py-1 text-[11px] font-semibold tabular-nums ${classes}`}
    >
      {fmtPercent(
        margin,
      )}
    </span>
  );
}

/* =========================================================
   SKELETON
========================================================= */

function HeaderSkeleton() {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <div className="h-3 w-28 animate-pulse rounded bg-muted" />

        <div className="h-7 w-64 animate-pulse rounded bg-muted" />

        <div className="h-3 w-96 max-w-full animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}