import { unstable_cache } from 'next/cache';
import { getPublicSupabase, getServerSupabase } from '@/lib/db/supabase';
import type { ProductUpdate, ProductUpdateInput } from './types';

export const PRODUCT_UPDATES_CACHE_TAG = 'product-updates';

async function queryPublicUpdates(): Promise<ProductUpdate[]> {
  const { data, error } = await getPublicSupabase()
    .from('product_updates')
    .select('*')
    .order('published_at', { ascending: false });

  if (error) throw new Error(`Falha ao carregar atualizações: ${error.message}`);
  return (data ?? []) as ProductUpdate[];
}

// A janela curta garante que uma publicação agendada apareça logo depois
// de published_at, mesmo sem uma nova mutação para disparar revalidateTag.
export const listPublicUpdates = unstable_cache(
  queryPublicUpdates,
  ['public-product-updates'],
  { tags: [PRODUCT_UPDATES_CACHE_TAG], revalidate: 60 },
);

export async function listAdminUpdates(): Promise<ProductUpdate[]> {
  const { data, error } = await getServerSupabase()
    .from('product_updates')
    .select('*')
    .order('published_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ProductUpdate[];
}

export async function createProductUpdate(
  input: ProductUpdateInput,
  userId: string,
): Promise<ProductUpdate> {
  const { data, error } = await getServerSupabase()
    .from('product_updates')
    .insert({ ...input, created_by: userId, updated_by: userId })
    .select('*')
    .single();
  if (error) throw error;
  return data as ProductUpdate;
}

export async function updateProductUpdate(
  id: string,
  patch: Partial<ProductUpdateInput>,
  userId: string,
): Promise<ProductUpdate | null> {
  const { data, error } = await getServerSupabase()
    .from('product_updates')
    .update({ ...patch, updated_by: userId, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data as ProductUpdate | null;
}

export async function deleteProductUpdate(id: string): Promise<boolean> {
  const { data, error } = await getServerSupabase()
    .from('product_updates')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}
