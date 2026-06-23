import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';
import { normalizeSettings } from '@/lib/assistants/comprador-inbox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  tone: z.enum(['cordial', 'formal', 'firme']).optional(),
  rules: z.string().max(4000).optional(),
  signature: z.string().max(1000).optional(),
  approval_required: z.boolean().optional(),
  auto_draft: z.boolean().optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const svc = getServerSupabase();
  const { data } = await svc
    .from('comprador_settings')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  return NextResponse.json({
    settings: normalizeSettings(data as Record<string, unknown> | null),
    inboundAlias: (data as { inbound_alias?: string | null } | null)?.inbound_alias ?? null,
    inboundEnabled: !!process.env.RESEND_INBOUND_DOMAIN,
  });
}

export async function PUT(req: Request) {
  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const svc = getServerSupabase();
  const row: Record<string, unknown> = {
    user_id: user.id,
    updated_at: new Date().toISOString(),
  };
  if (parsed.tone !== undefined) row.tone = parsed.tone;
  if (parsed.rules !== undefined) row.rules = parsed.rules;
  if (parsed.signature !== undefined) row.signature = parsed.signature;
  if (parsed.approval_required !== undefined) row.approval_required = parsed.approval_required;
  if (parsed.auto_draft !== undefined) row.auto_draft = parsed.auto_draft;

  const { data, error } = await svc
    .from('comprador_settings')
    .upsert(row, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) {
    console.error('[comprador/settings] upsert failed:', error.message);
    return NextResponse.json({ error: 'persist_failed' }, { status: 500 });
  }
  return NextResponse.json({ settings: normalizeSettings(data as Record<string, unknown>) });
}
