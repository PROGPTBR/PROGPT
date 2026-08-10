'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { isValidCpf, formatCpf } from '@/lib/validators/cpf';
import type { Subscription } from '@/lib/billing/subscription';

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
  plans: Plan[];
  userPlanSlug: string;
  profile: {
    full_name?: string | null;
    cpf_cnpj?: string | null;
    phone?: string | null;
    professional_requirement?: string | null;
  } | null;
  subscription: Subscription | null;
};

function fmtPrice(value: number) {
  return `R$ ${Number(value).toFixed(2).replace('.', ',')}`;
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

function formatFeature(raw: string): string {
  if (raw.includes(' ')) return raw;

  return raw
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w, i) => {
      const lw = w.toLowerCase();

      if (FEATURE_ACRONYMS.has(lw)) {
        return w.toUpperCase();
      }

      if (i === 0) {
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
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
  const numbers = value.replace(/\D/g, '').slice(0, 11);

  if (numbers.length <= 2) return numbers;

  if (numbers.length <= 7) {
    return numbers.replace(/^(\d{2})(\d+)/, '($1) $2');
  }

  return numbers.replace(
    /^(\d{2})(\d{5})(\d{0,4}).*/,
    '($1) $2-$3',
  );
}

export function AccountPricingTable({
  plans,
  userPlanSlug,
  profile,
  subscription,
}: Props) {
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  const profileComplete =
    !!profile?.full_name &&
    !!profile?.cpf_cnpj &&
    !!profile?.phone &&
    !!profile?.professional_requirement;

  async function handleDirectCheckout(plan: Plan) {
    try {
      const res = await fetch(`/api/billing/checkout?plan=${plan.slug}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: profile?.full_name,
          cpf: profile?.cpf_cnpj,
          phone: profile?.phone,
          professionalRequirement: profile?.professional_requirement,
        }),
      });

      const body = await res.json();

      if (!res.ok) {
        if (body.error === 'already_subscribed') {
          toast.info('Você já tem uma assinatura ativa.');
          return;
        }

        console.error(body);
        toast.error('Não foi possível iniciar o pagamento.');
        return;
      }

      if (!body.checkoutUrl) {
        toast.error('O checkout não foi gerado. Tente novamente.');
        return;
      }

      // Usuário já possui conta.
      // Vai diretamente para o checkout hospedado do Asaas.
      window.location.href = body.checkoutUrl;
    } catch (err) {
      console.error(err);
      toast.error('Erro de rede. Tente novamente.');
    }
  }

  const orderedPlans = [...plans].sort((a, b) => {
    const order: Record<string, number> = {
      free: 1,
      'pf-99': 2,
      'pj-consulte': 3,
    };

    return (order[a.slug] || 99) - (order[b.slug] || 99);
  });

  return (
    <div className="space-y-10">
      <div className="text-center space-y-2">
  <div className="text-xs uppercase tracking-[0.2em] font-semibold text-brand">
    Planos
  </div>

  <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
    Escolha seu plano<span className="text-brand">.</span>
  </h1>

  <p className="text-sm text-muted-foreground max-w-2xl mx-auto mb-6">
    Compare os planos disponíveis e escolha a opção que melhor atende às
    suas necessidades.
  </p>
</div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start max-w-5xl mx-auto">
        {orderedPlans.map((plan) => {
          const isRecommended = plan.slug === 'pf-99';
          const isCurrent = userPlanSlug === plan.slug;

          return (
            <div
              key={plan.id}
              className={`group relative rounded-3xl p-7 flex flex-col transition-all duration-300 ${
                isRecommended
                  ? 'border-2 border-brand bg-card shadow-[0_24px_60px_-22px_rgba(14,141,225,0.5)] md:-translate-y-3 hover:-translate-y-4'
                  : 'border border-border bg-card hover:-translate-y-1 hover:border-brand/40 hover:shadow-xl'
              }`}
            >
              {isRecommended && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-brand-gradient text-black text-[11px] uppercase tracking-wider font-bold px-4 py-1 rounded-full brand-glow whitespace-nowrap">
                  Mais popular
                </div>
              )}

              {isCurrent && (
                <div className="absolute -top-3.5 right-5 bg-background border border-brand/40 text-brand text-[10px] uppercase tracking-wider font-semibold px-3 py-1 rounded-full">
                  Seu plano
                </div>
              )}

              <div className="space-y-1.5">
                <div
                  className={`text-xs uppercase tracking-wider font-semibold ${
                    isRecommended
                      ? 'text-brand'
                      : 'text-muted-foreground'
                  }`}
                >
                  {plan.name}
                </div>

                <div className="flex items-baseline gap-1.5 pt-1">
                  <span className="text-foreground text-4xl font-bold tracking-tight">
                    {plan.slug === 'pj-consulte'
                      ? 'Sob consulta'
                      : fmtPrice(plan.price)}
                  </span>

                  {plan.price > 0 && (
                    <span className="text-sm text-muted-foreground">
                      /{plan.interval}
                    </span>
                  )}
                </div>

                <p className="text-sm text-muted-foreground pt-1">
                  {plan.description}
                </p>
              </div>

              <ul className="space-y-2.5 pt-6 flex-1">
                {plan.features?.map((feature: string) => (
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
                      {formatFeature(feature)}
                    </span>
                  </li>
                ))}
              </ul>

              {plan.slug === 'pj-consulte' && (
                <p className="pt-4 text-xs leading-relaxed text-muted-foreground/90 italic">
                  Neste plano, a IA deixa de ser uma ferramenta genérica e
                  passa a atuar como uma solução corporativa, conectada aos
                  processos, regras, documentos e desafios reais da empresa.
                </p>
              )}

              <div className="pt-7">
                {isCurrent ? (
                  <div className="text-center text-sm text-emerald-600 dark:text-emerald-400 font-medium py-2">
                    ✓ Você já está neste plano
                  </div>
                ) : plan.slug === 'free' ? (
                  <div className="text-center text-sm text-muted-foreground py-2">
                    Plano gratuito
                  </div>
                ) : plan.slug === 'pj-consulte' ? (
                  <a
                    href="mailto:comercial@2bsupply.com.br?subject=Solicita%C3%A7%C3%A3o%20de%20proposta%20%E2%80%94%20Plano%20Empresas%20PROGPT&body=Ol%C3%A1%2C%20gostaria%20de%20solicitar%20uma%20proposta%20do%20Plano%20Empresas%20do%20PROGPT."
                    className="inline-flex w-full items-center justify-center gap-2 bg-muted border border-border text-foreground py-2.5 rounded-full text-sm font-medium hover:bg-brand hover:text-black hover:border-brand active:scale-95 transition-all duration-300"
                  >
                    Solicitar proposta
                    <ArrowRight
                      className="h-3.5 w-3.5"
                      aria-hidden="true"
                    />
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPlan(plan);

                      if (profileComplete) {
                        handleDirectCheckout(plan);
                      } else {
                        setShowCheckout(true);
                      }
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-gradient text-black hover:brightness-110 brand-glow h-11 text-sm font-semibold transition-all active:scale-[0.98]"
                  >
                    Ir para pagamento
                    <ArrowRight
                      className="h-3.5 w-3.5"
                      aria-hidden="true"
                    />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showCheckout && selectedPlan && (
        <CheckoutForm
          plan={selectedPlan}
          profile={profile}
          onClose={() => setShowCheckout(false)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// CheckoutForm
// ─────────────────────────────────────────────

function CheckoutForm({
  onClose,
  plan,
  profile,
}: {
  onClose: () => void;
  plan: Plan;
  profile: Props['profile'];
}) {
  const [name, setName] = useState(profile?.full_name ?? '');
  const [cpfInput, setCpfInput] = useState(
    profile?.cpf_cnpj ? maskCPF(profile.cpf_cnpj) : '',
  );
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [professionalRequirement, setProfessionalRequirement] = useState(
    profile?.professional_requirement ?? '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cpfClean = formatCpf(cpfInput);
  const cpfOk = isValidCpf(cpfClean);
  const nameOk = name.trim().length >= 2;
  const canSubmit = cpfOk && nameOk && !busy;

  const INPUT =
    'w-full rounded-lg bg-muted/40 border border-input px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-colors';

  const LABEL =
    'block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!canSubmit) return;

    setBusy(true);
    setError(null);

    try {
      const res = await fetch(`/api/billing/checkout?plan=${plan.slug}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          cpf: cpfClean,
          phone: phone.replace(/\D/g, ''),
          professionalRequirement,
        }),
      });

      const body = await res.json();

      if (!res.ok) {
        if (body.error === 'already_subscribed') {
          toast.info('Você já tem uma assinatura ativa.');
          onClose();
          return;
        }

        console.error(body);
        setError(`Erro: ${body.error}`);
        setBusy(false);
        return;
      }

      if (!body.checkoutUrl) {
        setError('O checkout não foi gerado. Tente novamente.');
        setBusy(false);
        return;
      }

      window.location.href = body.checkoutUrl;
    } catch (err) {
      console.error(err);
      setError('Erro de rede. Tente novamente.');
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <div className="text-xs uppercase tracking-wider font-semibold text-brand">
            Pagamento
          </div>

          <h2 className="text-xl font-semibold text-foreground mt-1">
            {plan.name}
          </h2>

          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Você já possui uma conta. Vamos direcioná-lo diretamente para o
            Asaas para concluir o pagamento.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="account-checkout-name" className={LABEL}>
              Nome completo
            </label>

            <input
              id="account-checkout-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className={INPUT}
            />
          </div>

          <div>
            <label htmlFor="account-checkout-cpf" className={LABEL}>
              CPF
            </label>

            <input
              id="account-checkout-cpf"
              type="text"
              required
              value={cpfInput}
              onChange={(e) =>
                setCpfInput(maskCPF(e.target.value))
              }
              inputMode="numeric"
              autoComplete="off"
              className={INPUT}
            />

            {cpfInput.length > 0 && !cpfOk && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                CPF inválido — verifique os dígitos.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="account-checkout-phone" className={LABEL}>
              Telefone
            </label>

            <input
              id="account-checkout-phone"
              type="tel"
              value={phone}
              onChange={(e) =>
                setPhone(maskPhone(e.target.value))
              }
              className={INPUT}
            />
          </div>

          <div>
            <label htmlFor="account-checkout-req" className={LABEL}>
              Exigência profissional
            </label>

            <input
              id="account-checkout-req"
              type="text"
              value={professionalRequirement}
              onChange={(e) =>
                setProfessionalRequirement(e.target.value)
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
              disabled={!canSubmit}
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
                  Ir para pagamento
                  <ArrowRight
                    className="h-3.5 w-3.5"
                    aria-hidden="true"
                  />
                </>
              )}
            </button>
          </div>

          <p className="text-[10px] text-muted-foreground text-center pt-2 border-t border-border">
            Você será redirecionado ao Asaas para concluir o pagamento com
            segurança.
          </p>
        </form>
      </div>
    </div>
  );
}