'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

// Sub-projeto 36.3 — cancelamento self-service no Perfil. Durante o trial,
// cancelar AQUI cancela a cobrança programada no Asaas (não é cobrado) e o
// usuário mantém o acesso até o fim do período já contratado/teste.

type Props = {
  status: string;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

const ACTIVE_STATUSES = ['trialing', 'active', 'past_due'];

function fmt(date: string | null): string | null {
  if (!date) return null;
  const d = new Date(date);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString('pt-BR') : null;
}

export function CancelSubscription({
  status,
  trialEnd,
  currentPeriodEnd,
  cancelAtPeriodEnd,
}: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const accessUntil = fmt(currentPeriodEnd ?? trialEnd);
  const isTrial = status === 'trialing';

  // Já cancelado → só informa.
  if (done || cancelAtPeriodEnd) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500 flex-shrink-0" aria-hidden="true" />
        <span>
          Cancelamento confirmado — <strong className="text-foreground">não haverá cobrança</strong>.
          {accessUntil ? ` Você mantém o acesso até ${accessUntil}.` : ''}
        </span>
      </div>
    );
  }

  // Sem assinatura ativa/trial → nada a cancelar.
  if (!ACTIVE_STATUSES.includes(status)) return null;

  async function handleCancel() {
    setBusy(true);
    try {
      const res = await fetch('/api/billing/cancel', { method: 'POST' });
      if (!res.ok) {
        toast.error('Não foi possível cancelar agora. Tente novamente.');
        setBusy(false);
        return;
      }
      setDone(true);
      toast.success('Assinatura cancelada. Você não será cobrado.');
      router.refresh();
    } catch {
      toast.error('Erro de rede. Tente novamente.');
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-red-600 dark:hover:text-red-400 transition-colors"
      >
        <XCircle className="h-4 w-4" aria-hidden="true" />
        Cancelar assinatura
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-red-500/20 bg-red-500/[0.03] p-4 space-y-3">
      <p className="text-sm text-foreground">
        {isTrial ? (
          <>
            Cancelar agora? <strong>Você não será cobrado</strong>
            {accessUntil ? ` e mantém o acesso até ${accessUntil}` : ''}. A
            cobrança programada é cancelada na hora.
          </>
        ) : (
          <>
            Cancelar a assinatura? Você mantém o acesso até{' '}
            <strong>{accessUntil ?? 'o fim do ciclo atual'}</strong> e não haverá
            novas cobranças.
          </>
        )}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={busy}
          className="flex-1 rounded-full border border-border bg-background hover:bg-accent text-foreground h-9 text-sm transition-colors disabled:opacity-50"
        >
          Voltar
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={busy}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-red-600 hover:bg-red-700 text-white h-9 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Cancelando…
            </>
          ) : (
            'Confirmar cancelamento'
          )}
        </button>
      </div>
    </div>
  );
}
