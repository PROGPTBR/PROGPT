import { supabaseServer } from '@/lib/db/supabase-server';
import { getServerSupabase } from '@/lib/db/supabase';

export const RATE_LIMIT_PER_MIN = 10;
export const RATE_LIMIT_PER_HOUR = 60;

// Sub-projeto 25 — limites generosos pré-auth (3 signup/min, 10/hora por IP).
// Suficiente pra usuário humano (esquece senha, tenta de novo); restritivo
// pra bot. Mesmo bucket pra signup e reset-request — anti-abuse por endpoint.
export const ANON_RATE_PER_MIN = 3;
export const ANON_RATE_PER_HOUR = 10;

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSecs: number };

type RpcRow = { allowed: boolean; retry_after_secs: number };

export async function checkChatRateLimit(): Promise<RateLimitResult> {
  const sb = supabaseServer();
  const { data, error } = await sb.rpc('check_rate_limit', {
    p_endpoint: 'chat',
    p_per_min: RATE_LIMIT_PER_MIN,
    p_per_hour: RATE_LIMIT_PER_HOUR,
  });

  // Fail-open: if the RPC fails for any reason, do not shut down chat for all
  // users. The risk of one user occasionally bypassing the limit is much lower
  // than the risk of the product being unusable due to an RPC regression.
  if (error || !Array.isArray(data) || data.length === 0) {
    if (error) console.warn('[rate-limit] RPC failed, fail-open:', error.message);
    return { allowed: true };
  }

  const row = data[0] as RpcRow;
  if (row.allowed) return { allowed: true };
  return { allowed: false, retryAfterSecs: row.retry_after_secs };
}

/**
 * Rate-limit anônimo por IP (pré-auth). Usado em /api/auth/signup e
 * /api/auth/reset-request. Chamado via service-role pq o cliente não tem
 * cookie de sessão ainda.
 *
 * `ipHash` = sha256(ip + APP_SECRET) — passar `hashIp()` do lib/captcha.ts.
 * Quando vazio (dev sem proxy), a RPC retorna `allowed=true` por design —
 * captcha cobre o caso.
 */
export async function checkAnonRateLimit(
  endpoint: 'signup' | 'reset-request',
  ipHash: string,
  perMin: number = ANON_RATE_PER_MIN,
  perHour: number = ANON_RATE_PER_HOUR,
): Promise<RateLimitResult> {
  const sb = getServerSupabase();
  const { data, error } = await sb.rpc('check_rate_limit_anon', {
    p_ip_hash: ipHash,
    p_endpoint: endpoint,
    p_per_min: perMin,
    p_per_hour: perHour,
  });

  if (error || !Array.isArray(data) || data.length === 0) {
    if (error) console.warn('[rate-limit-anon] RPC failed, fail-open:', error.message);
    return { allowed: true };
  }

  const row = data[0] as RpcRow;
  if (row.allowed) return { allowed: true };
  return { allowed: false, retryAfterSecs: row.retry_after_secs };
}
