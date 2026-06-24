import { getServerSupabase } from '@/lib/db/supabase';

// Bucket privado das invoices do Spend Analysis. USER-scoped (cada usuário só
// acessa a própria pasta <user_id>/...) — ver scripts/bootstrap_spend_storage.py.
// O worker usa service-role (bypassa RLS), igual lib/db/storage.ts.

export const SPEND_BUCKET = 'spend-uploads';

export async function uploadToSpendBucket(
  path: string,
  buf: Buffer,
  contentType: string,
): Promise<void> {
  const sb = getServerSupabase();
  const { error } = await sb.storage
    .from(SPEND_BUCKET)
    .upload(path, buf, { contentType, upsert: false });
  if (error) throw new Error(`spend storage upload failed: ${error.message}`);
}

export async function downloadFromSpendBucket(path: string): Promise<Buffer> {
  const sb = getServerSupabase();
  const { data, error } = await sb.storage.from(SPEND_BUCKET).download(path);
  if (error || !data) {
    throw new Error(`spend storage download failed: ${error?.message ?? 'no data'}`);
  }
  return Buffer.from(await data.arrayBuffer());
}

export async function deleteFromSpendBucket(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const sb = getServerSupabase();
  await sb.storage.from(SPEND_BUCKET).remove(paths);
}
