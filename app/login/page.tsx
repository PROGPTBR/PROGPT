import { Suspense } from 'react';
import { AuthShell } from '@/components/brand/AuthShell';
import { LoginForm } from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
