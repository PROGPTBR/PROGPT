import { NextResponse } from 'next/server';
import { requireAdmin, NotAdmin } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// #8 go-live — funil de validação. requireAdmin → 404 pra non-admin.
// Agrega via SQL function admin_funnel_metrics() (migration 0030).

export type FunnelByAssistant = {
  assistant_type: string;
  runs: number;
  distinct_users: number;
  done: number;
  errored: number;
};

export type FunnelMetrics = {
  signups_total: number;
  signups_7d: number;
  signups_30d: number;
  activated_total: number;
  activated_assistants: number;
  activated_chat: number;
  paid_active: number;
  paid_cancelled: number;
  by_assistant: FunnelByAssistant[];
};

export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof NotAdmin) return new NextResponse('Not Found', { status: 404 });
    throw err;
  }

  const sb = getServerSupabase();
  const { data, error } = await sb.rpc('admin_funnel_metrics');
  if (error) {
    console.warn('[admin/funnel] rpc failed:', error.message);
    return NextResponse.json({ error: 'rpc_failed' }, { status: 500 });
  }
  return NextResponse.json(data as FunnelMetrics);
}
