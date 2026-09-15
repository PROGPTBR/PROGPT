import type { User } from '@supabase/supabase-js';
import { supabaseServer } from '@/lib/db/supabase-server';

export type Profile = {
  id: string;
  role: 'user' | 'admin' | 'gestor';
  display_name: string | null;

  full_name: string | null;
  cpf_cnpj: string | null;
  phone: string | null;
  professional_requirement: string | null;

  plan: string | null;
  selected_plan: string | null;

  asaas_customer_id: string | null;
  asaas_subscription_id: string | null;
  subscription_status: string | null;

  // Fundação "Plataforma" — org_id é NOT NULL no banco (todo usuário tem
  // uma org, mesmo que seja a org default 'progpt-default'); super_admin é
  // um flag GLOBAL ortogonal a `role` (não um valor de role) — espelha o
  // padrão verificado no CRM-2Mimobi: papel de org e flag de plataforma são
  // independentes. Ambas as colunas são guardadas por trigger no banco
  // (guard_plataforma_columns, migration 0053) — só service-role escreve.
  org_id: string;
  super_admin: boolean;
};

export type SubscriptionStatus =
  | 'pending'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'cancelled'
  | 'expired';

export type Subscription = {
  id: string;
  user_id: string;

  status: SubscriptionStatus;
  plan: string;
  plan_slug: string | null;

  trial_end: string | null;

  current_period_start: string | null;
  current_period_end: string | null;

  cancel_at_period_end: boolean;
  cancelled_at: string | null;

  next_due_date: string | null;
  last_payment_at: string | null;

  asaas_customer_id: string | null;
  asaas_subscription_id: string | null;

  created_at: string;
  updated_at: string;
};

export class NotAuthenticated extends Error {
  constructor() {
    super('NOT_AUTHENTICATED');
    this.name = 'NotAuthenticated';
  }
}

// ============================================================
// USUÁRIO ATUAL
// ============================================================

export async function getCurrentUser(): Promise<User | null> {
  const {
    data: { user },
    error,
  } = await supabaseServer().auth.getUser();

  if (error) {
    return null;
  }

  return user ?? null;
}

// ============================================================
// EXIGE LOGIN
// ============================================================

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();

  if (!user) {
    throw new NotAuthenticated();
  }

  return user;
}

// ============================================================
// PERFIL
// ============================================================

export async function getProfile(
  userId: string,
): Promise<Profile | null> {
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
      subscription_status,

      org_id,
      super_admin
    `)
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('[getProfile] Erro ao buscar perfil:', error);
    return null;
  }

  return (data as Profile | null) ?? null;
}

// ============================================================
// ASSINATURA
// ============================================================

export async function getSubscription(
  userId: string,
): Promise<Subscription | null> {
  const { data, error } = await supabaseServer()
    .from('subscriptions')
    .select(`
      id,
      user_id,
      status,
      plan,
      plan_slug,
      trial_end,
      current_period_start,
      current_period_end,
      cancel_at_period_end,
      cancelled_at,
      next_due_date,
      last_payment_at,
      asaas_customer_id,
      asaas_subscription_id,
      created_at,
      updated_at
    `)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error(
      '[getSubscription] Erro ao buscar assinatura:',
      error,
    );

    return null;
  }

  return (data as Subscription | null) ?? null;
}

// ============================================================
// HELPERS DE ASSINATURA
// ============================================================

export function isTrialActive(
  subscription: Subscription | null,
): boolean {
  if (
    subscription?.status !== 'trialing' ||
    !subscription.trial_end
  ) {
    return false;
  }

  return (
    new Date(subscription.trial_end).getTime() >
    Date.now()
  );
}

export function isTrialExpired(
  subscription: Subscription | null,
): boolean {
  if (!subscription) {
    return false;
  }

  if (
    subscription.status !== 'trialing' ||
    !subscription.trial_end
  ) {
    return false;
  }

  return (
    new Date(subscription.trial_end).getTime() <=
    Date.now()
  );
}

export function isSubscriptionActive(
  subscription: Subscription | null,
): boolean {
  if (subscription?.status !== 'active') {
    return false;
  }

  if (!subscription.current_period_end) {
    return true;
  }

  return (
    new Date(subscription.current_period_end).getTime() >
    Date.now()
  );
}

// ============================================================
// ADMIN
// ============================================================

export class NotAdmin extends Error {
  constructor() {
    super('NOT_ADMIN');
    this.name = 'NotAdmin';
  }
}

export async function requireAdmin(): Promise<{
  user: User;
  profile: Profile;
}> {
  const user = await requireUser();
  const profile = await getProfile(user.id);

  if (!profile || profile.role !== 'admin') {
    throw new NotAdmin();
  }

  return {
    user,
    profile,
  };
}

// ============================================================
// STAFF
//
// Admin  = acesso total
// Gestor = monitoramento/operação
// User   = cliente
// ============================================================

export function isStaff(
  profile: Profile | null,
): boolean {
  return (
    profile?.role === 'admin' ||
    profile?.role === 'gestor'
  );
}

export class NotStaff extends Error {
  constructor() {
    super('NOT_STAFF');
    this.name = 'NotStaff';
  }
}

export async function requireStaff(): Promise<{
  user: User;
  profile: Profile;
}> {
  const user = await requireUser();
  const profile = await getProfile(user.id);

  if (!isStaff(profile)) {
    throw new NotStaff();
  }

  return {
    user,
    profile: profile!,
  };
}

// ============================================================
// SUPER ADMIN (fundação "Plataforma")
//
// Flag GLOBAL, ortogonal a `role`/isStaff — administra TODAS as orgs
// (tenants), não só o conteúdo/usuários da própria. Gate de
// /plataforma/*, nunca de /admin/* (que continua em requireAdmin/
// requireStaff).
// ============================================================

export function isSuperAdmin(profile: Profile | null): boolean {
  return profile?.super_admin === true;
}

export class NotSuperAdmin extends Error {
  constructor() {
    super('NOT_SUPER_ADMIN');
    this.name = 'NotSuperAdmin';
  }
}

export async function requireSuperAdmin(): Promise<{
  user: User;
  profile: Profile;
}> {
  const user = await requireUser();
  const profile = await getProfile(user.id);

  if (!isSuperAdmin(profile)) {
    throw new NotSuperAdmin();
  }

  return {
    user,
    profile: profile!,
  };
}