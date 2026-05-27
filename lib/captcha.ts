import { createHash } from 'node:crypto';

// Sub-projeto 25 — Cloudflare Turnstile verify + IP hash pra rate-limit anon.
//
// Turnstile substitui reCAPTCHA: grátis ilimitado, LGPD-friendly (sem coleta
// avançada), e o Supabase Auth aceita captchaToken nativamente em signUp /
// resetPasswordForEmail. Aqui usamos como defesa em profundidade:
//   1. Widget no client gera token
//   2. /api/auth/* verifica token server-side antes de qualquer chamada DB
//   3. Token também é passado pro Supabase (se Auth captcha hook tiver ligado)

const TURNSTILE_VERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// Test keys públicas da Cloudflare — sempre passam ou sempre falham.
// Pra testes locais sem setup de Cloudflare account.
// Site key "1x00000000000000000000AA" + secret "1x0000000000000000000000000000000AA"
// = always pass.
// Ver https://developers.cloudflare.com/turnstile/troubleshooting/testing/
const TEST_SECRET_ALWAYS_PASS = '1x0000000000000000000000000000000AA';

/**
 * Verifica um token do Turnstile contra a API da Cloudflare. Retorna true só
 * se o token é válido e foi resolvido recentemente (Cloudflare expira em ~5
 * min). Em produção sem `TURNSTILE_SECRET_KEY` configurado: retorna false
 * (fail-closed) — sem captcha não dá pra abrir o endpoint.
 *
 * Em dev/test (`APP_ENV === 'local'` OU `APP_ENV === 'ci'`): pula a verificação
 * e retorna true. Permite smoke local sem ter que setar keys reais.
 */
export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string | null,
): Promise<boolean> {
  const env = process.env.APP_ENV ?? 'production';
  if (env === 'local' || env === 'ci') return true;

  if (!token) return false;
  const secret = process.env.TURNSTILE_SECRET_KEY ?? TEST_SECRET_ALWAYS_PASS;
  if (!secret) return false;

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp) body.set('remoteip', remoteIp);
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      // Timeout curto: se Cloudflare estiver instável, melhor falhar rápido
      // do que pendurar o request.
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.warn('[captcha] siteverify HTTP', res.status);
      return false;
    }
    const data = (await res.json()) as { success: boolean };
    return data.success === true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[captcha] siteverify failed:', msg);
    return false;
  }
}

/**
 * Extrai o IP do cliente de um Request. Railway proxa via x-forwarded-for
 * (primeiro IP da lista é o cliente real). Em ambientes sem proxy o header
 * pode vir vazio — fallback null, RPC trata.
 */
export function getClientIp(req: Request): string | null {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const xRealIp = req.headers.get('x-real-ip');
  if (xRealIp) return xRealIp.trim();
  return null;
}

/**
 * Hash de IP com salt do APP_SECRET. Pra que o IP nunca seja armazenado cru
 * em `rate_limit_events_anon`. Se APP_SECRET não setado: fallback string
 * fixa (dev) — em prod o env var é obrigatório (validar no deploy).
 *
 * Output: 32 chars (slice do sha256 hex). Suficiente pra evitar colisões
 * práticas em rate-limit bucket.
 */
export function hashIp(ip: string | null): string {
  if (!ip) return '';
  const salt = process.env.APP_SECRET ?? 'dev-salt-only';
  return createHash('sha256').update(ip + salt).digest('hex').slice(0, 32);
}
