import { getServerSupabase } from '@/lib/db/supabase';
import { sendEmail } from '@/lib/email/client';
import { buildWelcomeEmail } from '@/lib/email/templates';
import { generateMagicLink } from '@/lib/email/magic-link';

// Envia o welcome email 1x por usuário, idempotente via
// profiles.welcome_email_sent_at (lock-then-send: marca ANTES de enviar —
// se o send falhar, perdemos o welcome mas evitamos double-send).
//
// Chamado de 3 pontos, de propósito redundantes, porque o link de
// confirmação do Supabase pode chegar por caminhos diferentes dependendo
// do flow (implicit vs PKCE) e do template configurado no dashboard:
//   - app/auth/callback/route.ts  (troca de `code` — PKCE / OAuth)
//   - app/auth/confirm/route.ts   (verifyOtp por `token_hash`)
//   - POST /api/account/welcome-email (fallback client-side, chamado 1x ao
//     montar o app autenticado — cobre o caso em que a sessão é
//     estabelecida no browser via fragment de URL, sem passar por
//     nenhuma das duas rotas de servidor acima)
export async function ensureWelcomeEmailSent(
  userId: string,
  email: string,
): Promise<void> {
  const svc = getServerSupabase();

  const { data, error } = await svc
    .from('profiles')
    .update({ welcome_email_sent_at: new Date().toISOString() })
    .eq('id', userId)
    .is('welcome_email_sent_at', null)
    .select('id');

  if (error) {
    console.warn('[welcome-email] lock update falhou:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    // Já foi enviado antes (ou outro caller ganhou a corrida) — noop.
    return;
  }

  // Fail-soft: se a geração do magic link falhar, o template cai no botão
  // de sempre (/chat) — nunca bloqueia o envio do welcome email por causa
  // disso.
  const magicLink = await generateMagicLink(email);

  const tpl = buildWelcomeEmail({ email, magicLink });
  const result = await sendEmail({
    to: email,
    subject: tpl.subject,
    html: tpl.html,
    idempotencyKey: `welcome:${userId}`,
  });

  if (!result.ok) {
    console.warn('[welcome-email] sendEmail falhou pra', userId);
  }
}

// Reenvio manual (admin), sem passar pelo lock de "1x por usuário" — usado
// quando o cliente relata que não recebeu (ex.: cadastrou antes do fix do
// gatilho, ou quer forçar um novo magic link porque o antigo expirou).
// idempotencyKey é sufixado com o timestamp pra NÃO colidir com o
// `welcome:${userId}` do primeiro envio (Resend rejeita idempotency_key
// duplicada por 24h — sem isso um reenvio de verdade seria descartado
// silenciosamente como duplicata do envio original).
export async function resendWelcomeEmail(
  userId: string,
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  const svc = getServerSupabase();

  const magicLink = await generateMagicLink(email);
  const tpl = buildWelcomeEmail({ email, magicLink });
  const result = await sendEmail({
    to: email,
    subject: tpl.subject,
    html: tpl.html,
    idempotencyKey: `welcome-resend:${userId}:${Date.now()}`,
  });

  const { error } = await svc
    .from('profiles')
    .update({ welcome_email_sent_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) {
    console.warn('[welcome-email] resend: falha ao atualizar timestamp:', error.message);
  }

  if (!result.ok) {
    console.warn('[welcome-email] resend: sendEmail falhou pra', userId, result.error);
  }
  return { ok: result.ok, error: result.error };
}
