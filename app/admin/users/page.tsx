import { requireAdmin } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';
import { UsersTable } from '@/components/admin/UsersTable';

export const dynamic = 'force-dynamic';

type EnrichedUser = {
  id: string;
  email: string;
  role: 'admin' | 'user';
  last_sign_in_at: string | null;
  session_count: number;
  created_at: string;
};

export default async function AdminUsersPage() {
  const { user } = await requireAdmin();

  // Service-role: profiles_with_email joins auth.users, which authed users can't
  // read directly under RLS. The page is requireAdmin-gated, so service-role
  // here is safe — same pattern as the admin_user_session_counts RPC below.
  const svc = getServerSupabase();

  const { data: rows, error } = await svc
    .from('profiles_with_email')
    .select('id, email, role, last_sign_in_at, created_at')
    .order('created_at', { ascending: false });
  if (error) {
    return <p className="text-sm text-destructive">Falha ao carregar usuários: {error.message}</p>;
  }

  const { data: counts } = await svc.rpc('admin_user_session_counts');
  const map = new Map<string, number>();
  for (const r of (counts ?? []) as Array<{ user_id: string; session_count: number }>) {
    map.set(r.user_id, Number(r.session_count));
  }

  const users: EnrichedUser[] = (rows ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    email: r.email as string,
    role: (r.role as 'admin' | 'user') ?? 'user',
    last_sign_in_at: (r.last_sign_in_at as string | null) ?? null,
    created_at: r.created_at as string,
    session_count: map.get(r.id as string) ?? 0,
  }));

  return <UsersTable users={users} currentUserId={user.id} />;
}
