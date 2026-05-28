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

type Props = {
  authed: boolean;
  isPro: boolean;
};

const PRO_PRICE_BRL =
  process.env.NEXT_PUBLIC_PRO_PRICE_BRL ?? '99.00';

function FeatureRow({ text, included }: { text: string; included: boolean }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {included ? (
        <Check className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" aria-hidden />
      ) : (
        <X className="h-4 w-4 text-muted-foreground/60 mt-0.5 flex-shrink-0" aria-hidden />
      )}
      <span className={included ? 'text-foreground' : 'text-muted-foreground line-through'}>
        {text}
      </span>
    </li>
  );
}

export function PricingTable({ authed, isPro }: Props) {
  const [showCheckout, setShowCheckout] = useState(false);

  return (
    <div className="space-y-10">
      <header className="text-center space-y-3">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          Planos <span className="text-brand">.</span>
        </h1>
        <p className="text-muted-foreground text-sm max-w-xl mx-auto">
          Comece grátis. Faça upgrade quando precisar de mais — sem
          surpresas, cancele quando quiser.
        </p>
      </header>

      <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        {/* Free */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Free</div>
            <div className="text-3xl font-semibold">R$ 0</div>
            <div className="text-xs text-muted-foreground">grátis pra sempre</div>
          </div>
          <ul className="space-y-2 pt-2">
            <FeatureRow included text="Chat ilimitado com o especialista" />
            <FeatureRow included text="1 execução grátis de cada assistente (lifetime)" />
            <FeatureRow included text="Suporte pela comunidade" />
            <FeatureRow included={false} text="Assistentes ilimitados" />
            <FeatureRow included={false} text="Suporte por email" />
          </ul>
          {!authed && (
            <Link
              href="/signup?next=/pricing"
              className="block text-center w-full rounded-full border border-border bg-background hover:bg-accent h-10 leading-10 text-sm font-medium transition-colors"
            >
              Criar conta
            </Link>
          )}
        </div>

        {/* Pro */}
        <div className="rounded-2xl border-2 border-brand bg-card p-6 space-y-4 relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand text-black text-[10px] uppercase tracking-wider font-semibold px-3 py-1 rounded-full">
            Recomendado
          </div>
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-wider text-brand">Pro</div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-semibold">R$ {PRO_PRICE_BRL}</span>
              <span className="text-sm text-muted-foreground">/mês</span>
            </div>
            <div className="text-xs text-muted-foreground">cancele a qualquer momento</div>
          </div>
          <ul className="space-y-2 pt-2">
            <FeatureRow included text="Tudo do Free" />
            <FeatureRow included text="Assistentes ilimitados (RFP, Kraljic, Negociação, e mais)" />
            <FeatureRow included text="Geração ilimitada de .docx e .xlsx" />
            <FeatureRow included text="Suporte por email" />
          </ul>
          {isPro ? (
            <div className="text-center text-sm text-emerald-600 dark:text-emerald-400 font-medium py-2">
              ✓ Você já é Pro
            </div>
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
              onClick={() => setShowCheckout(true)}
              className="w-full rounded-full bg-brand text-black hover:bg-brand/90 h-10 text-sm font-semibold transition-all duration-300 active:scale-95 inline-flex items-center justify-center gap-2"
            >
              Assinar Pro
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </div>
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

      {showCheckout && (
        <CheckoutForm onClose={() => setShowCheckout(false)} />
      )}
    </div>
  );
}

// ─── CheckoutForm: modal Nome + CPF antes de redirecionar pro Asaas ───

function CheckoutForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [cpfInput, setCpfInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), cpf: cpfClean }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'unknown' }));
        if (body.error === 'already_subscribed') {
          toast.info('Você já tem uma assinatura ativa.');
          router.push('/account/billing');
          return;
        }
        setError(
          body.error === 'invalid_cpf'
            ? 'CPF inválido. Confira os dígitos.'
            : 'Não foi possível abrir o checkout. Tente em alguns minutos.',
        );
        setBusy(false);
        return;
      }
      const body = await res.json();
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
          <h2 className="text-xl font-semibold">Assinar Pro</h2>
          <p className="text-xs text-muted-foreground">
            Pra emitir a cobrança, precisamos do seu nome completo e CPF.
            Cobramos R$ {PRO_PRICE_BRL}/mês via Asaas (cartão ou Pix recorrente).
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
              className="w-full rounded-lg bg-muted/40 border border-border px-4 py-2.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-brand focus:bg-muted/60 transition-colors"
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
              onChange={(e) => setCpfInput(e.target.value)}
              placeholder="000.000.000-00"
              inputMode="numeric"
              autoComplete="off"
              className="w-full rounded-lg bg-muted/40 border border-border px-4 py-2.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-brand focus:bg-muted/60 transition-colors font-mono"
            />
            {cpfInput.length > 0 && !cpfOk && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                CPF inválido — verifique os dígitos.
              </p>
            )}
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
              className="flex-1 rounded-full border border-border bg-background hover:bg-accent h-10 text-sm transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 rounded-full bg-brand text-black hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed h-10 text-sm font-semibold transition-all active:scale-95 inline-flex items-center justify-center gap-2"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Abrindo…
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
