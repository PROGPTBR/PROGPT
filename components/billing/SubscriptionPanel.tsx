'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, CreditCard, Loader2, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import type { Subscription } from '@/lib/billing/subscription';

type Props = {
  subscription: Subscription | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function StatusBadge({ status }: { status: Subscription['status'] }) {
  const map: Record<Subscription['status'], { label: string; cls: string }> = {
    pending: {
      label: 'Aguardando pagamento',
      cls: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    },
    active: {
      label: 'Ativa',
      cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    },
    past_due: {
      label: 'Pagamento em atraso',
      cls: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300',
    },
    cancelled: {
      label: 'Cancelada',
      cls: 'border-muted-foreground/40 bg-muted/40 text-muted-foreground',
    },
    expired: {
      label: 'Expirada',
      cls: 'border-muted-foreground/40 bg-muted/40 text-muted-foreground',
    },
  };
  const m = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${m.cls}`}>
      {m.label}
    </span>
  );
}

export function SubscriptionPanel({ subscription }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleCancel() {
    if (!subscription) return;
    if (!confirm('Confirma o cancelamento? Você mantém Pro até o fim do ciclo atual.')) return;
    setBusy(true);
    try {
      const res = await fetch('/api/billing/cancel', { method: 'POST' });
      if (!res.ok) {
        toast.error('Falha ao cancelar. Tente novamente.');
        setBusy(false);
        return;
      }
      toast.success('Assinatura cancelada. Acesso até o fim do ciclo.');
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error('Erro de rede. Tente novamente.');
      setBusy(false);
    }
  }

  // No subscription = free user
  if (!subscription) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Assinatura</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Você está no plano <span className="font-medium text-foreground">Free</span>.
          </p>
        </div>
        <div className="rounded-2xl border-2 border-brand bg-brand/5 p-6 space-y-3">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-brand mt-0.5" aria-hidden />
            <div>
              <div className="font-semibold">Upgrade pra Pro</div>
              <div className="text-sm text-muted-foreground">
                R$ 99/mês · assistentes ilimitados · suporte por email
              </div>
            </div>
          </div>
          <Link
            href="/pricing"
            className="block text-center w-full rounded-full bg-brand text-black hover:bg-brand/90 h-10 leading-10 text-sm font-semibold transition-colors"
          >
            Ver planos
          </Link>
        </div>
      </div>
    );
  }

  const isCancelling = subscription.cancel_at_period_end;
  const showCancelButton =
    !isCancelling &&
    (subscription.status === 'active' || subscription.status === 'past_due');

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Assinatura</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Plano <span className="font-medium text-foreground">{subscription.plan === 'pro' ? 'Pro' : subscription.plan}</span>
          </p>
        </div>
        <StatusBadge status={subscription.status} />
      </div>

      {subscription.status === 'past_due' && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" aria-hidden />
          <div className="text-sm space-y-1">
            <div className="font-medium text-foreground">Pagamento em atraso</div>
            <div className="text-muted-foreground">
              Tentamos cobrar mas não conseguimos. Verifique seu método de
              pagamento no Asaas. Seu acesso continua até {formatDate(subscription.current_period_end)}.
            </div>
          </div>
        </div>
      )}

      {isCancelling && subscription.current_period_end && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" aria-hidden />
          <div className="text-sm space-y-1">
            <div className="font-medium text-foreground">Cancelamento agendado</div>
            <div className="text-muted-foreground">
              Sua assinatura foi cancelada. Você mantém Pro até{' '}
              <span className="font-medium text-foreground">{formatDate(subscription.current_period_end)}</span>.
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Método</div>
            <div className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4" aria-hidden />
              {subscription.payment_method === 'credit_card'
                ? 'Cartão de crédito'
                : subscription.payment_method === 'pix'
                  ? 'Pix recorrente'
                  : subscription.payment_method === 'boleto'
                    ? 'Boleto'
                    : 'Não definido ainda'}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
          <div className="space-y-0.5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Início do ciclo</div>
            <div className="text-sm">{formatDate(subscription.current_period_start)}</div>
          </div>
          <div className="space-y-0.5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              {isCancelling ? 'Acesso até' : 'Próxima cobrança'}
            </div>
            <div className="text-sm">{formatDate(subscription.current_period_end)}</div>
          </div>
        </div>
      </div>

      {showCancelButton && (
        <button
          type="button"
          onClick={handleCancel}
          disabled={busy}
          className="w-full rounded-full border border-red-500/40 bg-red-500/5 hover:bg-red-500/10 text-red-700 dark:text-red-400 h-10 text-sm font-medium transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Cancelando…
            </>
          ) : (
            <>
              <X className="h-4 w-4" aria-hidden />
              Cancelar assinatura
            </>
          )}
        </button>
      )}

      {subscription.status === 'cancelled' && (
        <Link
          href="/pricing"
          className="block text-center w-full rounded-full bg-brand text-black hover:bg-brand/90 h-10 leading-10 text-sm font-semibold transition-colors"
        >
          Reativar assinatura
        </Link>
      )}
    </div>
  );
}
