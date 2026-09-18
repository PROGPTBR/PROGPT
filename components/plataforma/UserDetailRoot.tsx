'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Eye, KeyRound, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Profile = {
  id: string;
  email: string;
  role: 'admin' | 'user' | 'gestor';
  displayName: string | null;
  superAdmin: boolean;
  active: boolean;
  createdAt: string;
  lastSignInAt: string | null;
};
type Subscription = {
  status: string;
  plan: string | null;
  payment_method: string | null;
  trial_end: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  seats?: number | null;
  seat_emails?: string[] | null;
} | null;
type Usage = { sessions: number; runs: number; spendCents: number; tokensIn: number; tokensOut: number };
type Payload = {
  profile: Profile;
  org: { id: string; name: string; slug: string } | null;
  subscription: Subscription;
  usage: Usage;
};

const STATUS_LABEL: Record<string, string> = {
  none: 'Sem assinatura',
  pending: 'Aguardando',
  trialing: 'Trial',
  active: 'Ativa',
  past_due: 'Em atraso',
  cancelled: 'Cancelada',
  expired: 'Bloqueada',
};

const usd = (cents: number) => `US$ ${(cents / 100).toFixed(cents > 0 && cents < 100 ? 4 : 2)}`;
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');

export function UserDetailRoot({ userId }: { userId: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/plataforma/users/${userId}`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      setData((await res.json()) as Payload);
    } catch (err) {
      toast.error('Falha ao carregar usuário', { description: String(err) });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function call(
    method: 'PATCH' | 'POST',
    path: string,
    body: Record<string, unknown>,
    successMsg: string,
  ) {
    setBusy(true);
    try {
      const res = await fetch(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? 'Falha na ação');
        return;
      }
      toast.success(successMsg);
      void load();
    } catch (err) {
      toast.error('Falha na ação', { description: String(err) });
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!data) return <p className="text-sm text-destructive">Usuário não encontrado.</p>;

  const { profile, org, subscription, usage } = data;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link href="/plataforma/usuarios" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar pra Usuários
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{profile.email}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {org?.name ?? '—'} · papel {profile.role}
              {profile.superAdmin && ' · super admin'}
              {!profile.active && ' · '}
              {!profile.active && <span className="text-destructive font-medium">login desativado</span>}
            </p>
          </div>
          <Link
            href={`/plataforma/usuarios/${userId}/visualizar`}
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
          >
            <Eye className="h-3.5 w-3.5" /> Ver como o cliente
          </Link>
        </div>
      </div>

      {/* Métricas de uso */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="Sessões" value={usage.sessions} />
        <Metric label="Execuções" value={usage.runs} />
        <Metric label="Gasto (API)" value={usd(usage.spendCents)} />
        <Metric label="Tokens" value={(usage.tokensIn + usage.tokensOut).toLocaleString('pt-BR')} />
      </div>

      {/* Assinatura */}
      <Panel title="Assinatura">
        {subscription ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <Field label="Status" value={STATUS_LABEL[subscription.status] ?? subscription.status} />
            <Field label="Plano" value={subscription.plan ?? '—'} />
            {/* Assinatura por usuário: quantos acessos foram pagos e, quando
                informados na contratação, pra quem provisionar. */}
            <Field
              label="Usuários contratados"
              value={String(subscription.seats ?? 1)}
            />
            {!!subscription.seat_emails?.length && (
              <Field
                label="E-mails informados"
                value={subscription.seat_emails.join(', ')}
              />
            )}
            <Field label="Pagamento" value={subscription.payment_method ?? '—'} />
            <Field label="Trial até" value={fmtDate(subscription.trial_end)} />
            <Field label="Período atual até" value={fmtDate(subscription.current_period_end)} />
            <Field label="Cancela ao fim do ciclo" value={subscription.cancel_at_period_end ? 'Sim' : 'Não'} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sem assinatura registrada.</p>
        )}
        <div className="flex gap-2 mt-4">
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => call('POST', `/api/plataforma/users/${userId}/billing`, { action: 'release' }, 'Acesso pago liberado.')}
          >
            Liberar acesso pago
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => call('POST', `/api/plataforma/users/${userId}/billing`, { action: 'block' }, 'Acesso pago bloqueado.')}
          >
            Bloquear acesso pago
          </Button>
        </div>
      </Panel>

      {/* Ações de conta */}
      <Panel title="Conta">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-muted-foreground">Papel</label>
          <select
            value={profile.role}
            disabled={busy}
            onChange={(e) => call('PATCH', `/api/plataforma/users/${userId}`, { role: e.target.value }, 'Papel atualizado.')}
            className="rounded-md border border-input bg-background p-1.5 text-xs"
          >
            <option value="user">Usuário</option>
            <option value="gestor">Gestor</option>
            <option value="admin">Admin</option>
          </select>

          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => call('POST', `/api/plataforma/users/${userId}/toggle-active`, { active: !profile.active }, profile.active ? 'Acesso desativado.' : 'Acesso reativado.')}
          >
            {profile.active ? 'Desativar acesso (login)' : 'Ativar acesso (login)'}
          </Button>

          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => call('POST', `/api/plataforma/users/${userId}/reset-password`, {}, 'E-mail de redefinição enviado.')}
          >
            <KeyRound className="h-3.5 w-3.5 mr-1.5" /> Enviar redefinição de senha
          </Button>

          <Button
            size="sm"
            variant={profile.superAdmin ? 'default' : 'outline'}
            disabled={busy}
            onClick={() => call('PATCH', `/api/plataforma/users/${userId}`, { superAdmin: !profile.superAdmin }, profile.superAdmin ? 'Super admin revogado.' : 'Super admin concedido.')}
          >
            {profile.superAdmin ? 'Revogar super admin' : 'Conceder super admin'}
          </Button>

          {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </Panel>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}
