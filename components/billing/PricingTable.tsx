'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { isValidCpf, formatCpf } from '@/lib/validators/cpf';

type Plan = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: string;
  features: string[];
};

type Props = {
  authed: boolean;
  isPro: boolean;
  plans: Plan[];
  userPlanSlug: string | null;
  trialExpired?: boolean;
  hideHeader?: boolean;
  profile: {
    full_name?: string | null;
    cpf_cnpj?: string | null;
    phone?: string | null;
    professional_requirement?: string | null;
  } | null;
};

const BUYER_PLAN_SLUG = 'pf-73';

function fmtPrice(value: number) {
  return `R$ ${Number(value).toFixed(2).replace('.', ',')}`;
}

function isBuyerPlan(plan: Plan) {
  const normalizedName = plan.name
    ?.trim()
    .toLowerCase();

  return (
    plan.slug === BUYER_PLAN_SLUG ||
    normalizedName === 'plano comprador estratégico'
  );
}

function getCheckoutSlug(plan: Plan) {
  return isBuyerPlan(plan)
    ? BUYER_PLAN_SLUG
    : plan.slug;
}

const FEATURE_ACRONYMS = new Set([
  'rfp',
  'abc',
  'csv',
  'pdf',
  'docx',
  'xlsx',
  'cnpj',
  'cnae',
  'swot',
  'zopa',
  'roe',
  'dre',
  'smart',
  'ia',
  'b2b',
  'b2c',
  'kpi',
]);

const PROGPT_TRIAL_FEATURES = [
  'Assistentes prontos para diferentes processos de Suprimentos',
  'Criação de RFI, RFQ e RFP em poucos minutos',
  'Busca e homologação de fornecedores',
  'Análise e comparação de propostas comerciais',
  'Leitura de contratos, riscos, obrigações e prazos',
  'Dashboards personalizados para acompanhamento dos processos',
  'Análise de PDFs, planilhas, tabelas, imagens e gráficos',
  'Comandos por texto ou áudio, com histórico salvo',
];

const PROGPT_ENTERPRISE_FEATURES = [
  'Todos os recursos do Plano Comprador Estratégico',
  'Integração via API com ERP e sistemas internos',
  'Conexão com os dados e processos da empresa',
  'Ambiente corporativo preparado para dados sensíveis',
  'Controle de usuários, acessos e permissões',
  'Base de conhecimento exclusiva da empresa',
  'Assistentes personalizados por área, processo ou necessidade',
  'Dashboards e indicadores adaptados à operação',
  'Governança e utilização alinhadas às políticas de TI e compliance',
  'Implantação e suporte técnico especializado',
];

function formatFeature(raw: string): string {
  if (raw.includes(' ')) {
    return raw;
  }

  return raw
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w, i) => {
      const lw = w.toLowerCase();

      if (FEATURE_ACRONYMS.has(lw)) {
        return w.toUpperCase();
      }

      if (i === 0) {
        return (
          w.charAt(0).toUpperCase() +
          w.slice(1).toLowerCase()
        );
      }

      return w.toLowerCase();
    })
    .join(' ');
}

function maskCPF(value: string) {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    .slice(0, 14);
}

function maskPhone(value: string) {
  const numbers = value
    .replace(/\D/g, '')
    .slice(0, 11);

  if (numbers.length <= 2) {
    return numbers;
  }

  if (numbers.length <= 7) {
    return numbers.replace(
      /^(\d{2})(\d+)/,
      '($1) $2',
    );
  }

  return numbers.replace(
    /^(\d{2})(\d{5})(\d{0,4}).*/,
    '($1) $2-$3',
  );
}

export function PricingTable({
  authed,
  isPro,
  plans,
  userPlanSlug,
  profile,
  trialExpired = false,
  hideHeader = false,
}: Props) {
  const expired = trialExpired;

  const router = useRouter();

  const [showCheckout, setShowCheckout] =
    useState(false);

  const [selectedPlan, setSelectedPlan] =
    useState<Plan | null>(null);

  const profileComplete =
    !!profile?.full_name &&
    !!profile?.cpf_cnpj &&
    !!profile?.phone &&
    !!profile?.professional_requirement;

  async function handleDirectCheckout(
    plan: Plan,
  ) {
    try {
      const checkoutSlug =
        getCheckoutSlug(plan);

      const res = await fetch(
        `/api/billing/checkout?plan=${encodeURIComponent(
          checkoutSlug,
        )}`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            name: profile!.full_name,
            cpf: profile!.cpf_cnpj,
            phone: profile!.phone,
            professionalRequirement:
              profile!
                .professional_requirement,
          }),
        },
      );

      const body = await res.json();

      if (!res.ok) {
        if (
          body.error ===
          'already_subscribed'
        ) {
          toast.info(
            'Você já tem uma assinatura ativa.',
          );

          router.push(
            '/account/billing',
          );

          return;
        }

        console.error(
          '[checkout]',
          body,
        );

        toast.error(
          body?.error
            ? `Não foi possível iniciar o checkout: ${body.error}`
            : 'Não foi possível iniciar o checkout.',
        );

        return;
      }

      if (!body.checkoutUrl) {
        console.error(
          '[checkout] checkoutUrl não retornada:',
          body,
        );

        toast.error(
          'O checkout não retornou uma URL válida.',
        );

        return;
      }

      window.location.href =
        body.checkoutUrl;
    } catch (err) {
      console.error(err);

      toast.error(
        'Erro ao iniciar o checkout.',
      );
    }
  }

  const orderedPlans = [...plans].sort(
    (a, b) => {
      function getOrder(plan: Plan) {
        if (plan.slug === 'free') {
          return 1;
        }

        if (isBuyerPlan(plan)) {
          return 2;
        }

        if (
          plan.slug ===
          'pj-consulte'
        ) {
          return 3;
        }

        return 99;
      }

      return (
        getOrder(a) -
        getOrder(b)
      );
    },
  );

  return (
    <div className="space-y-12">

      {/* ========================================================
          CABEÇALHO
      ======================================================== */}

      {!hideHeader && (
        <header className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/5 px-4 py-1.5 text-xs font-medium text-brand">
            <Sparkles
              className="h-3.5 w-3.5"
              aria-hidden="true"
            />

            Planos PROGPT
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight max-w-3xl mx-auto leading-[1.15]">
            {expired ? (
              <>
                <span className="text-foreground">
                  Continue usando o
                  PROGPT
                </span>{' '}

                <span className="text-brand-gradient">
                  sem interrupções.
                </span>
              </>
            ) : (
              <>
                <span className="text-foreground">
                  Comece grátis,
                </span>{' '}

                <span className="text-brand-gradient">
                  faça upgrade quando
                  precisar.
                </span>
              </>
            )}
          </h2>
        </header>
      )}

      {/* ========================================================
          CARDS
      ======================================================== */}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start max-w-5xl mx-auto">
        {orderedPlans.map((plan) => {
          const buyerPlan =
            isBuyerPlan(plan);

          const enterprisePlan =
            plan.slug ===
            'pj-consulte';

          const freePlan =
            plan.slug === 'free';

          const currentPlanSlug =
            buyerPlan
              ? BUYER_PLAN_SLUG
              : plan.slug;

          const isCurrent =
            userPlanSlug ===
            currentPlanSlug;

          const isRecommended =
            buyerPlan;

          return (
            <div
              key={plan.id}
              className={`group relative rounded-3xl ${
                buyerPlan ||
                enterprisePlan
                  ? 'px-7 py-10'
                  : 'p-7'
              } flex flex-col transition-all duration-300 ${
                isRecommended
                  ? 'border-2 border-brand bg-card shadow-[0_24px_60px_-22px_rgba(14,141,225,0.5)] hover:-translate-y-4'
                  : 'border border-border bg-card hover:-translate-y-1 hover:border-brand/40 hover:shadow-xl'
              }`}
            >

              {/* ==================================================
                  PLANO COMPRADOR ESTRATÉGICO
              ================================================== */}

              {buyerPlan && (
                <div className="space-y-1.5">
                  <div className="text-xs uppercase tracking-wider font-semibold text-brand">
                    {plan.name ||
                      'Plano Comprador Estratégico'}
                  </div>

                  <div className="flex items-baseline gap-1.5 pt-1">
                    <span className="text-foreground text-4xl font-bold tracking-tight">
                      {expired
                        ? 'Continue com todos os recursos'
                        : 'Comece grátis por 3 dias'}
                    </span>
                  </div>

                  <p className="pt-1 text-[16px] text-muted-foreground">
                    {expired
                      ? 'Seu período gratuito terminou. Assine para continuar usando seus assistentes, histórico e ferramentas de Suprimentos.'
                      : 'Menos tarefas manuais. Mais tempo para negociar e decidir.'}
                  </p>
                </div>
              )}

              {/* ==================================================
                  PLANO EMPRESAS
              ================================================== */}

              {enterprisePlan && (
                <div className="space-y-1.5">
                  <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                    {plan.name}
                  </div>

                  <div className="flex items-baseline gap-1.5 pt-1">
                    <span className="text-foreground text-4xl font-bold tracking-tight">
                      Sob consulta
                    </span>
                  </div>

                  <p className="text-sm text-muted-foreground pt-1">
                    Uma IA conectada ao
                    seu ERP e protegida
                    pelas regras da sua
                    empresa
                  </p>

                  <p className="text-sm text-muted-foreground pt-2">
                    A PROGPT se adapta
                    aos seus sistemas,
                    processos e
                    políticas. Sua
                    empresa não precisa
                    se adaptar à IA.
                  </p>
                </div>
              )}

              {/* ==================================================
                  PLANO GENÉRICO / FREE
              ================================================== */}

              {!buyerPlan &&
                !enterprisePlan && (
                  <div className="space-y-1.5">
                    <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                      {plan.name}
                    </div>

                    {plan.price > 0 && (
                      <div className="flex items-baseline gap-1.5 pt-1">
                        <span className="text-foreground text-4xl font-bold tracking-tight">
                          {fmtPrice(
                            plan.price,
                          )}
                        </span>

                        <span className="text-sm text-muted-foreground">
                          /{plan.interval}
                        </span>
                      </div>
                    )}

                    {plan.description && (
                      <p className="text-sm text-muted-foreground pt-1">
                        {
                          plan.description
                        }
                      </p>
                    )}
                  </div>
                )}

              {/* ==================================================
                  SUBTÍTULO COMPRADOR
              ================================================== */}

              {buyerPlan && (
                <p className="pt-6 text-base font-semibold text-foreground">
                  Chat especializado e
                  ilimitado
                </p>
              )}

              {/* ==================================================
                  RECURSOS
              ================================================== */}

              <ul
                className={`space-y-2.5 flex-1 ${
                  buyerPlan
                    ? 'pt-3'
                    : 'pt-6'
                }`}
              >
                {(
                  buyerPlan
                    ? PROGPT_TRIAL_FEATURES
                    : enterprisePlan
                      ? PROGPT_ENTERPRISE_FEATURES
                      : plan.features
                )?.map(
                  (
                    feature: string,
                  ) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2.5 text-sm"
                    >
                      <span
                        className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded-full flex-shrink-0 ${
                          isRecommended
                            ? 'bg-brand text-black'
                            : 'bg-brand/15 text-brand'
                        }`}
                      >
                        <Check
                          className="h-3 w-3"
                          aria-hidden="true"
                        />
                      </span>

                      <span className="text-foreground/80">
                        {formatFeature(
                          feature,
                        )}
                      </span>
                    </li>
                  ),
                )}
              </ul>

              {/* ==================================================
                  TEXTO EMPRESARIAL
              ================================================== */}

              {enterprisePlan && (
                <p className="pt-4 text-[0.875rem] leading-relaxed text-muted-foreground/90 italic">
                  Mais do que contratar
                  uma IA, sua empresa
                  passa a contar com uma
                  solução integrada ao
                  ERP, ajustada aos seus
                  processos e preparada
                  para proteger as
                  informações
                  estratégicas da
                  operação.
                </p>
              )}

              {/* ==================================================
                  CTA
              ================================================== */}

              <div className="pt-7">
                {isCurrent ? (
                  expired ? (
                    <div className="text-center text-sm text-red-500 font-medium py-2">
                      Seu período
                      gratuito expirou.
                      Escolha um plano
                      para continuar.
                    </div>
                  ) : (
                    <div className="text-center text-sm text-emerald-600 dark:text-emerald-400 font-medium py-2">
                      ✓ Você já está
                      neste plano
                    </div>
                  )
                ) : freePlan ? (
                  !authed && (
                    <Link
                      href="/signup?next=/planos"
                      className="inline-flex w-full items-center justify-center gap-2 bg-muted border border-border text-foreground py-2.5 rounded-full text-sm font-medium hover:bg-accent active:scale-95 transition-all duration-300"
                    >
                      Criar conta grátis
                    </Link>
                  )
                ) : enterprisePlan ? (
                  <>
                    <a
                      href="mailto:comercial@2bsupply.com.br?subject=Solicita%C3%A7%C3%A3o%20de%20proposta%20%E2%80%94%20Plano%20Empresas%20PROGPT&body=Ol%C3%A1%2C%20gostaria%20de%20solicitar%20uma%20proposta%20do%20Plano%20Empresas%20do%20PROGPT."
                      className="inline-flex w-full items-center justify-center gap-2 bg-muted border border-border text-foreground py-2.5 rounded-full text-sm font-medium hover:bg-brand hover:text-black hover:border-brand active:scale-95 transition-all duration-300"
                    >
                      AGENDAR DEMONSTRAÇÃO
                      EMPRESARIAL

                      <ArrowRight
                        className="h-3.5 w-3.5"
                        aria-hidden="true"
                      />
                    </a>

                    <p className="pt-3 text-center text-sm text-muted-foreground">
                      Investimento sob
                      consulta
                    </p>
                  </>
                ) : !authed ? (
                  <Link
                    href="/signup?next=/planos"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-gradient text-black hover:brightness-110 brand-glow h-11 text-sm font-semibold transition-all active:scale-[0.98]"
                  >
                    COMEÇAR MEU TESTE
                    GRÁTIS

                    <ArrowRight
                      className="h-3.5 w-3.5"
                      aria-hidden="true"
                    />
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (expired) {
                        const checkoutSlug =
                          getCheckoutSlug(
                            plan,
                          );

                        router.push(
                          `/account/billing/checkout?plan=${encodeURIComponent(
                            checkoutSlug,
                          )}`,
                        );

                        return;
                      }

                      setSelectedPlan(
                        plan,
                      );

                      if (
                        profileComplete
                      ) {
                        handleDirectCheckout(
                          plan,
                        );
                      } else {
                        setShowCheckout(
                          true,
                        );
                      }
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-gradient text-black hover:brightness-110 brand-glow h-11 text-sm font-semibold transition-all active:scale-[0.98]"
                  >
                    {expired
                      ? 'ASSINAR PLANO'
                      : 'COMEÇAR MEU TESTE GRÁTIS'}

                    <ArrowRight
                      className="h-3.5 w-3.5"
                      aria-hidden="true"
                    />
                  </button>
                )}

                {/* ==================================================
                    PREÇO
                ================================================== */}

                {buyerPlan && (
                  <div className="flex items-baseline justify-center gap-1.5 pt-5">
                    <span className="text-sm text-muted-foreground">
                      {expired
                        ? 'Continue por'
                        : 'Depois, continue por apenas'}
                    </span>

                    <span className="text-foreground text-2xl font-bold tracking-tight">
                      {fmtPrice(
                        plan.price,
                      )}
                    </span>

                    {plan.price >
                      0 && (
                      <span className="text-sm text-muted-foreground">
                        /
                        {
                          plan.interval
                        }
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ========================================================
          GERENCIAR ASSINATURA
      ======================================================== */}

      {isPro && (
        <div className="text-center text-sm">
          <Link
            href="/account/billing"
            className="text-brand hover:text-brand/80 transition-colors"
          >
            Gerenciar assinatura →
          </Link>
        </div>
      )}

      {/* ========================================================
          CHECKOUT MODAL ANTIGO
      ======================================================== */}

      {showCheckout &&
        selectedPlan && (
          <CheckoutForm
            plan={selectedPlan}
            expired={expired}
            onClose={() =>
              setShowCheckout(false)
            }
          />
        )}
    </div>
  );
}

// ============================================================
// CHECKOUT FORM
// ============================================================

function CheckoutForm({
  onClose,
  plan,
  expired,
}: {
  onClose: () => void;
  plan: Plan;
  expired: boolean;
}) {
  const router = useRouter();

  const [name, setName] =
    useState('');

  const [cpfInput, setCpfInput] =
    useState('');

  const [phone, setPhone] =
    useState('');

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [
    professionalRequirement,
    setProfessionalRequirement,
  ] = useState('');

  const cpfClean =
    formatCpf(cpfInput);

  const cpfOk =
    isValidCpf(cpfClean);

  const nameOk =
    name.trim().length >= 2;

  const canSubmit =
    cpfOk &&
    nameOk &&
    !busy;

  const INPUT =
    'w-full rounded-lg bg-muted/40 border border-input px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-colors';

  const LABEL =
    'block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5';

  async function handleSubmit(
    e: React.FormEvent,
  ) {
    e.preventDefault();

    if (!canSubmit) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const checkoutSlug =
        getCheckoutSlug(plan);

      const res = await fetch(
        `/api/billing/checkout?plan=${encodeURIComponent(
          checkoutSlug,
        )}`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            name: name.trim(),
            cpf: cpfClean,
            phone: phone.replace(
              /\D/g,
              '',
            ),
            professionalRequirement,
          }),
        },
      );

      const body =
        await res.json();

      if (!res.ok) {
        if (
          body.error ===
          'already_subscribed'
        ) {
          toast.info(
            'Você já tem uma assinatura ativa.',
          );

          router.push(
            '/account/billing',
          );

          return;
        }

        setError(
          body?.error
            ? `Erro: ${body.error}`
            : 'Não foi possível iniciar o checkout.',
        );

        setBusy(false);

        return;
      }

      if (!body.checkoutUrl) {
        setError(
          'O checkout não retornou uma URL válida.',
        );

        setBusy(false);

        return;
      }

      window.location.href =
        body.checkoutUrl;
    } catch (err) {
      console.error(err);

      setError(
        'Erro de rede. Tente novamente.',
      );

      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-5 shadow-2xl"
        onClick={(e) =>
          e.stopPropagation()
        }
      >
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold text-foreground">
            {plan.name}{' '}
            <span className="text-brand">
              .
            </span>
          </h2>

          <p className="text-sm text-muted-foreground">
            {expired ? (
              <>
                Complete seus dados
                para continuar usando
                o PROGPT. A assinatura
                é{' '}
                {fmtPrice(
                  plan.price,
                )}
                /{plan.interval}.
              </>
            ) : (
              <>
                Pra liberar seus 3
                dias grátis,
                cadastramos seu
                cartão no Asaas (sem
                cobrança agora). Após
                o período, a
                assinatura é{' '}
                {fmtPrice(
                  plan.price,
                )}
                /{plan.interval}.
              </>
            )}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <div>
            <label
              htmlFor="checkout-name"
              className={LABEL}
            >
              Nome completo
            </label>

            <input
              id="checkout-name"
              type="text"
              required
              value={name}
              onChange={(e) =>
                setName(
                  e.target.value,
                )
              }
              autoComplete="name"
              className={INPUT}
            />
          </div>

          <div>
            <label
              htmlFor="checkout-cpf"
              className={LABEL}
            >
              CPF
            </label>

            <input
              id="checkout-cpf"
              type="text"
              required
              value={cpfInput}
              onChange={(e) =>
                setCpfInput(
                  maskCPF(
                    e.target
                      .value,
                  ),
                )
              }
              inputMode="numeric"
              autoComplete="off"
              className={INPUT}
            />

            {cpfInput.length >
              0 &&
              !cpfOk && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  CPF inválido —
                  verifique os
                  dígitos.
                </p>
              )}
          </div>

          <div>
            <label
              htmlFor="checkout-phone"
              className={LABEL}
            >
              Telefone
            </label>

            <input
              id="checkout-phone"
              type="tel"
              value={phone}
              onChange={(e) =>
                setPhone(
                  maskPhone(
                    e.target
                      .value,
                  ),
                )
              }
              className={INPUT}
            />
          </div>

          <div>
            <label
              htmlFor="checkout-req"
              className={LABEL}
            >
              Exigência profissional
            </label>

            <input
              id="checkout-req"
              type="text"
              value={
                professionalRequirement
              }
              onChange={(e) =>
                setProfessionalRequirement(
                  e.target
                    .value,
                )
              }
              className={INPUT}
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="flex-1 rounded-full border border-border text-muted-foreground bg-background hover:bg-accent h-10 text-sm transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={
                !canSubmit
              }
              className="flex-1 rounded-full bg-brand-gradient text-black hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed h-10 text-sm font-semibold transition-all active:scale-95 inline-flex items-center justify-center gap-2"
            >
              {busy ? (
                <>
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />

                  carregando…
                </>
              ) : (
                <>
                  {expired
                    ? 'Assinar'
                    : 'Continuar'}

                  <ArrowRight
                    className="h-3.5 w-3.5"
                    aria-hidden="true"
                  />
                </>
              )}
            </button>
          </div>

          <p className="text-[10px] text-muted-foreground text-center pt-2 border-t border-border">
            Você será
            redirecionado pro Asaas
            pra concluir o cadastro
            com segurança.
          </p>
        </form>
      </div>
    </div>
  );
}