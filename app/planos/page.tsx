import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Header } from '../login/header';

import {
  getCurrentUser,
  getProfile,
  getSubscription,
  isTrialExpired,
  isSubscriptionActive,
} from '@/lib/auth';

import { PricingTable } from '@/components/billing/PricingTable';
import { CompanyInfo } from '@/components/legal/CompanyInfo';
import { getPlans } from '@/lib/billing/planos';

export const dynamic = 'force-dynamic';

export default async function PricingPage({
  searchParams,
}: {
  searchParams?: {
    expired?: string;
    next?: string;
  };
}) {
  // ============================================================
  // USUÁRIO
  // ============================================================

  const user = await getCurrentUser();

  // ============================================================
  // PERFIL + ASSINATURA
  // ============================================================

  const [profile, subscription] = user
    ? await Promise.all([
        getProfile(user.id),
        getSubscription(user.id),
      ])
    : [null, null];

  // ============================================================
  // PLANOS
  // ============================================================

  const plans = await getPlans();

  // ============================================================
  // TIPO DE USUÁRIO
  // ============================================================

  const isAdmin =
    profile?.role === 'admin';

  // ============================================================
  // TRIAL EXPIRADO
  //
  // Agora consultamos o Supabase diretamente.
  //
  // Mesmo que o usuário acesse:
  //
  // /planos
  //
  // sem ?expired=true, o sistema saberá que ele já usou
  // os 3 dias.
  //
  // Admin nunca é tratado como trial expirado.
  // ============================================================

  const expiredByDatabase =
    !!user &&
    !isAdmin &&
    isTrialExpired(subscription);

  const expiredByUrl =
    !!user &&
    !isAdmin &&
    searchParams?.expired === 'true';

  const trialExpired =
    expiredByDatabase || expiredByUrl;

  // ============================================================
  // ASSINATURA ATIVA
  // ============================================================

  const isPro =
    !!user &&
    !isAdmin &&
    isSubscriptionActive(subscription);

  // ============================================================
  // PLANO ATUAL
  //
  // Para assinatura paga, podemos identificar o slug salvo
  // na subscription.
  //
  // Durante trial ou sem assinatura ativa, mantemos null para
  // não impedir o botão de checkout.
  // ============================================================

  const userPlanSlug =
    isPro
      ? subscription?.plan_slug ??
        profile?.selected_plan ??
        null
      : null;

  // ============================================================
  // VOLTAR
  // ============================================================

  const backHref = user
    ? searchParams?.next ||
      '/account/billing'
    : '/';

  return (
    <>
      <Header />

      <div className="min-h-screen bg-background text-foreground">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-12 pt-20">

          {/* ====================================================
              NAVEGAÇÃO
          ==================================================== */}

          <div className="max-w-7xl mx-auto px-0 sm:px-6 py-6 sm:py-16 flex items-center justify-between">
            <Link
              href={backHref}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-brand transition-colors"
            >
              <ArrowLeft
                className="h-3.5 w-3.5"
                aria-hidden="true"
              />

              Voltar
            </Link>

            {!user && (
              <Link
                href="/login?next=/planos"
                className="text-xs text-brand hover:text-brand/80 transition-colors"
              >
                Entrar →
              </Link>
            )}
          </div>

          {/* ====================================================
              PLANOS
          ==================================================== */}

          <section
            id="planos"
            className="px-0 sm:px-6 md:px-12 max-w-7xl mx-auto border-border"
          >
            <PricingTable
              authed={!!user}
              isPro={isPro}
              plans={plans}
              userPlanSlug={userPlanSlug}
              profile={profile}
              trialExpired={trialExpired}
            />
          </section>

          {/* ====================================================
              RODAPÉ
          ==================================================== */}

          <footer className="mt-16 pt-8 border-t border-border">
            <CompanyInfo />
          </footer>
        </main>
      </div>
    </>
  );
}