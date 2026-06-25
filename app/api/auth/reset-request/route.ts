import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSupabase } from '@/lib/db/supabase';
import { verifyTurnstileToken, getClientIp, hashIp } from '@/lib/captcha';
import { checkAnonRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Sub-projeto 25 — proxy de password reset com captcha + rate-limit anon.
//
// Anti-enumeration crítico: **sempre retorna 200** independente do email
// existir ou não. Tempo de resposta é constante (não esperamos o Supabase
// — fire-and-forget interno) pra não vazar via timing attack.

const Body = z.object({
  email: z.string().email(),
  captchaToken: z.string().min(1).nullable().optional(),
});

function originFrom(req: Request): string {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(req: Request) {
  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const ip = getClientIp(req);
  const captchaOk = await verifyTurnstileToken(parsed.captchaToken, ip);
  if (!captchaOk) {
    return NextResponse.json({ error: 'captcha_invalid' }, { status: 403 });
  }

  const rl = await checkAnonRateLimit('reset-request', hashIp(ip));
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', retry_after_secs: rl.retryAfterSecs },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSecs) } },
    );
  }

  const sb = getServerSupabase();
  // Fire-and-forget: não esperamos pelo erro do Supabase pra evitar leak
  // de existência de email via timing. Logamos internamente.
const appUrl =
  process.env.APP_URL ??
  process.env.NEXT_PUBLIC_APP_URL;

if (!appUrl) {
  throw new Error('APP_URL não configurada.');
}

const redirectTo =
  `${appUrl}/auth/callback?next=/reset-password`;

console.log('==========================');
console.log('RESET PASSWORD');
console.log('Origin:', originFrom(req));
console.log('RedirectTo:', redirectTo);
console.log('==========================');

void sb.auth
  .resetPasswordForEmail(parsed.email, {
    redirectTo,
    captchaToken: parsed.captchaToken ?? undefined,
  })
    .then(({ error }) => {
      if (error) {
        const msg = (error.message ?? '').toLowerCase();
        // Só log de erros estruturais; "email not found" é esperado
        // (anti-enum) e não polui o log.
        if (!msg.includes('not found') && !msg.includes('invalid')) {
          console.warn('[reset-request] supabase error:', error.message);
        }
      }
    })
    .catch((err) => {
      const m = err instanceof Error ? err.message : String(err);
      console.warn('[reset-request] swallowed:', m);
    });

  // Resposta genérica imediata (sempre 200).
  return NextResponse.json({ ok: true });
}
