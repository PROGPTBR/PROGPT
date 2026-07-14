'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, Users, MessageSquare, Sparkles, DollarSign, UserPlus,
  Download, RefreshCw, Loader2,
} from 'lucide-react';

type UserRow = {
  userId: string;
  email: string;
  role: string;
  sessions: number;
  runs: number;
  spendCents: number;
  lastActive: string;
};
type SessionRow = {
  sessionId: string;
  userId: string | null;
  email: string;
  title: string;
  calls: number;
  tokensIn: number;
  tokensOut: number;
  spendCents: number;
  lastAt: string;
};
type Payload = {
  rangeDays: number;
  overview: {
    totalUsers: number;
    admin: number;
    gestor: number;
    user: number;
    newUsers: number;
    activeUsers: number;
    totalSessions: number;
    totalRuns: number;
    totalSpendCents: number;
    subscriptions: Record<string, number>;
  };
  byDay: Array<{ day: string; costCents: number; calls: number }>;
  users: UserRow[];
  sessions: SessionRow[];
};

const RANGES = [
  { key: 1, label: 'Hoje' },
  { key: 2, label: '2 dias' },
  { key: 7, label: '7 dias' },
  { key: 30, label: '30 dias' },
  { key: 90, label: '90 dias' },
];

const usd = (cents: number) => {
  const v = cents / 100;
  return `US$ ${v.toFixed(v > 0 && v < 1 ? 4 : 2)}`;
};
const int = (n: number) => n.toLocaleString('pt-BR');
const ROLE_LABEL: Record<string, string> = { admin: 'Admin', gestor: 'Gestor', user: 'Usuário' };

function relative(iso: string): string {
  if (!iso || iso.startsWith('1970')) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} h`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `${d} d`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

function downloadCsv(filename: string, rows: Array<Record<string, string | number>>) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]!);
  const escape = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    headers.join(';'),
    ...rows.map((r) => headers.map((h) => escape(r[h] ?? '')).join(';')),
  ].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function MonitorDashboard() {
  const [range, setRange] = useState(30);
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (days: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/monitor?range=${days}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as Payload);
    } catch (e) {
      console.error(e);
      setError('Não foi possível carregar o monitoramento.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(range);
  }, [range, load]);

  const maxDayCost = useMemo(
    () => (data ? Math.max(1, ...data.byDay.map((d) => d.costCents)) : 1),
    [data],
  );

  return (
    <div className="space-y-6 max-w-6xl">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-brand">
            <Activity className="h-5 w-5" aria-hidden />
            <span className="text-xs font-medium uppercase tracking-wider">Monitoramento</span>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight">
            Painel do site <span className="text-brand">.</span>
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Usuários, atividade e gastos por sessão — atualizado em tempo real.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center rounded-full border border-border bg-card p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  range === r.key ? 'bg-brand-gradient text-black' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => void load(range)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-sm hover:border-brand/40 hover:text-brand transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {error && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      )}

      {data && (
        <>
          {/* KPIs */}
          <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <Kpi icon={<Users className="h-4 w-4" />} label="Usuários" value={int(data.overview.totalUsers)} hint={`${data.overview.admin} adm · ${data.overview.gestor} gestor`} />
            <Kpi icon={<Activity className="h-4 w-4" />} label="Ativos" value={int(data.overview.activeUsers)} hint="no período" />
            <Kpi icon={<UserPlus className="h-4 w-4" />} label="Novos" value={int(data.overview.newUsers)} hint="no período" />
            <Kpi icon={<MessageSquare className="h-4 w-4" />} label="Sessões" value={int(data.overview.totalSessions)} />
            <Kpi icon={<Sparkles className="h-4 w-4" />} label="Execuções" value={int(data.overview.totalRuns)} />
            <Kpi icon={<DollarSign className="h-4 w-4" />} label="Gasto (API)" value={usd(data.overview.totalSpendCents)} />
            <Kpi icon={<DollarSign className="h-4 w-4" />} label="Assinaturas" value={int(data.overview.subscriptions.active ?? 0)} hint={`${data.overview.subscriptions.trialing ?? 0} trial`} />
          </section>

          {/* Atividade por dia */}
          <Panel title="Custo de API por dia" subtitle="Some por dia no período">
            {data.byDay.length === 0 ? (
              <Empty text="Sem uso registrado no período." />
            ) : (
              <div className="flex items-end gap-1 h-40">
                {data.byDay.map((d) => (
                  <div key={d.day} className="flex-1 flex flex-col items-center justify-end gap-1 group" title={`${d.day}: ${usd(d.costCents)} · ${int(d.calls)} chamadas`}>
                    <div
                      className="w-full rounded-t bg-brand/70 group-hover:bg-brand transition-colors"
                      style={{ height: `${Math.max(2, (d.costCents / maxDayCost) * 100)}%` }}
                    />
                    <span className="text-[9px] text-muted-foreground rotate-0 truncate w-full text-center">
                      {d.day.slice(8)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* Usuários — quem faz o quê */}
          <Panel
            title="Atividade por usuário"
            subtitle="Quem entra e o que faz"
            action={
              <ExportBtn
                onClick={() =>
                  downloadCsv(
                    `usuarios-${data.rangeDays}d.csv`,
                    data.users.map((u) => ({
                      email: u.email, papel: ROLE_LABEL[u.role] ?? u.role,
                      sessoes: u.sessions, execucoes: u.runs,
                      gasto_usd: (u.spendCents / 100).toFixed(4), ultimo_acesso: u.lastActive,
                    })),
                  )
                }
              />
            }
          >
            {data.users.length === 0 ? (
              <Empty text="Nenhuma atividade de usuário no período." />
            ) : (
              <Table
                head={['Usuário', 'Papel', 'Sessões', 'Execuções', 'Gasto', 'Último acesso']}
                rows={data.users.map((u) => [
                  u.email,
                  ROLE_LABEL[u.role] ?? u.role,
                  int(u.sessions),
                  int(u.runs),
                  usd(u.spendCents),
                  relative(u.lastActive),
                ])}
                numericCols={[2, 3, 4]}
              />
            )}
          </Panel>

          {/* Gastos por sessão */}
          <Panel
            title="Gastos por sessão"
            subtitle="Custo de IA por conversa (maior → menor)"
            action={
              <ExportBtn
                onClick={() =>
                  downloadCsv(
                    `sessoes-${data.rangeDays}d.csv`,
                    data.sessions.map((s) => ({
                      titulo: s.title, usuario: s.email, chamadas: s.calls,
                      tokens_in: s.tokensIn, tokens_out: s.tokensOut,
                      gasto_usd: (s.spendCents / 100).toFixed(4), ultimo: s.lastAt,
                    })),
                  )
                }
              />
            }
          >
            {data.sessions.length === 0 ? (
              <Empty text="Nenhum gasto atribuído a sessões no período. (O rastreio por sessão começa após o deploy desta versão.)" />
            ) : (
              <Table
                head={['Sessão', 'Usuário', 'Turnos', 'Tokens', 'Gasto', 'Último']}
                rows={data.sessions.slice(0, 100).map((s) => [
                  s.title,
                  s.email,
                  int(s.calls),
                  int(s.tokensIn + s.tokensOut),
                  usd(s.spendCents),
                  relative(s.lastAt),
                ])}
                numericCols={[2, 3, 4]}
              />
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

// ─── UI ───────────────────────────────────────────────────────────────────

function Kpi({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <span className="text-brand">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 text-lg sm:text-xl font-semibold tabular-nums leading-tight">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground truncate">{hint}</div>}
    </div>
  );
}

function Panel({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function ExportBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium hover:border-brand/40 hover:text-brand transition-colors"
    >
      <Download className="h-3.5 w-3.5" aria-hidden /> CSV
    </button>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground">{text}</p>;
}

function Table({ head, rows, numericCols = [] }: { head: string[]; rows: (string | number)[][]; numericCols?: number[] }) {
  const num = new Set(numericCols);
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {head.map((h, i) => (
              <th key={h} className={`px-3 py-2 font-medium text-muted-foreground whitespace-nowrap ${num.has(i) ? 'text-right' : 'text-left'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
              {r.map((c, ci) => (
                <td key={ci} className={`px-3 py-1.5 whitespace-nowrap max-w-[240px] truncate ${num.has(ci) ? 'text-right tabular-nums' : 'text-foreground/90'}`} title={String(c)}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
