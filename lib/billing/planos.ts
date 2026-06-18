import { getServerSupabase } from '@/lib/db/supabase';

export async function getPlans() {
  const sb = getServerSupabase();

  const { data, error } = await sb
    .from('plans')
    .select('*')
    .eq('is_active', true)
    .order('price', { ascending: true });

  if (error) {
    console.error('[plans] error:', error.message);
    return [];
  }

  return data ?? [];
}

export async function getPlanBySlug(slug: string) {
  const sb = getServerSupabase();

  const { data, error } = await sb
    .from('plans')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('[plans] getBySlug error:', error.message);
    return null;
  }

  return data;
}