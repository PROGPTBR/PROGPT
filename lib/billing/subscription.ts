import { getServerSupabase } from '@/lib/db/supabase';

// ============================
// TYPES
// ============================

export type Subscription = {
  id: string;
  user_id: string;
  asaas_customer_id: string | null;
  asaas_subscription_id: string | null;
  status: 'pending' | 'active' | 'past_due' | 'cancelled' | 'expired';
  plan: string;
  payment_method: 'credit_card' | 'pix' | 'boleto' | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

// ============================
// SUBSCRIPTION
// ============================

export async function getSubscription(userId: string): Promise<Subscription | null> {
  const sb = getServerSupabase();

  const { data, error } = await sb
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.warn('[billing] getSubscription failed:', error.message);
    return null;
  }

  return (data as Subscription) ?? null;
}

export async function getActiveSubscription(
  userId: string,
): Promise<Subscription | null> {
  const sub = await getSubscription(userId);
  if (!sub) return null;

  if (sub.status === 'active') return sub;

  if (sub.status === 'past_due') {
    if (
      sub.current_period_end &&
      new Date(sub.current_period_end) > new Date()
    ) {
      return sub;
    }
  }

  return null;
}

// ============================
// PAYWALL
// ============================

export async function isPro(userId: string): Promise<boolean> {
  const sb = getServerSupabase();

  const { data: profile } = await sb
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if ((profile as { role?: string } | null)?.role === 'admin') return true;

  const sub = await getActiveSubscription(userId);
  return sub !== null;
}

// ============================
// PLANS
// ============================

export async function getPlanBySlug(slug: string) {
  const sb = getServerSupabase();

  const { data, error } = await sb
    .from('plans')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) {
    console.warn('[billing] getPlanBySlug failed:', error?.message);
    return null;
  }

  return data as {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    price: number;
    currency: string;
    interval: string;
    features: string[] | string;
    is_active: boolean;
  };
}

// ============================
// FEATURES
// ============================

function normalizeFeatures(features: unknown): string[] {
  if (!features) return [];

  if (Array.isArray(features)) return features;

  if (typeof features === 'string') {
    try {
      const parsed = JSON.parse(features);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

export async function hasFeature(
  userId: string,
  feature: string,
): Promise<boolean> {
  const sub = await getActiveSubscription(userId);
  if (!sub) return false;

  const sb = getServerSupabase();

  const { data: plan } = await sb
    .from('plans')
    .select('features')
    .eq('slug', sub.plan)
    .maybeSingle();

  const features = normalizeFeatures(plan?.features);

  return features.includes(feature);
}

// ============================
// USER PLAN
// ============================

export async function getUserPlan(userId: string): Promise<string> {
  const sub = await getActiveSubscription(userId);
  if (!sub) return 'free';
  return sub.plan;
}