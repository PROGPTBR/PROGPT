import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Evita cache de respostas autenticadas
  res.headers.set('Cache-Control', 'private, no-store');

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => req.cookies.get(name)?.value,

        set: (
          name: string,
          value: string,
          options: CookieOptions,
        ) => {
          res.cookies.set({
            name,
            value,
            ...options,
          });
        },

        remove: (
          name: string,
          options: CookieOptions,
        ) => {
          res.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    },
  );

  /**
   * Não usamos getSession() para decidir autorização.
   * getUser() valida o usuário com o Supabase Auth.
   */
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  // ============================================================
  // NÃO LOGADO
  // ============================================================

  if (userError || !user) {
    const url = new URL('/login', req.url);

    url.searchParams.set(
      'next',
      `${req.nextUrl.pathname}${req.nextUrl.search}`,
    );

    return NextResponse.redirect(url);
  }

  // ============================================================
  // BUSCA O PERFIL
  // ============================================================

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile) {
    console.error(
      '[middleware] Erro ao consultar profile:',
      profileError,
    );

    const url = new URL('/login', req.url);
    url.searchParams.set('error', 'profile');

    return NextResponse.redirect(url);
  }

  // ============================================================
  // ADMIN = EQUIPE
  // ACESSO SEM LIMITE DE TEMPO
  // ============================================================

  if (profile.role === 'admin') {
    return res;
  }

  // ============================================================
  // A PARTIR DAQUI É CLIENTE (role = user)
  // ============================================================

  // Acesso = assinatura PRÓPRIA ou licença de uma assinatura de outra pessoa
  // (empresa que contratou N usuários — sub-projeto 64). O RPC resolve os
  // dois casos e devolve sempre uma linha de assinatura no mesmo formato,
  // então toda a lógica abaixo (trial, atraso, cancelado com período pago)
  // continua valendo sem mudança. O RPC usa auth.uid() — não aceita id de
  // terceiro.
  const {
    data: accessRows,
    error: subscriptionError,
  } = await supabase.rpc('resolve_subscription_access');

  const subscription =
    (accessRows as
      | Array<{
          status: string;
          trial_end: string | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          via: string;
        }>
      | null)?.[0] ?? null;

  if (subscriptionError) {
    console.error(
      '[middleware] Erro ao consultar subscription:',
      subscriptionError,
    );

    const url = new URL('/planos', req.url);
    url.searchParams.set('access_error', 'true');

    return NextResponse.redirect(url);
  }

  const now = Date.now();

  // ============================================================
  // VERIFICA SE O PERÍODO PAGO AINDA ESTÁ VÁLIDO
  // ============================================================

  const periodEndTimestamp = subscription?.current_period_end
    ? new Date(subscription.current_period_end).getTime()
    : null;

  const periodStillValid =
    periodEndTimestamp !== null &&
    !Number.isNaN(periodEndTimestamp) &&
    periodEndTimestamp > now;

  // ============================================================
  // ASSINATURA PAGA ATIVA
  // ============================================================

  const subscriptionActive =
    subscription?.status === 'active' &&
    (
      !subscription.current_period_end ||
      periodStillValid
    );

  if (subscriptionActive) {
    return res;
  }

  // ============================================================
  // ASSINATURA CANCELADA
  //
  // O cliente cancelou a renovação, mas já pagou o período atual.
  // Mantém o acesso até current_period_end.
  // ============================================================

  const cancelledButPaid =
    subscription?.status === 'cancelled' &&
    subscription.cancel_at_period_end === true &&
    periodStillValid;

  if (cancelledButPaid) {
    return res;
  }

  // ============================================================
  // PAGAMENTO COM PENDÊNCIA
  //
  // Mantém acesso enquanto o período que já foi pago ainda
  // estiver dentro de current_period_end.
  // ============================================================

  const pastDueButPeriodValid =
    subscription?.status === 'past_due' &&
    periodStillValid;

  if (pastDueButPeriodValid) {
    return res;
  }

  // ============================================================
  // TRIAL DE 3 DIAS ATIVO
  // ============================================================

  const trialActive =
    subscription?.status === 'trialing' &&
    !!subscription.trial_end &&
    new Date(subscription.trial_end).getTime() > now;

  if (trialActive) {
    return res;
  }

  // ============================================================
  // SEM PERÍODO VÁLIDO
  // ============================================================

  const url = new URL('/planos', req.url);

  url.searchParams.set('expired', 'true');
  url.searchParams.set(
    'next',
    `${req.nextUrl.pathname}${req.nextUrl.search}`,
  );

  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    '/chat/:path*',
    '/fluxo/:path*',
    '/dashboard/:path*',
    '/admin/:path*',
    '/assistants/:path*',
    '/fornecedores/:path*',
    '/simulador/:path*',
    '/simulador-logistico/:path*',
    '/proc2pay/:path*',
    '/profile/:path*',
    '/prompts/:path*',
    '/painel/:path*',
    '/plataforma/:path*',
  ],
};