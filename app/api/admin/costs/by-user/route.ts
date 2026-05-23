import { NextResponse } from 'next/server';
import { requireAdmin, NotAdmin } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Row = {
  user_id: string | null;
  user_email: string | null;
  call_count: number;
  tokens_in: number;
  tokens_out: number;
  tokens_cached: number;
  cost_usd_cents: string; // numeric → string from Supabase
  by_operation: Array<{
    operation: string;
    callCount: number;
    costUsdCents: string | number;
  }>;
};

export type CostsByUserResponse = {
  rangeDays: number;
  users: Array<{
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
  }>;
};

const ALLOWED_RANGES = [1, 7, 30, 90] as const;

export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof NotAdmin)
      return new NextResponse('Not Found', { status: 404 });
    throw err;
  }

  const url = new URL(req.url);
  const rangeRaw = Number(url.searchParams.get('range') ?? 30);
  const rangeDays = (ALLOWED_RANGES as readonly number[]).includes(rangeRaw)
    ? rangeRaw
    : 30;

  const sb = getServerSupabase();
  const { data, error } = await sb.rpc('admin_api_usage_by_user', {
    p_days: rangeDays,
  });
  if (error) {
    console.warn('[admin/costs/by-user] rpc failed:', error.message);
    return NextResponse.json({ error: 'rpc_failed' }, { status: 500 });
  }

  const rows = (data ?? []) as Row[];
  const users = rows.map((r) => ({
    userId: r.user_id,
    userEmail: r.user_email,
    callCount: Number(r.call_count),
    tokensIn: Number(r.tokens_in),
    tokensOut: Number(r.tokens_out),
    tokensCached: Number(r.tokens_cached),
    costUsdCents: Number(r.cost_usd_cents),
    byOperation: (r.by_operation ?? []).map((op) => ({
      operation: op.operation,
      callCount: Number(op.callCount),
      costUsdCents: Number(op.costUsdCents),
    })),
  }));

  const body: CostsByUserResponse = { rangeDays, users };
  return NextResponse.json(body);
}
