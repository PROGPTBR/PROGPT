import { NextResponse } from 'next/server';
import { requireStaff, NotStaff, NotAuthenticated } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Dashboard admin de monitoramento (staff = admin + gestor). Consolida:
// usuários (total, papéis, planos, novos, ativos), atividade por dia, atividade
// por usuário e GASTOS POR SESSÃO. Agrega em JS via service-role (não depende
// de função SQL — funciona sem migration nova). Escala de beta/single-tenant.

const RANGES = new Set([1, 2, 7, 30, 90]);
const PAGE = 1000;
const SAFETY_CAP = 50_000;

type SupabaseClient = ReturnType<typeof getServerSupabase>;

// Busca paginada de uma tabela filtrando por coluna de data >= since.
async function fetchSince(
  svc: SupabaseClient,
  table: string,
  columns: string,
  sinceCol: string,
  sinceIso: string,
): Promise<Array<Record<string, unknown>>> {
  const rows: Array<Record<string, unknown>> = [];
  for (let from = 0; from < SAFETY_CAP; from += PAGE) {
    const { data, error } = await svc
      .from(table)
      .select(columns)
      .gte(sinceCol, sinceIso)
      .order(sinceCol, { ascending: false })
      .range(from, from + PAGE - 1);
    if (error || !data) break;
    const batch = data as unknown as Array<Record<string, unknown>>;
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows;
}

const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);
const maxIso = (a: string, b: string) => (a > b ? a : b);

export async function GET(req: Request) {
  try {
    await requireStaff();
  } catch (err) {
    if (err instanceof NotAuthenticated || err instanceof NotStaff) {
      return new NextResponse('Not Found', { status: 404 });
    }
    throw err;
  }

  const url = new URL(req.url);
  const rangeParam = Number(url.searchParams.get('range') ?? '30');
  const rangeDays = RANGES.has(rangeParam) ? rangeParam : 30;
  const sinceMs = Date.now() - rangeDays * 86_400_000;
  const sinceIso = new Date(sinceMs).toISOString();

  const svc = getServerSupabase();

  // Usuários + email + papel + assinaturas (leituras leves).
  const [{ data: profileRows }, { data: subRows }] = await Promise.all([
    svc
      .from('profiles_with_email')
      .select('id, email, role, created_at, auth_created_at, last_sign_in_at'),
    svc.from('subscriptions').select('status'),
  ]);

  const profiles = (profileRows ?? []) as Array<{
    id: string;
    email: string | null;
    role: string | null;
    created_at: string | null;
    auth_created_at: string | null;
  }>;
  const emailById = new Map(profiles.map((p) => [p.id, p.email ?? '—']));
  const roleById = new Map(profiles.map((p) => [p.id, p.role ?? 'user']));

  const subsByStatus: Record<string, number> = {};
  for (const s of (subRows ?? []) as Array<{ status: string | null }>) {
    const k = s.status ?? 'none';
    subsByStatus[k] = (subsByStatus[k] ?? 0) + 1;
  }

  // Fontes de atividade na janela (paginadas).
  const [sessions, runs, events] = await Promise.all([
    fetchSince(svc, 'sessions', 'id, user_id, title, updated_at', 'updated_at', sinceIso),
    fetchSince(svc, 'assistant_runs', 'user_id, created_at', 'created_at', sinceIso),
    fetchSince(
      svc,
      'api_usage_events',
      'user_id, cost_usd_cents, tokens_in, tokens_out, metadata, created_at',
      'created_at',
      sinceIso,
    ),
  ]);

  // ── Atividade por usuário ──────────────────────────────────────────────
  type Acc = { sessions: number; runs: number; spendCents: number; lastActive: string };
  const userMap = new Map<string, Acc>();
  const bump = (uid: string | null | undefined, patch: Partial<Acc>, when?: string) => {
    if (!uid) return;
    const cur = userMap.get(uid) ?? { sessions: 0, runs: 0, spendCents: 0, lastActive: '1970-01-01T00:00:00Z' };
    cur.sessions += patch.sessions ?? 0;
    cur.runs += patch.runs ?? 0;
    cur.spendCents += patch.spendCents ?? 0;
    if (when) cur.lastActive = maxIso(cur.lastActive, when);
    userMap.set(uid, cur);
  };

  const sessionInfo = new Map<string, { title: string; userId: string | null }>();
  for (const s of sessions) {
    const id = s.id as string;
    sessionInfo.set(id, { title: (s.title as string) ?? '(sem título)', userId: (s.user_id as string) ?? null });
    bump(s.user_id as string, { sessions: 1 }, s.updated_at as string);
  }
  for (const r of runs) bump(r.user_id as string, { runs: 1 }, r.created_at as string);

  // ── Gastos por sessão + por usuário + por dia (dos eventos de custo) ────
  type SessAcc = { calls: number; tokensIn: number; tokensOut: number; spendCents: number; lastAt: string };
  const sessSpend = new Map<string, SessAcc>();
  const byDayMap = new Map<string, { costCents: number; calls: number }>();
  let totalSpendCents = 0;

  for (const e of events) {
    const cost = num(e.cost_usd_cents);
    totalSpendCents += cost;
    bump(e.user_id as string, { spendCents: cost }, e.created_at as string);

    const day = String(e.created_at).slice(0, 10);
    const d = byDayMap.get(day) ?? { costCents: 0, calls: 0 };
    d.costCents += cost;
    d.calls += 1;
    byDayMap.set(day, d);

    const meta = (e.metadata ?? {}) as Record<string, unknown>;
    const sid = typeof meta.session_id === 'string' ? meta.session_id : null;
    if (!sid) continue;
    const acc = sessSpend.get(sid) ?? { calls: 0, tokensIn: 0, tokensOut: 0, spendCents: 0, lastAt: '1970-01-01T00:00:00Z' };
    acc.calls += 1;
    acc.tokensIn += num(e.tokens_in);
    acc.tokensOut += num(e.tokens_out);
    acc.spendCents += cost;
    acc.lastAt = maxIso(acc.lastAt, e.created_at as string);
    sessSpend.set(sid, acc);
  }

  const roleCounts = { admin: 0, gestor: 0, user: 0 };
  for (const p of profiles) {
    const r = (p.role ?? 'user') as keyof typeof roleCounts;
    if (r in roleCounts) roleCounts[r] += 1;
  }
  const newUsers = profiles.filter((p) => {
    const c = p.auth_created_at ?? p.created_at;
    return c ? new Date(c).getTime() >= sinceMs : false;
  }).length;

  const users = Array.from(userMap.entries())
    .map(([userId, a]) => ({
      userId,
      email: emailById.get(userId) ?? '—',
      role: roleById.get(userId) ?? 'user',
      sessions: a.sessions,
      runs: a.runs,
      spendCents: a.spendCents,
      lastActive: a.lastActive,
    }))
    .sort((a, b) => b.spendCents - a.spendCents || b.sessions - a.sessions);

  const sessionsOut = Array.from(sessSpend.entries())
    .map(([sessionId, a]) => {
      const info = sessionInfo.get(sessionId);
      return {
        sessionId,
        userId: info?.userId ?? null,
        email: info?.userId ? emailById.get(info.userId) ?? '—' : '—',
        title: info?.title ?? '(sessão fora do período)',
        calls: a.calls,
        tokensIn: a.tokensIn,
        tokensOut: a.tokensOut,
        spendCents: a.spendCents,
        lastAt: a.lastAt,
      };
    })
    .sort((a, b) => b.spendCents - a.spendCents)
    .slice(0, 200);

  const byDay = Array.from(byDayMap.entries())
    .map(([day, v]) => ({ day, costCents: v.costCents, calls: v.calls }))
    .sort((a, b) => a.day.localeCompare(b.day));

  return NextResponse.json({
    rangeDays,
    overview: {
      totalUsers: profiles.length,
      ...roleCounts,
      newUsers,
      activeUsers: userMap.size,
      totalSessions: sessions.length,
      totalRuns: runs.length,
      totalSpendCents,
      subscriptions: subsByStatus,
    },
    byDay,
    users,
    sessions: sessionsOut,
  });
}
