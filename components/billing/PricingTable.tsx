'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { isValidCpf, formatCpf } from '@/lib/validators/cpf';

// Sub-projeto 27 — Pricing page principal component.
//
// 3 colunas (Free · Pessoa Física · Pessoa Jurídica). O card recomendado
// (pf-99) é elevado com glow da marca. CTA do Pro abre <CheckoutForm> inline
// pra coletar Nome + CPF (Asaas exige cpfCnpj). Submit chama
// /api/billing/checkout e redireciona pro hosted checkout do Asaas.

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
  profile: {
    full_name?: string | null;
    cpf_cnpj?: string | null;
    phone?: string | null;
    professional_requirement?: string | null;
  } | null;
};

function fmtPrice(value: number) {
  return `R$ ${Number(value).toFixed(2).replace('.', ',')}`;
}

// Siglas em CAIXA ALTA; o resto em escrita normal (1ª maiúscula).
// Ex.: "chat_ilimitado" → "Chat ilimitado", "rfp" → "RFP", "export_pdf" → "Export PDF".
const FEATURE_ACRONYMS = new Set([
  'rfp', 'abc', 'csv', 'pdf', 'docx', 'xlsx', 'cnpj', 'cnae',
  'swot', 'zopa', 'roe', 'dre', 'smart', 'ia', 'b2b', 'b2c', 'kpi',
]);

function formatFeature(raw: string): string {
  return raw
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w, i) => {
      const lw = w.toLowerCase();
      if (FEATURE_ACRONYMS.has(lw)) return w.toUpperCase();
      if (i === 0) return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
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
  if (numbers.length <= 7) return numbers.replace(/^(\d{2})(\d+)/, '($1) $2');
  return numbers.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, '($1) $2-$3');
}

export function PricingTable({
  authed,
  isPro,
  plans,
  userPlanSlug,
  profile,
}: Props) {
  const router = useRouter();

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profile!.full_name,
          cpf: profile!.cpf_cnpj,
          phone: profile!.phone,
          professionalRequirement: profile!.professional_requirement,
        }),
      });

      const body = await res.json();

      if (!res.ok) {
        if (body.error === 'already_subscribed') {
          toast.info('Você já tem uma assinatura ativa.');
          router.push('/account/billing');
          return;
        }
        console.error(body);
        return;
      }

      window.location.href = body.checkoutUrl;
    } catch (err) {
      console.error(err);
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
    <div className="space-y-12">
      {/* Cabeçalho chamativo */}
      <header className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/5 px-4 py-1.5 text-xs font-medium text-brand">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Planos PROGPT
        </div>
        <h2 className="text-4xl md:text-5xl font-semibold tracking-tight max-w-3xl mx-auto leading-[1.15]">
          <span className="text-foreground">Comece grátis,</span>{' '}
          <span className="text-brand-gradient">faça upgrade quando precisar.</span>
        </h2>
        <p className="text-base text-muted-foreground max-w-xl mx-auto">
          3 dias grátis pra testar tudo. Sem amarras — cancele quando quiser.
        </p>
      </header>

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

              <div className="space-y-1.5">
                <div
                  className={`text-xs uppercase tracking-wider font-semibold ${
                    isRecommended ? 'text-brand' : 'text-muted-foreground'
                  }`}
                >
                  {plan.name}
                </div>
                <div className="flex items-baseline gap-1.5 pt-1">
                  <span className="text-foreground text-4xl font-bold tracking-tight">
                    {plan.slug === 'pj-consulte' ? 'Sob consulta' : fmtPrice(plan.price)}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-sm text-muted-foreground">/{plan.interval}</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground pt-1">{plan.description}</p>
              </div>

              <ul className="space-y-2.5 pt-6 flex-1">
                {plan.features?.map((feature: string) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm">
                    <span
                      className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded-full flex-shrink-0 ${
                        isRecommended ? 'bg-brand text-black' : 'bg-brand/15 text-brand'
                      }`}
                    >
                      <Check className="h-3 w-3" aria-hidden="true" />
                    </span>
                    <span className="text-foreground/80">{formatFeature(feature)}</span>
                  </li>
                ))}
              </ul>

              <div className="pt-7">
                {isCurrent ? (
                  <div className="text-center text-sm text-emerald-600 dark:text-emerald-400 font-medium py-2">
                    ✓ Você já está neste plano
                  </div>
                ) : plan.slug === 'free' ? (
                  !authed && (
                    <Link
                      href="/signup?next=/pricing"
                      className="inline-flex w-full items-center justify-center gap-2 bg-muted border border-border text-foreground py-2.5 rounded-full text-sm font-medium hover:bg-accent active:scale-95 transition-all duration-300"
                    >
                      Criar conta grátis
                    </Link>
                  )
                ) : plan.slug === 'pj-consulte' ? (
                  <button
                    type="button"
                    className="inline-flex w-full items-center justify-center gap-2 bg-muted border border-border text-foreground py-2.5 rounded-full text-sm font-medium hover:bg-accent active:scale-95 transition-all duration-300"
                  >
                    Solicitar proposta
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                ) : !authed ? (
                  <Link
                    href="/signup?next=/pricing"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-gradient text-black hover:brightness-110 brand-glow h-11 text-sm font-semibold transition-all active:scale-[0.98]"
                  >
                    Começar 3 dias grátis
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
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
                    Começar 3 dias grátis
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

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

      {showCheckout && selectedPlan && (
        <CheckoutForm plan={selectedPlan} onClose={() => setShowCheckout(false)} />
      )}
    </div>
  );
}

// ─── CheckoutForm: modal Nome + CPF antes de redirecionar pro Asaas ───
function CheckoutForm({ onClose, plan }: { onClose: () => void; plan: Plan }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [cpfInput, setCpfInput] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [professionalRequirement, setProfessionalRequirement] = useState('');

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
        headers: { 'Content-Type': 'application/json' },
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
          router.push('/account/billing');
          return;
        }
        setError(`Erro: ${body.error}`);
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
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold text-foreground">
            {plan.name} <span className="text-brand">.</span>
          </h2>
          <p className="text-sm text-muted-foreground">
            Pra liberar seus 3 dias grátis, cadastramos seu cartão no Asaas (sem
            cobrança agora). Após o período, a assinatura é {fmtPrice(plan.price)}/{plan.interval}.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="checkout-name" className={LABEL}>
              Nome completo
            </label>
            <input
              id="checkout-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className={INPUT}
            />
          </div>

          <div>
            <label htmlFor="checkout-cpf" className={LABEL}>
              CPF
            </label>
            <input
              id="checkout-cpf"
              type="text"
              required
              value={cpfInput}
              onChange={(e) => setCpfInput(maskCPF(e.target.value))}
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
            <label htmlFor="checkout-phone" className={LABEL}>
              Telefone
            </label>
            <input
              id="checkout-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(maskPhone(e.target.value))}
              className={INPUT}
            />
          </div>

          <div>
            <label htmlFor="checkout-req" className={LABEL}>
              Exigência profissional
            </label>
            <input
              id="checkout-req"
              type="text"
              value={professionalRequirement}
              onChange={(e) => setProfessionalRequirement(e.target.value)}
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
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  carregando…
                </>
              ) : (
                <>
                  Continuar <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </>
              )}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center pt-2 border-t border-border">
            Você será redirecionado pro Asaas pra concluir o cadastro com segurança.
          </p>
        </form>
      </div>
    </div>
  );
}
