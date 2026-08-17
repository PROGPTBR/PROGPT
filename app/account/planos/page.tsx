import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { getCurrentUser, getProfile } from '@/lib/auth';
import { getPlans } from '@/lib/billing/planos';
import { getUserPlan } from '@/lib/billing/subscription';
import { AccountPricingTable } from '@/components/billing/AccountPricingTable';
import { CompanyInfo } from '@/components/legal/CompanyInfo';

export const dynamic = 'force-dynamic';

export default async function AccountPlansPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login?next=/account/planos');
  }

  const [plans, profile, userPlanSlug] = await Promise.all([
    getPlans(),
    getProfile(user.id),
    getUserPlan(user.id),
  ]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-12 pt-20">
        <div className="max-w-7xl mx-auto px-0 sm:px-6 py-6 sm:py-16">
          <Link
            href="/account/billing"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-brand transition-colors"
          >
            <ArrowLeft
              className="h-3.5 w-3.5"
              aria-hidden="true"
            />
            Voltar para assinatura
          </Link>
        </div>

        <section
          id="planos"
          className="px-0 sm:px-6 md:px-12 max-w-7xl mx-auto"
        >
          <AccountPricingTable
            plans={plans}
            userPlanSlug={userPlanSlug}
            profile={profile}
          />
        </section>

        <footer className="mt-16 pt-8 border-t border-border">
          <CompanyInfo />
        </footer>
      </main>
    </div>
  );
}

