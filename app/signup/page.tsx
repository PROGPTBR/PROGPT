import { Suspense } from 'react';
import { AuthShell } from '@/components/brand/AuthShell';
import { SignupWizard } from '@/components/auth/SignupWizard';
import { getBillingSettings } from '@/lib/billing/settings';

export const dynamic = 'force-dynamic';

export default async function SignupPage() {
  const { planPrice, trialDays } = await getBillingSettings();

  return (
    <AuthShell>
      <Suspense fallback={null}>
        <SignupWizard planPrice={planPrice} trialDays={trialDays} />
      </Suspense>
    </AuthShell>
  );
}
