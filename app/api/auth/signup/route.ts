import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSupabase } from '@/lib/db/supabase';
import { verifyTurnstileToken, getClientIp, hashIp } from '@/lib/captcha';
import { checkAnonRateLimit } from '@/lib/rate-limit';
import { CURRENT_LEGAL_VERSION } from '@/lib/legal/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Sub-projeto 25 — proxy de signup com captcha + IP rate-limit.
//
// Substitui o `supabaseBrowser().auth.signUp()` direto que o SignupForm fazia
// até a v0. Razão: rate-limit IP só funciona server-side; captcha verify
// também precisa server-side pra ser confiável.
//
// Fluxo:
//   1. Parse body (zod)
//   2. Verify Turnstile token via Cloudflare siteverify
//   3. Check rate-limit anon por IP_HASH
//   4. Chama auth.signUp server-side com `options.captchaToken` (defesa
//      em profundidade — Supabase Auth também valida se project tiver
//      captcha hook ligado)
//   5. Retorna { ok, checkEmail } ou erro estruturado

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  captchaToken: z.string().min(1).nullable().optional(),
  next: z.string().optional(),
  // Sub-projeto 28 — aceite explícito dos Termos + Privacidade.
  // Server exige true; client garante checkbox marcado antes do POST.
  acceptedTerms: z.literal(true),
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

  const rl = await checkAnonRateLimit('signup', hashIp(ip));
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', retry_after_secs: rl.retryAfterSecs },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSecs) } },
    );
  }

  const sb = getServerSupabase();
  const next = parsed.next ?? '/chat';
  const { data, error } = await sb.auth.signUp({
    email: parsed.email,
    password: parsed.password,
    options: {
      emailRedirectTo: `${originFrom(req)}/auth/callback?next=${encodeURIComponent(next)}`,
      captchaToken: parsed.captchaToken ?? undefined,
    },
  });
  if (error) {
    const msg = (error.message ?? '').toLowerCase();
    const code = (error as { code?: string }).code ?? '';
    if (msg.includes('already registered') || msg.includes('user already') || code === 'user_already_exists') {
      return NextResponse.json({ error: 'user_already_exists' }, { status: 409 });
    }
    if (msg.includes('password') && (msg.includes('short') || msg.includes('weak'))) {
      return NextResponse.json({ error: 'password_weak' }, { status: 400 });
    }
    return NextResponse.json({ error: 'signup_failed' }, { status: 500 });
  }

  // Sub-projeto 28 — persiste aceite explícito de Termos + Privacidade.
  // Trigger handle_new_user (migration 0003) já criou a row em profiles;
  // basta UPDATE com timestamp + version. Fire-and-forget pra não
  // bloquear o response — se falhar, log + continua (re-aceite pode ser
  // requerido em login posterior se necessário).
  if (data.user?.id) {
    void sb
      .from('profiles')
      .update({
        terms_accepted_at: new Date().toISOString(),
        terms_version: CURRENT_LEGAL_VERSION,
      })
      .eq('id', data.user.id)
      .then(({ error: updErr }) => {
        if (updErr) {
          console.warn('[signup] terms_accepted_at persist failed:', updErr.message);
        }
      });
  }

  // data.session !== null → email-confirm desligado no project; user já tá
  // logado. data.session === null → confirm on, precisa clicar no email.
  return NextResponse.json({ ok: true, checkEmail: !data.session });
}
