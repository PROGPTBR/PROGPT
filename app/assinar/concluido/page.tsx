import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MailCheck } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';
import { getSubscription } from '@/lib/billing/subscription';
import { finalizePendingSignupByToken } from '@/lib/billing/onboarding';
import { Header } from '../../login/header';

export const dynamic = 'force-dynamic';

// Sub-projeto 36.2 — landing do successUrl do Asaas (pós cartão).
//
// Dois casos:
//  (a) ?token=...  → fluxo card-first: cria a conta agora e mostra "confira seu
//      e-mail" (o cliente ainda NÃO tem senha; define pelo link enviado).
//  (b) sem token   → usuário já logado finalizando assinatura: marca trialing
//      e manda pro /chat.
export default async function TrialConfirmedPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams?.token;

  // (a) Card-first: cria a conta e instrui a definir a senha.
  if (token) {
    const result = await finalizePendingSignupByToken(token);
    const email = result.ok ? result.email : null;
    return (
      <>
        <Header />
        <div className="relative min-h-screen bg-background text-foreground font-outfit antialiased flex items-center justify-center px-6 pt-[73px]">
          <div className="w-full max-w-md text-center space-y-5 rounded-2xl border border-border bg-card p-8 shadow-xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10">
              <MailCheck className="h-7 w-7 text-brand" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                Cartão cadastrado <span className="text-brand">.</span>
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Seus <strong className="text-foreground">3 dias grátis</strong> estão
                liberados — sem cobrança agora. Enviamos um e-mail
                {email ? (
                  <>
                    {' '}para <span className="font-medium text-brand">{email}</span>
                  </>
                ) : null}{' '}
                com um link pra você <strong className="text-foreground">definir sua senha</strong> e
                acessar a plataforma.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Não recebeu em alguns minutos? Verifique o spam ou use “Esqueci minha
              senha” na tela de login.
            </p>
            <Link
              href="/login"
              className="inline-block text-sm font-medium text-brand hover:text-brand/80 transition-colors"
            >
              Ir para o login
            </Link>
          </div>
        </div>
      </>
    );
  }

  // (b) Usuário logado finalizando assinatura (fluxo antigo).
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/chat');

  const sub = await getSubscription(user.id);
  if (
    sub &&
    sub.status === 'pending' &&
    sub.asaas_subscription_id &&
    sub.trial_end &&
    new Date(sub.trial_end).getTime() > Date.now()
  ) {
    const svc = getServerSupabase();
    await svc
      .from('subscriptions')
      .update({ status: 'trialing', updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('status', 'pending');
  }

  redirect('/chat');
}
