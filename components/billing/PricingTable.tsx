'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { isValidCpf, formatCpf } from '@/lib/validators/cpf';



// Sub-projeto 27 — Pricing page principal component.
//
// 2 colunas Free vs Pro. CTA do Pro abre <CheckoutForm> inline modal
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

function FeatureRow({ text, included }: { text: string; included: boolean }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {included ? (
        <Check className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" aria-hidden />
      ) : (
        <X className="h-4 w-4 text-muted-foreground/60 mt-0.5 flex-shrink-0" aria-hidden />
      )}
      <span className={included ? 'text-muted-foreground' : 'text-muted-foreground line-through'}>
        {text}
      </span>
    </li>
  );
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

  if (numbers.length <= 2) {
    return numbers;
  }

  if (numbers.length <= 7) {
    return numbers.replace(/^(\d{2})(\d+)/, '($1) $2');
  }

  return numbers.replace(
    /^(\d{2})(\d{5})(\d{0,4}).*/,
    '($1) $2-$3'
  );
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
      const res = await fetch(
        `/api/billing/checkout?plan=${plan.slug}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
         body: JSON.stringify({
  name: profile!.full_name,
  cpf: profile!.cpf_cnpj,
  phone: profile!.phone,
  professionalRequirement:
    profile!.professional_requirement,
}),
        }
      );

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

  console.log(plans);

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
      <header className="text-center space-y-3">
        <h1 className="text-3xl text-white md:text-4xl font-semibold tracking-tight">
          Planos <span className="text-brand">.</span>
        </h1>
          <div className="mb-12 text-center">
              <h2 className="text-4xl md:text-5xl font-medium tracking-tight max-w-3xl mx-auto">
                <span className="text-white">Comece grátis,</span>{' '}
                <span className="text-brand">
                  faça upgrade quando precisar.
                </span>
              </h2>
            </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 
{orderedPlans.map((plan) => {
  const isRecommended = plan.slug === 'pf-99';

  return (
    <div
      key={plan.id}
      className={`rounded-2xl p-6 space-y-4 relative ${
        isRecommended
          ? 'border-2 border-brand bg-card'
          : 'border border-white/5 bg-card'
      }`}
    >
      {isRecommended && (
        <div className="absolute -top-3 left-8 bg-brand text-white text-[10px] uppercase tracking-wider font-semibold px-3 py-1 rounded-full">
          Recomendado
        </div>
      )}

      <div className="space-y-1">
        <div
          className={`text-xs uppercase tracking-wider ${
            isRecommended ? 'text-brand' : 'text-muted-foreground'
          }`}
        >
          {plan.name}
        </div>

        <div className="flex items-baseline gap-1">
         <span className="text-white text-3xl font-semibold">
  {plan.slug === 'pj-consulte'
    ? 'Sob Consulta'
    : `R$ ${Number(plan.price).toFixed(2)}`}
</span>

          {plan.price > 0 && (
            <span className="text-sm text-muted-foreground">
              /{plan.interval}
            </span>
          )}
        </div>

        <div className="text-xs text-muted-foreground">
          {plan.description}
        </div>
      </div>

      <ul className="space-y-2 pt-2">
        {plan.features?.map((feature: string) => (
          <FeatureRow
            key={feature}
            included
            text={feature}
          />
        ))}
      </ul>
        
    {userPlanSlug === plan.slug ? (
  <div className="text-center text-sm text-emerald-600 dark:text-emerald-400 font-medium py-2">
    ✓ Você já está neste plano
  </div>
) : plan.slug === 'free' ? (
  !authed && (
    <Link
      href="/signup?next=/pricing"
      className="inline-flex w-full items-center justify-center gap-2 bg-white/5 border border-white/10 text-white py-2.5 rounded-full text-sm font-medium hover:bg-white/10 active:scale-95 transition-all duration-300"
    >
      Criar conta grátis
    </Link>
  )
) : plan.slug === 'pj-consulte' ? (
  <button
    type="button"
    className="inline-flex w-full items-center justify-center gap-2 bg-white/5 border border-white/10 text-white py-2.5 rounded-full text-sm font-medium hover:bg-white/10 active:scale-95 transition-all duration-300"
  >
    Solicitar proposta
    <ArrowRight className="h-3.5 w-3.5" />
  </button>
) : !authed ? (
  <Link
    href="/signup?next=/pricing"
    className="block text-center w-full rounded-full bg-brand text-black hover:bg-brand/90 h-10 leading-10 text-sm font-semibold transition-colors"
  >
    Comece grátis primeiro
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
  className="w-full rounded-full bg-brand-gradient text-black hover:bg-brand/90 h-10 text-sm font-semibold transition-all duration-300 active:scale-95 inline-flex items-center justify-center gap-2"
>
  Assinar Plano
  <ArrowRight className="h-3.5 w-3.5" />
</button>
)}

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
  <CheckoutForm
    plan={selectedPlan}
    onClose={() => setShowCheckout(false)}
  />
)}
    </div>
  );
}

// ─── CheckoutForm: modal Nome + CPF antes de redirecionar pro Asaas ───
function CheckoutForm({
  onClose,
  plan,
}: {
  onClose: () => void;
  plan: Plan;
}) {
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

    console.log('CHECKOUT RESPONSE:', body);

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
          <h2 className="text-3xl font-semibold text-white">
  {plan.name} <span className="text-brand">.</span>
</h2>
          <p className="text-base text-muted-foreground">
            Pra emitir a cobrança, precisamos de algumas informações.
            Cobramos R$ {plan.price.toFixed(2)}/mês via Asaas (cartão ou Pix recorrente).
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="checkout-name"
              className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2"
            >
              Nome completo
            </label>
            <input
              id="checkout-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className="w-full rounded-lg bg-white border border-border px-4 py-2.5 text-lg text-foreground placeholder-muted-foreground outline-none focus:border-brand focus:bg-muted/60 transition-colors"
            />
          </div>

          <div>
            <label
              htmlFor="checkout-cpf"
              className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2"
            >
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
  className="w-full rounded-lg bg-white border border-border px-4 py-2.5 text-lg text-foreground placeholder-muted-foreground outline-none focus:border-brand focus:bg-muted/60 transition-colors"
/>
            {cpfInput.length > 0 && !cpfOk && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                CPF inválido — verifique os dígitos.
              </p>
            )}
          </div>
          
<div>
  <label className="text-xs uppercase tracking-wider text-muted-foreground">
    Telefone
  </label>

  <input
    type="tel"
    value={phone}
    onChange={(e) => setPhone(maskPhone(e.target.value))}
    className="w-full rounded-lg bg-white border border-border px-4 py-2.5 text-lg text-foreground placeholder-muted-foreground outline-none focus:border-brand focus:bg-muted/60 transition-colors"
  />
</div>

<div>
  <label className="text-xs uppercase tracking-wider text-muted-foreground">
    Exigência Profissional
  </label>

  <input
    type="text"
    value={professionalRequirement}
    onChange={(e) => setProfessionalRequirement(e.target.value)}
    className="w-full rounded-lg bg-white border border-border px-4 py-2.5 text-lg text-foreground placeholder-muted-foreground outline-none focus:border-brand focus:bg-muted/60 transition-colors"
  />
</div>
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300"
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
              className="flex-1 rounded-full bg-brand-gradient text-black hover:bg-brand-gradient/90 disabled:opacity-50 disabled:cursor-not-allowed h-10 text-sm font-semibold transition-all active:scale-95 inline-flex items-center justify-center gap-2"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  carregando…
                </>
              ) : (
                <>Continuar <ArrowRight className="h-3.5 w-3.5" aria-hidden /></>
              )}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center pt-2 border-t border-border">
            Você será redirecionado pro Asaas pra concluir o pagamento.
          </p>
        </form>
      </div>
    </div>
  );
}
