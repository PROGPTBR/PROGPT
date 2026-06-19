import type { User } from '@supabase/supabase-js';
import { supabaseServer } from '@/lib/db/supabase-server';

{/* 
export type Profile = {
  id: string;
  role: 'user' | 'admin';
  display_name: string | null;
};
*/}

export type Profile = {
  id: string;
  role: 'user' | 'admin';
  display_name: string | null;

  full_name: string | null;
  cpf_cnpj: string | null;
  phone: string | null;

  plan: string | null;
  selected_plan: string | null;

  asaas_customer_id: string | null;
  asaas_subscription_id: string | null;
  subscription_status: string | null;
};

export class NotAuthenticated extends Error {
  constructor() {
    super('NOT_AUTHENTICATED');
    this.name = 'NotAuthenticated';
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const {
    data: { user },
  } = await supabaseServer().auth.getUser();
  return user ?? null;
}

export async function requireUser(): Promise<User> {
  const u = await getCurrentUser();
  if (!u) throw new NotAuthenticated();
  return u;
}

{/* 
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabaseServer()
    .from('profiles')
    .select('id, role, display_name')
    .eq('id', userId)
    .maybeSingle();
  if (error) return null;
  return (data as Profile | null) ?? null;
}
*/}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabaseServer()
    .from('profiles')
    .select(`
  id,
  role,
  display_name,

  full_name,
  cpf_cnpj,
  phone,
  professional_requirement,

  plan,
  selected_plan,

  asaas_customer_id,
  asaas_subscription_id,
  subscription_status
`)
    .eq('id', userId)
    .maybeSingle();
  if (error) return null;
  return (data as Profile | null) ?? null;
}

export class NotAdmin extends Error {
  constructor() {
    super('NOT_ADMIN');
    this.name = 'NotAdmin';
  }
}

export async function requireAdmin(): Promise<{ user: User; profile: Profile }> {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  if (!profile || profile.role !== 'admin') throw new NotAdmin();
  return { user, profile };
}
