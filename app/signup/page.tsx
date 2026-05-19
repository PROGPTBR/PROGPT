import { Suspense } from 'react';
import { AuthShell } from '@/components/brand/AuthShell';
import { SignupForm } from '@/components/auth/SignupForm';

export default function SignupPage() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <SignupForm />
      </Suspense>
    </AuthShell>
  );
}
