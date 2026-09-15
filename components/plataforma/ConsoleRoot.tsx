'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Building2, Users, FileCode, CreditCard, AlertTriangle } from 'lucide-react';

type Alert = { userId: string; email: string; trialEnd?: string };
type Activity = {
  id: string;
  actorEmail: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  createdAt: string;
};
type Payload = {
  kpis: { totalOrgs: number; totalUsers: number; payingUsers: number; totalTemplates: number };
  alerts: { pastDue: Alert[]; trialEndingSoon: Alert[] };
  recentActivity: Activity[];
};

const ACTION_LABEL: Record<string, string> = {
  'user.role_change': 'trocou o papel',
  'user.activate': 'ativou o acesso',
  'user.deactivate': 'desativou o acesso',
  'user.reset_password_request': 'pediu redefinição de senha',
  'user.assign_org': 'moveu de org',
  'user.grant_super_admin': 'concedeu super admin',
  'user.revoke_super_admin': 'revogou super admin',
  'user.billing_release': 'liberou acesso pago',
  'user.billing_block': 'bloqueou acesso pago',
  'user.support_view': 'visualizou como suporte',
};

function relative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} h`;
  const d = Math.floor(hr / 24);
  return `${d} d`;
}

export function ConsoleRoot() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/plataforma/console')
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.json() as Promise<Payload>;
      })
      .then(setData)
      .catch((err) => toast.error('Falha ao carregar o console', { description: String(err) }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!data) return <p className="text-sm text-destructive">Não foi possível carregar o console.</p>;

  const hasAlerts = data.alerts.pastDue.length > 0 || data.alerts.trialEndingSoon.length > 0;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Console</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visão geral da plataforma. Cada cliente pagante é 1 usuário — gerencie cada um em{' '}
          <Link href="/plataforma/usuarios" className="underline underline-offset-2">
            Usuários
          </Link>
          .
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={<Building2 className="h-4 w-4" />} label="Orgs" value={data.kpis.totalOrgs} />
        <Kpi icon={<Users className="h-4 w-4" />} label="Usuários" value={data.kpis.totalUsers} />
        <Kpi icon={<CreditCard className="h-4 w-4" />} label="Pagantes" value={data.kpis.payingUsers} />
        <Kpi icon={<FileCode className="h-4 w-4" />} label="Templates" value={data.kpis.totalTemplates} />
      </div>

      {hasAlerts && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4" />
            <h3 className="text-sm font-semibold">Precisa de atenção</h3>
          </div>
          <div className="space-y-2">
            {data.alerts.pastDue.map((a) => (
              <AlertRow
                key={`pd-${a.userId}`}
                userId={a.userId}
                title="Pagamento em atraso"
                detail={a.email}
              />
            ))}
            {data.alerts.trialEndingSoon.map((a) => (
              <AlertRow
                key={`te-${a.userId}`}
                userId={a.userId}
                title="Trial acaba em até 1 dia"
                detail={a.email}
              />
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <h3 className="text-sm font-semibold mb-3">Atividade recente</h3>
        {data.recentActivity.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma ação administrativa registrada ainda.</p>
        ) : (
          <ul className="space-y-2 text-xs">
            {data.recentActivity.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 border-b border-border/60 last:border-0 pb-2 last:pb-0">
                <span className="truncate">
                  <span className="font-medium">{a.actorEmail ?? '—'}</span>{' '}
                  {ACTION_LABEL[a.action] ?? a.action}
                  {a.resourceType && <span className="text-muted-foreground"> · {a.resourceType}</span>}
                </span>
                <span className="text-muted-foreground shrink-0">{relative(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <span className="text-amber-600 dark:text-amber-400">{icon}</span>
        <span>{label}</span>
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function AlertRow({ userId, title, detail }: { userId: string; title: string; detail: string }) {
  return (
    <Link
      href={`/plataforma/usuarios/${userId}`}
      className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/20 bg-background px-3 py-2 text-xs hover:border-amber-500/40 transition-colors"
    >
      <span>
        <span className="font-medium">{title}</span> — {detail}
      </span>
      <span className="text-amber-600 dark:text-amber-400 shrink-0">Gerenciar →</span>
    </Link>
  );
}
