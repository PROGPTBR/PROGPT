import { Suspense } from 'react';
import { Header } from './header';
import { AuthShell } from '@/components/brand/AuthShell';
import { LoginForm } from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <>
      <Header />

      <AuthShell>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </AuthShell>
    </>
  );
}

