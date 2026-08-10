import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Header } from '../login/header';
import { getCurrentUser, getProfile } from '@/lib/auth';
import { PricingTable } from '@/components/billing/PricingTable';
import { CompanyInfo } from '@/components/legal/CompanyInfo';
import { getPlans } from '@/lib/billing/planos';

export const dynamic = 'force-dynamic';

export default async function PricingPage({
  searchParams,
}: {
  searchParams?: {
    expired?: string;
  };
}) {
  const user = await getCurrentUser();

  const profile = user ? await getProfile(user.id) : null;

  const plans = await getPlans();

  const trialExpired = searchParams?.expired === 'true';

  // Por enquanto, mantemos essas informações neutras.
  // O PricingTable continua responsável pelo fluxo de checkout.
  const isPro = false;
  const userPlanSlug = null;

  return (
    <>
      <Header />

      <div className="min-h-screen bg-background text-foreground">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="max-w-7xl mx-auto px-0 sm:px-6 py-6 sm:py-16 flex items-center justify-between">
            <Link
              href={user ? '/account/billing' : '/'}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-brand transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Voltar
            </Link>

            {!user && (
              <Link
                href="/login?next=/pricing"
                className="text-xs text-brand hover:text-brand/80 transition-colors"
              >
                Entrar →
              </Link>
            )}
          </div>

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

          <footer className="mt-16 pt-8 border-t border-border">
            <CompanyInfo />
          </footer>
        </main>
      </div>
    </>
  );
}