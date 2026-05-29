'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { FunnelMetrics } from '@/app/api/admin/funnel/route';

const ASSISTANT_LABELS: Record<string, string> = {
  rfp: 'RFP / RFQ',
  kraljic: 'Kraljic',
  porter: 'Porter (5 Forças)',
  financial: 'Financial Score',
  abc: 'Curva ABC',
  profile: 'Perfil da Categoria',
  negotiation: 'Negociação',
};

const fmt = (n: number) => new Intl.NumberFormat('pt-BR').format(n);
const pct = (num: number, den: number) =>
  den > 0 ? `${((num / den) * 100).toFixed(1)}%` : '—';

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

// Barra do funil — largura proporcional ao topo (signups).
function FunnelStep({
  label,
  count,
  base,
  ofPrev,
}: {
  label: string;
  count: number;
  base: number;
  ofPrev?: string;
}) {
  const width = base > 0 ? Math.max((count / base) * 100, 4) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {fmt(count)} {ofPrev && <span className="ml-1">({ofPrev})</span>}
        </span>
      </div>
      <div className="h-7 w-full rounded bg-muted">
        <div
          className="h-7 rounded bg-primary/80"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

export function FunnelDashboard() {
  const [data, setData] = useState<FunnelMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/funnel');
      if (!res.ok) throw new Error(`status ${res.status}`);
      setData((await res.json()) as FunnelMetrics);
    } catch (err) {
      toast.error('Falha ao carregar o funil', {
        description: err instanceof Error ? err.message : 'erro',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Funil de validação</h1>
          <p className="text-sm text-muted-foreground">
            Signup → ativação → pago, e uso por assistente. Decide o próximo a
            construir com dado real.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {!data ? (
        <div className="text-sm text-muted-foreground">
          {loading ? 'Carregando…' : 'Sem dados.'}
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Kpi
              label="Signups (total)"
              value={fmt(data.signups_total)}
              sub={`${fmt(data.signups_7d)} em 7d · ${fmt(data.signups_30d)} em 30d`}
            />
            <Kpi
              label="Ativados"
              value={fmt(data.activated_total)}
              sub={`${pct(data.activated_total, data.signups_total)} dos signups`}
            />
            <Kpi
              label="Pagantes (Pro)"
              value={fmt(data.paid_active)}
              sub={`${pct(data.paid_active, data.signups_total)} de conversão`}
            />
            <Kpi
              label="Cancelados / expirados"
              value={fmt(data.paid_cancelled)}
              sub="assinaturas encerradas"
            />
          </div>

          {/* Funil */}
          <div className="space-y-3 rounded-lg border border-border bg-card p-4">
            <FunnelStep label="Signups" count={data.signups_total} base={data.signups_total} />
            <FunnelStep
              label="Ativados (chat ou assistente)"
              count={data.activated_total}
              base={data.signups_total}
              ofPrev={pct(data.activated_total, data.signups_total)}
            />
            <FunnelStep
              label="Pagantes (Pro ativo)"
              count={data.paid_active}
              base={data.signups_total}
              ofPrev={pct(data.paid_active, data.signups_total)}
            />
            <div className="pt-1 text-xs text-muted-foreground">
              Ativação detalhada: {fmt(data.activated_assistants)} usaram assistente ·{' '}
              {fmt(data.activated_chat)} usaram chat.
            </div>
          </div>

          {/* Uso por assistente */}
          <div>
            <h2 className="mb-2 text-sm font-semibold">Uso por assistente</h2>
            {data.by_assistant.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma execução ainda.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Assistente</TableHead>
                    <TableHead className="text-right">Execuções</TableHead>
                    <TableHead className="text-right">Usuários</TableHead>
                    <TableHead className="text-right">Concluídas</TableHead>
                    <TableHead className="text-right">Erros</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.by_assistant.map((a) => (
                    <TableRow key={a.assistant_type}>
                      <TableCell className="font-medium">
                        {ASSISTANT_LABELS[a.assistant_type] ?? a.assistant_type}
                      </TableCell>
                      <TableCell className="text-right">{fmt(a.runs)}</TableCell>
                      <TableCell className="text-right">{fmt(a.distinct_users)}</TableCell>
                      <TableCell className="text-right">{fmt(a.done)}</TableCell>
                      <TableCell className="text-right">
                        {a.errored > 0 ? (
                          <span className="text-destructive">{fmt(a.errored)}</span>
                        ) : (
                          '0'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
