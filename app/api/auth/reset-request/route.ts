import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSupabase } from '@/lib/db/supabase';
import { verifyTurnstileToken, getClientIp, hashIp } from '@/lib/captcha';
import { checkAnonRateLimit } from '@/lib/rate-limit';
import { configuredAppUrl, isRetiredAppHost } from '@/lib/app-url';


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
  // Em desenvolvimento, o link precisa voltar para a instância que originou
  // a solicitação. O .env.local também pode conter a URL de produção para
  // outros fluxos; usá-la aqui faria todo reset local abrir o app publicado.
  if (process.env.APP_ENV === 'local' || process.env.APP_ENV === 'ci') {
    const url = new URL(req.url);
    return `${url.protocol}//${url.host}`;
  }

  const configuredUrl = configuredAppUrl();
  if (configuredUrl) return configuredUrl;

  const forwardedHost = req.headers.get('x-forwarded-host');
  if (forwardedHost && !isRetiredAppHost(forwardedHost)) {
    const protocol = req.headers.get('x-forwarded-proto') || 'https';
    return `${protocol}://${forwardedHost}`;
  }

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
  const redirectTo = `${originFrom(req)}/reset-password`;

  // Aguarda o Supabase antes de responder: em runtimes serverless uma promise
  // solta pode ser encerrada junto com a requisição. O token não é repassado,
  // pois já foi consumido pelo Siteverify e tokens Turnstile são de uso único.
  try {
    const { error } = await sb.auth.resetPasswordForEmail(parsed.email, {
      redirectTo,
    });
    if (error) {
      const msg = (error.message ?? '').toLowerCase();

      if (!msg.includes('not found') && !msg.includes('invalid')) {
        console.warn('[reset-request] supabase error:', error.message);
      }
    }
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    console.warn('[reset-request] swallowed:', m);
  }

  // Resposta genérica (sempre 200), inclusive para email inexistente.
  return NextResponse.json({ ok: true });
}
