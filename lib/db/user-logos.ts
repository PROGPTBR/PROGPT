import { getServerSupabase } from './supabase';

// Sub-projeto 22 — Logo do usuário
//
// Helpers around the `user-logos` Storage bucket. All writes go via
// service-role (consistent with admin_write_endpoints_use_service_role
// memory) — RLS on the bucket is owner-scoped for cookie-aware reads
// from the UI preview, but server-side mutations bypass it.

const BUCKET = 'user-logos';
export const LOGO_BUCKET = BUCKET;

export type LogoMime = 'image/png' | 'image/jpeg';

export function isAcceptedLogoMime(m: string): m is LogoMime {
  return m === 'image/png' || m === 'image/jpeg';
}

function extFor(mime: LogoMime): 'png' | 'jpg' {
  return mime === 'image/png' ? 'png' : 'jpg';
}

// Storage path convention: <user_id>/logo.<ext>. We overwrite on every
// upload — only one logo per user.
function pathFor(userId: string, mime: LogoMime): string {
  return `${userId}/logo.${extFor(mime)}`;
}

export async function uploadUserLogo(
  userId: string,
  bytes: Buffer,
  mime: LogoMime,
): Promise<{ path: string } | { error: string }> {
  const sb = getServerSupabase();

  // If the user previously uploaded a different format, the old object
  // remains until we delete it (different extension). Clean up first.
  await deleteAllForUser(userId);

  const path = pathFor(userId, mime);
  const { error: upErr } = await sb.storage
    .from(BUCKET)
    .upload(path, bytes, {
      contentType: mime,
      upsert: true,
      cacheControl: '3600',
    });
  if (upErr) {
    console.warn('[user-logos] upload failed:', upErr.message);
    return { error: upErr.message };
  }

  const { error: profErr } = await sb
    .from('profiles')
    .update({ logo_path: path, logo_mime: mime })
    .eq('id', userId);
  if (profErr) {
    console.warn('[user-logos] profile update failed:', profErr.message);
    return { error: profErr.message };
  }

  return { path };
}

export async function deleteUserLogo(userId: string): Promise<boolean> {
  await deleteAllForUser(userId);
  const sb = getServerSupabase();
  const { error } = await sb
    .from('profiles')
    .update({ logo_path: null, logo_mime: null })
    .eq('id', userId);
  if (error) {
    console.warn('[user-logos] profile clear failed:', error.message);
    return false;
  }
  return true;
}

async function deleteAllForUser(userId: string): Promise<void> {
  const sb = getServerSupabase();
  // Best-effort: remove any extension we ever wrote for this user.
  const candidates = [`${userId}/logo.png`, `${userId}/logo.jpg`];
  const { error } = await sb.storage.from(BUCKET).remove(candidates);
  if (error) {
    // Not a hard failure — file may not exist. Storage returns success
    // even when removing missing files in most cases.
    console.warn('[user-logos] cleanup hint:', error.message);
  }
}

export async function getUserLogoBuffer(
  userId: string,
): Promise<{ buffer: Buffer; mime: LogoMime } | null> {
  const sb = getServerSupabase();
  const { data: profile, error: profErr } = await sb
    .from('profiles')
    .select('logo_path, logo_mime')
    .eq('id', userId)
    .maybeSingle();
  if (profErr || !profile) return null;
  const row = profile as { logo_path: string | null; logo_mime: string | null };
  if (!row.logo_path || !row.logo_mime || !isAcceptedLogoMime(row.logo_mime)) {
    return null;
  }

  const { data, error } = await sb.storage.from(BUCKET).download(row.logo_path);
  if (error || !data) {
    console.warn(
      '[user-logos] download failed:',
      error?.message ?? 'no data',
      'for path',
      row.logo_path,
    );
    return null;
  }
  const arr = await data.arrayBuffer();
  return { buffer: Buffer.from(arr), mime: row.logo_mime };
}
