import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, NotAdmin } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';
import { supabaseServer } from '@/lib/db/supabase-server';
// supabaseServer is used by PATCH (so admins update profiles via RLS); GET uses
// service-role because profiles_with_email joins auth.users (no SELECT for authed).

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const InviteBody = z.object({ email: z.string().email() });
const PatchBody = z.object({
  user_id: z.string().uuid(),
  role: z.enum(['user', 'admin']),
});

function originFrom(req: Request): string {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(req: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof NotAdmin) return new NextResponse('Not Found', { status: 404 });
    throw err;
  }
  void admin;
  let parsed;
  try {
    parsed = InviteBody.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const sb = getServerSupabase();
  const { error } = await sb.auth.admin.inviteUserByEmail(parsed.email, {
    redirectTo: `${originFrom(req)}/auth/callback?next=/reset-password`,
  });
  if (error) {
    const code = (error as { code?: string }).code ?? '';
    if (/already.*registered|exists/i.test(error.message) || code === 'email_exists') {
      return NextResponse.json({ error: 'user_already_exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'invite_failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof NotAdmin) return new NextResponse('Not Found', { status: 404 });
    throw err;
  }
  let parsed;
  try {
    parsed = PatchBody.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  if (parsed.user_id === admin.user.id && parsed.role === 'user') {
    return NextResponse.json({ error: 'cannot_self_demote' }, { status: 400 });
  }
  const sb = supabaseServer();
  const { error } = await sb
    .from('profiles')
    .update({ role: parsed.role })
    .eq('id', parsed.user_id);
  if (error) {
    return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function GET() {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof NotAdmin) return new NextResponse('Not Found', { status: 404 });
    throw err;
  }
  void admin;
  // Service-role: profiles_with_email joins auth.users which authed users can't
  // SELECT directly even with security_invoker. Route is requireAdmin-gated.
  const svc = getServerSupabase();
  const { data: rows, error } = await svc
    .from('profiles_with_email')
    .select('id, email, role, last_sign_in_at, created_at, auth_created_at');
  if (error) return NextResponse.json({ error: 'list_failed' }, { status: 500 });

  const { data: counts } = await svc.rpc('admin_user_session_counts');
  const map = new Map<string, number>();
  for (const r of (counts ?? []) as Array<{ user_id: string; session_count: number }>) {
    map.set(r.user_id, Number(r.session_count));
  }

  const enriched = (rows ?? []).map((r: Record<string, unknown>) => ({
    ...r,
    session_count: map.get(r.id as string) ?? 0,
  }));
  return NextResponse.json({ users: enriched });
}
