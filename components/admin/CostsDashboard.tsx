'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type DailyRow = {
  day: string;
  provider: string;
  operation: string;
  callCount: number;
  tokensIn: number;
  tokensOut: number;
  tokensCached: number;
  costUsdCents: number;
};

type ApiResponse = {
  rangeDays: number;
  daily: DailyRow[];
  totals: {
    callCount: number;
    tokensIn: number;
    tokensOut: number;
    tokensCached: number;
    costUsdCents: number;
  };
};

type UserRow = {
  userId: string | null;
  userEmail: string | null;
  callCount: number;
  tokensIn: number;
  tokensOut: number;
  tokensCached: number;
  costUsdCents: number;
  byOperation: Array<{
    operation: string;
    callCount: number;
    costUsdCents: number;
  }>;
};

type ByUserResponse = {
  rangeDays: number;
  users: UserRow[];
};

const RANGES = [
  { value: 1, label: 'Hoje' },
  { value: 7, label: '7 dias' },
  { value: 30, label: '30 dias' },
  { value: 90, label: '90 dias' },
] as const;

const fmtUsd = (cents: number): string => {
  const usd = cents / 100;
  if (usd === 0) return '$0.00';
  if (usd < 0.01) return `$${usd.toFixed(5)}`;
  if (usd < 1) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
};
const fmtNum = (n: number) => new Intl.NumberFormat('pt-BR').format(n);

export function CostsDashboard() {
  const [range, setRange] = useState<1 | 7 | 30 | 90>(30);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [byUser, setByUser] = useState<ByUserResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const fetchCosts = useCallback(async (r: number) => {
    setLoading(true);
    try {
      const [resAll, resUser] = await Promise.all([
        fetch(`/api/admin/costs?range=${r}`),
        fetch(`/api/admin/costs/by-user?range=${r}`),
      ]);
      if (!resAll.ok) throw new Error(`status ${resAll.status}`);
      const body = (await resAll.json()) as ApiResponse;
      setData(body);
      if (resUser.ok) {
        const ub = (await resUser.json()) as ByUserResponse;
        setByUser(ub);
      } else {
        // Não-fatal — main dashboard ainda mostra; só registra warning.
        console.warn(
          '[CostsDashboard] by-user fetch failed:',
          resUser.status,
        );
        setByUser(null);
      }
    } catch (err) {
      toast.error('Falha ao carregar custos', { description: String(err) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCosts(range);
  }, [range, fetchCosts]);

  const byProvider = useMemo(() => {
    if (!data) return [];
    const m = new Map<string, { provider: string; cost: number; calls: number; tokensIn: number; tokensOut: number }>();
    for (const r of data.daily) {
      const e = m.get(r.provider) ?? { provider: r.provider, cost: 0, calls: 0, tokensIn: 0, tokensOut: 0 };
      e.cost += r.costUsdCents;
      e.calls += r.callCount;
      e.tokensIn += r.tokensIn;
      e.tokensOut += r.tokensOut;
      m.set(r.provider, e);
    }
    return [...m.values()].sort((a, b) => b.cost - a.cost);
  }, [data]);

  const byOperation = useMemo(() => {
    if (!data) return [];
    const m = new Map<string, { key: string; provider: string; operation: string; cost: number; calls: number; tokensIn: number; tokensOut: number }>();
    for (const r of data.daily) {
      const key = `${r.provider}:${r.operation}`;
      const e = m.get(key) ?? { key, provider: r.provider, operation: r.operation, cost: 0, calls: 0, tokensIn: 0, tokensOut: 0 };
      e.cost += r.costUsdCents;
      e.calls += r.callCount;
      e.tokensIn += r.tokensIn;
      e.tokensOut += r.tokensOut;
      m.set(key, e);
    }
    return [...m.values()].sort((a, b) => b.cost - a.cost);
  }, [data]);

  const byDay = useMemo(() => {
    if (!data) return [];
    const m = new Map<string, { day: string; cost: number; calls: number }>();
    for (const r of data.daily) {
      const e = m.get(r.day) ?? { day: r.day, cost: 0, calls: 0 };
      e.cost += r.costUsdCents;
      e.calls += r.callCount;
      m.set(r.day, e);
    }
    return [...m.values()].sort((a, b) => b.day.localeCompare(a.day));
  }, [data]);

  const maxDailyCost = useMemo(
    () => byDay.reduce((max, d) => Math.max(max, d.cost), 0),
    [byDay],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Custos de API</h2>
          <p className="text-xs text-muted-foreground">
            Estimativa baseada em tokens gravados em cada chamada. Cohere é cobrado por call.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-border overflow-hidden">
            {RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRange(r.value)}
                className={`px-3 py-1.5 text-xs ${
                  range === r.value
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'hover:bg-accent text-muted-foreground'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchCosts(range)}
            disabled={loading}
            title="Atualizar"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card label="Custo total" value={fmtUsd(data.totals.costUsdCents)} />
            <Card label="Chamadas" value={fmtNum(data.totals.callCount)} />
            <Card
              label="Tokens (in / out)"
              value={`${fmtNum(data.totals.tokensIn)} / ${fmtNum(data.totals.tokensOut)}`}
              sub={
                data.totals.tokensCached > 0
                  ? `${fmtNum(data.totals.tokensCached)} cached`
                  : undefined
              }
            />
          </div>

          <Section title="Por provedor">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provedor</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="text-right">Chamadas</TableHead>
                  <TableHead className="text-right">Tokens in</TableHead>
                  <TableHead className="text-right">Tokens out</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byProvider.map((r) => (
                  <TableRow key={r.provider}>
                    <TableCell className="font-medium">{r.provider}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtUsd(r.cost)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtNum(r.calls)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtNum(r.tokensIn)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtNum(r.tokensOut)}</TableCell>
                  </TableRow>
                ))}
                {byProvider.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      Sem dados no período
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Section>

          <Section title="Por operação">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Operação</TableHead>
                  <TableHead>Provedor</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="text-right">Chamadas</TableHead>
                  <TableHead className="text-right">Tokens in</TableHead>
                  <TableHead className="text-right">Tokens out</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byOperation.map((r) => (
                  <TableRow key={r.key}>
                    <TableCell className="font-medium">{r.operation}</TableCell>
                    <TableCell className="text-muted-foreground">{r.provider}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtUsd(r.cost)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtNum(r.calls)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtNum(r.tokensIn)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtNum(r.tokensOut)}</TableCell>
                  </TableRow>
                ))}
                {byOperation.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                      Sem dados no período
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Section>

          {byUser && (
            <Section title="Por usuário">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead></TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                    <TableHead className="text-right">Chamadas</TableHead>
                    <TableHead className="text-right">Tokens in</TableHead>
                    <TableHead className="text-right">Tokens out</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byUser.users.map((u) => {
                    const id = u.userId ?? '__null__';
                    const expanded = expandedUserId === id;
                    const label =
                      u.userEmail ??
                      (u.userId
                        ? u.userId.slice(0, 8) + '…'
                        : '(sem usuário — pré-feature)');
                    return (
                      <>
                        <TableRow
                          key={id}
                          onClick={() =>
                            setExpandedUserId(expanded ? null : id)
                          }
                          className="cursor-pointer"
                        >
                          <TableCell className="w-6 p-1">
                            {expanded ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{label}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmtUsd(u.costUsdCents)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmtNum(u.callCount)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmtNum(u.tokensIn)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmtNum(u.tokensOut)}
                          </TableCell>
                        </TableRow>
                        {expanded && (
                          <TableRow
                            key={`${id}-detail`}
                            className="bg-muted/30"
                          >
                            <TableCell colSpan={6} className="py-2">
                              <div className="space-y-1">
                                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                                  Breakdown por operação
                                </div>
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-muted-foreground">
                                      <th className="text-left font-normal pb-1">Operação</th>
                                      <th className="text-right font-normal pb-1">Custo</th>
                                      <th className="text-right font-normal pb-1">Chamadas</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {u.byOperation.map((op) => (
                                      <tr key={op.operation}>
                                        <td className="py-0.5">{op.operation}</td>
                                        <td className="text-right tabular-nums">
                                          {fmtUsd(op.costUsdCents)}
                                        </td>
                                        <td className="text-right tabular-nums">
                                          {fmtNum(op.callCount)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                  {byUser.users.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                        Sem dados no período
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Section>
          )}

          <Section title="Por dia">
            <div className="space-y-1">
              {byDay.map((d) => {
                const widthPct = maxDailyCost > 0 ? (d.cost / maxDailyCost) * 100 : 0;
                return (
                  <div key={d.day} className="flex items-center gap-2 text-xs">
                    <div className="w-24 text-muted-foreground tabular-nums">{d.day}</div>
                    <div className="flex-1 h-5 bg-muted/30 rounded overflow-hidden">
                      <div
                        className="h-full bg-primary/40"
                        style={{ width: `${widthPct}%` }}
                        aria-label={`${fmtUsd(d.cost)}`}
                      />
                    </div>
                    <div className="w-20 text-right tabular-nums">{fmtUsd(d.cost)}</div>
                    <div className="w-16 text-right tabular-nums text-muted-foreground">
                      {fmtNum(d.calls)} chamadas
                    </div>
                  </div>
                );
              })}
              {byDay.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">
                  Sem dados no período
                </p>
              )}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
        {label}
      </div>
      <div className="text-xl font-semibold tabular-nums mt-1">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="rounded-md border border-border bg-card overflow-hidden p-2">{children}</div>
    </div>
  );
}
