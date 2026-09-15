import { NextResponse } from 'next/server';
import { requireSuperAdmin, NotSuperAdmin } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/plataforma/users — cross-org user listing (profiles_with_email
// já expõe org_id/super_admin desde a migration 0053). service-role: a view
// tem security_invoker e authenticated não enxerga auth.users diretamente
// (ver nota em CLAUDE.md sobre profiles_with_email).
export async function GET() {
  try {
    await requireSuperAdmin();
  } catch (err) {
    if (err instanceof NotSuperAdmin) return new NextResponse('Not Found', { status: 404 });
    throw err;
  }

  const svc = getServerSupabase();
  const [{ data: users, error }, { data: orgs, error: orgsError }] = await Promise.all([
    svc
      .from('profiles_with_email')
      .select('id, email, role, display_name, org_id, super_admin, banned_until, created_at')
      .order('created_at', { ascending: false }),
    svc.from('orgs').select('id, name, slug'),
  ]);

  if (error || orgsError) return NextResponse.json({ error: 'query_failed' }, { status: 500 });

  const orgById = new Map((orgs ?? []).map((o) => [o.id, o]));

  return NextResponse.json({
    users: (users ?? []).map((u) => ({
      ...u,
      active: !u.banned_until || new Date(u.banned_until).getTime() <= Date.now(),
      org: orgById.get(u.org_id) ?? null,
    })),
    orgs: orgs ?? [],
  });
}
