import { NextResponse } from 'next/server';
import { requireUser, NotAuthenticated } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';
import { buildCubeFromRows } from '@/lib/spend/from-rows';
import type { SpendInvoiceRow } from '@/lib/spend/types';
import {
  lastNMonths,
  activitySeries,
  groupRunsByType,
} from '@/lib/dashboard/aggregate';
import type { DashboardPayload, DashboardSpend } from '@/lib/dashboard/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Painel unificado do cliente. Agrega TODOS os dados owner-scoped do usuário
// (conversas, execuções de assistentes, gasto analisado, plano) num único
// payload. Leitura via service-role com filtro explícito por user_id (defesa em
// profundidade — mesmo padrão dos outros endpoints owner-gated).
//
// Nota: total_ref das notas é somado na moeda de referência de cada run. A
// audiência é BR (referência BRL na esmagadora maioria); v1 assume BRL no
// agregado unificado. Runs com referência diferente são raros e ficam fora de
// escopo do rollup unificado.
const REFERENCE_CURRENCY = 'BRL';
const TOP_N = 8;

export async function GET() {
  let userId: string;
  try {
    const user = await requireUser();
    userId = user.id;
  } catch (err) {
    if (err instanceof NotAuthenticated) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    throw err;
  }

  const svc = getServerSupabase();

  const [sessionsRes, runsRes, invoicesRes, profileRes, subRes] = await Promise.all([
    svc.from('sessions').select('created_at').eq('user_id', userId),
    svc.from('assistant_runs').select('assistant_type, status, created_at').eq('user_id', userId),
    svc.from('spend_invoices').select('*').eq('user_id', userId),
    svc.from('profiles').select('company_name').eq('id', userId).maybeSingle(),
    svc
      .from('subscriptions')
      .select('status, plan, current_period_end')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  const sessions = sessionsRes.data ?? [];
  const runs = (runsRes.data ?? []) as { assistant_type: string; status: string; created_at: string }[];
  const invoiceRows = (invoicesRes.data ?? []) as SpendInvoiceRow[];

  const months = lastNMonths(new Date(), 12);
  const runsByType = groupRunsByType(runs);
  const activityByMonth = activitySeries(
    months,
    sessions.map((s) => s.created_at as string),
    runs.map((r) => r.created_at),
  );

  const cube = buildCubeFromRows(invoiceRows, REFERENCE_CURRENCY);

  const spend: DashboardSpend | null =
    cube.invoiceCount > 0
      ? {
          referenceCurrency: cube.referenceCurrency,
          totalRef: cube.totalRef,
          invoiceCount: cube.invoiceCount,
          ticketMedio: cube.ticketMedio,
          poCoveragePct: cube.poCoveragePct,
          byCategory: cube.byCategory
            .slice(0, TOP_N)
            .map((b) => ({ key: b.key, totalRef: b.totalRef, pct: b.pct })),
          bySupplier: cube.bySupplier
            .slice(0, TOP_N)
            .map((b) => ({ key: b.key, totalRef: b.totalRef, pct: b.pct })),
          byMonth: cube.byMonth.map((m) => ({ key: m.key, totalRef: m.totalRef })),
        }
      : null;

  const doneRuns = runs.filter((r) => r.status === 'done').length;

  const payload: DashboardPayload = {
    generatedAt: new Date().toISOString(),
    company: { name: profileRes.data?.company_name ?? null },
    overview: {
      sessions: sessions.length,
      assistantRuns: doneRuns,
      invoicesProcessed: spend?.invoiceCount ?? 0,
      suppliersAnalyzed: cube.bySupplier.length,
      categoriesCovered: cube.byCategory.length,
      spendAnalyzedRef: cube.totalRef,
    },
    runsByType,
    activityByMonth,
    spend,
    plan: {
      status: subRes.data?.status ?? null,
      plan: subRes.data?.plan ?? null,
      currentPeriodEnd: subRes.data?.current_period_end ?? null,
    },
  };

  return NextResponse.json(payload);
}
