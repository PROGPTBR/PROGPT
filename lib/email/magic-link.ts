import { getServerSupabase } from '@/lib/db/supabase';
import { getAppUrl } from '@/lib/email/client';

// Gera um link de acesso automático (magic link nativo do Supabase) pra
// embutir em e-mails transacionais — o cliente clica e já cai logado no
// /chat, sem digitar e-mail/senha. Fail-soft: retorna null em qualquer
// erro (nunca deve derrubar o envio do e-mail por causa disso).
//
// O link aponta pro endpoint hospedado do próprio Supabase
// (auth/v1/verify?type=magiclink&token=...&redirect_to=...), que autentica
// e redireciona pro nosso /auth/callback — mesmo mecanismo (sessão via
// fragment da URL, capturada pelo supabaseBrowser no client) que já
// comprovadamente autentica o usuário hoje no fluxo de confirmação de
// cadastro. Não depende de nenhuma rota nossa processar `code`/`token_hash`.
export async function generateMagicLink(email: string): Promise<string | null> {
  try {
    const svc = getServerSupabase();
    const { data, error } = await svc.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: `${getAppUrl()}/auth/callback?next=/chat` },
    });
    if (error || !data?.properties?.action_link) {
      if (error) console.warn('[magic-link] generateLink falhou:', error.message);
      return null;
    }
    return data.properties.action_link;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[magic-link] generateLink swallowed:', msg);
    return null;
  }
}
