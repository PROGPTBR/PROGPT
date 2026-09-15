'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Users, Building2, MessageSquare, CreditCard, Zap, AlertCircle, Wifi, WifiOff } from 'lucide-react';

type RecentLogin = { id: string; email: string; lastSignInAt: string | null };
type Payload = {
  kpis: {
    usersLoggedIn24h: number;
    orgsActive: number;
    totalOrgs: number;
    sessionsActive24h: number;
    payingUsers: number;
    aiCalls24h: number;
    aiCostCents24h: number;
    unresolvedNegativeFeedback: number;
  };
  fiscalService: { enabled: boolean; healthy: boolean | null };
  recentLogins: RecentLogin[];
};

const usd = (cents: number) => `US$ ${(cents / 100).toFixed(cents > 0 && cents < 100 ? 4 : 2)}`;

function relative(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} h`;
  return `${Math.floor(hr / 24)} d`;
}

export function MonitoramentoRoot() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    fetch('/api/plataforma/monitoramento')
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.json() as Promise<Payload>;
      })
      .then(setData)
      .catch((err) => toast.error('Falha ao carregar monitoramento', { description: String(err) }))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!data) return <p className="text-sm text-destructive">Não foi possível carregar o monitoramento.</p>;

  const { kpis, fiscalService, recentLogins } = data;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Monitoramento</h1>
          <p className="text-sm text-muted-foreground mt-1">Pulso em tempo real da plataforma.</p>
        </div>
        <button
          onClick={load}
          className="rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:border-amber-500/40 hover:text-amber-600 transition-colors"
        >
          Atualizar
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={<Users className="h-4 w-4" />} label="Login (24h)" value={kpis.usersLoggedIn24h} />
        <Kpi
          icon={<Building2 className="h-4 w-4" />}
          label="Orgs"
          value={`${kpis.orgsActive}/${kpis.totalOrgs}`}
          hint="ativas/total"
        />
        <Kpi icon={<MessageSquare className="h-4 w-4" />} label="Sessões (24h)" value={kpis.sessionsActive24h} />
        <Kpi icon={<CreditCard className="h-4 w-4" />} label="Pagantes" value={kpis.payingUsers} />
        <Kpi icon={<Zap className="h-4 w-4" />} label="Chamadas IA (24h)" value={kpis.aiCalls24h} />
        <Kpi icon={<Zap className="h-4 w-4" />} label="Custo IA (24h)" value={usd(kpis.aiCostCents24h)} />
        <Kpi
          icon={<AlertCircle className="h-4 w-4" />}
          label="Feedback 👎 pendente"
          value={kpis.unresolvedNegativeFeedback}
          tone={kpis.unresolvedNegativeFeedback > 0 ? 'warn' : undefined}
        />
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            {fiscalService.healthy ? (
              <Wifi className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <WifiOff className="h-4 w-4 text-muted-foreground" />
            )}
            <span>Serviço fiscal</span>
          </div>
          <div className="mt-1 text-sm font-semibold">
            {!fiscalService.enabled ? 'Desligado' : fiscalService.healthy ? 'Saudável' : 'Fora do ar'}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <h3 className="text-sm font-semibold mb-3">Usuários com login recente</h3>
        {recentLogins.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum login registrado.</p>
        ) : (
          <ul className="space-y-2 text-xs">
            {recentLogins.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 border-b border-border/60 last:border-0 pb-2 last:pb-0">
                <Link href={`/plataforma/usuarios/${u.id}`} className="hover:underline">
                  {u.email}
                </Link>
                <span className="text-muted-foreground shrink-0">{relative(u.lastSignInAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'warn';
}) {
  const warn = tone === 'warn';
  return (
    <div className={`rounded-xl border p-3 ${warn ? 'border-amber-500/40 bg-amber-500/10' : 'border-border bg-card'}`}>
      <div
        className={`flex items-center gap-1.5 text-[11px] uppercase tracking-wide ${warn ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}`}
      >
        <span className={warn ? '' : 'text-amber-600 dark:text-amber-400'}>{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
