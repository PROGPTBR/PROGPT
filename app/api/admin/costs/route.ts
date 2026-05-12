import { NextResponse } from 'next/server';
import { requireAdmin, NotAdmin } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Row = {
  day: string;
  provider: string;
  operation: string;
  call_count: number;
  tokens_in: number;
  tokens_out: number;
  tokens_cached: number;
  cost_usd_cents: string; // numeric → string from Supabase
};

export type CostsResponse = {
  rangeDays: number;
  daily: Array<{
    day: string;
    provider: string;
    operation: string;
    callCount: number;
    tokensIn: number;
    tokensOut: number;
    tokensCached: number;
    costUsdCents: number;
  }>;
  totals: {
    callCount: number;
    tokensIn: number;
    tokensOut: number;
    tokensCached: number;
    costUsdCents: number;
  };
};

const ALLOWED_RANGES = [1, 7, 30, 90] as const;

export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof NotAdmin) return new NextResponse('Not Found', { status: 404 });
    throw err;
  }

  const url = new URL(req.url);
  const rangeRaw = Number(url.searchParams.get('range') ?? 30);
  const rangeDays = (ALLOWED_RANGES as readonly number[]).includes(rangeRaw) ? rangeRaw : 30;

  const sb = getServerSupabase();
  const { data, error } = await sb.rpc('admin_api_usage_daily', { p_days: rangeDays });
  if (error) {
    console.warn('[admin/costs] rpc failed:', error.message);
    return NextResponse.json({ error: 'rpc_failed' }, { status: 500 });
  }

  const rows = (data ?? []) as Row[];
  const daily = rows.map((r) => ({
    day: r.day,
    provider: r.provider,
    operation: r.operation,
    callCount: Number(r.call_count),
    tokensIn: Number(r.tokens_in),
    tokensOut: Number(r.tokens_out),
    tokensCached: Number(r.tokens_cached),
    costUsdCents: Number(r.cost_usd_cents),
  }));

  const totals = daily.reduce(
    (acc, r) => ({
      callCount: acc.callCount + r.callCount,
      tokensIn: acc.tokensIn + r.tokensIn,
      tokensOut: acc.tokensOut + r.tokensOut,
      tokensCached: acc.tokensCached + r.tokensCached,
      costUsdCents: acc.costUsdCents + r.costUsdCents,
    }),
    { callCount: 0, tokensIn: 0, tokensOut: 0, tokensCached: 0, costUsdCents: 0 },
  );

  const body: CostsResponse = { rangeDays, daily, totals };
  return NextResponse.json(body);
}
