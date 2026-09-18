import { Suspense } from 'react';
import { AuthShell } from '@/components/brand/AuthShell';
import { SignupWizard } from '@/components/auth/SignupWizard';
import { getBillingSettings } from '@/lib/billing/settings';
import { parseSeats } from '@/lib/billing/seats';

export const dynamic = 'force-dynamic';

// /signup?usuarios=3 abre o cadastro já com 3 acessos selecionados — é o
// link que a 2B Supply manda pra quem vai contratar para uma equipe.
// Também aceita ?seats=3 (mesma coisa, em inglês).
export default async function SignupPage({
  searchParams,
}: {
  searchParams?: { usuarios?: string; seats?: string };
}) {
  const { planPrice, trialDays } = await getBillingSettings();

  const initialSeats = parseSeats(
    searchParams?.usuarios ?? searchParams?.seats ?? 1,
  );

  return (
    <AuthShell>
      <Suspense fallback={null}>
        <SignupWizard
          planPrice={planPrice}
          trialDays={trialDays}
          initialSeats={initialSeats}
        />
      </Suspense>
    </AuthShell>
  );
}
