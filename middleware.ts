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

  const {
    data: subscription,
    error: subscriptionError,
  } = await supabase
    .from('subscriptions')
    .select(`
      status,
      trial_end,
      current_period_end
    `)
    .eq('user_id', user.id)
    .maybeSingle();

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
  // ASSINATURA PAGA ATIVA
  // ============================================================

  const subscriptionActive =
    subscription?.status === 'active' &&
    (
      !subscription.current_period_end ||
      new Date(subscription.current_period_end).getTime() > now
    );

  if (subscriptionActive) {
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
  // TRIAL ACABOU E NÃO POSSUI ASSINATURA ATIVA
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
  ],
};