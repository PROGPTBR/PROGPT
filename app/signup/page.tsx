import { Suspense } from 'react';
import { AuthShell } from '@/components/brand/AuthShell';
import { SignupWizard } from '@/components/auth/SignupWizard';

export default function SignupPage() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <SignupWizard />
      </Suspense>
    </AuthShell>
  );
}
