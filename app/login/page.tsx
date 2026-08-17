import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/brand/AuthShell';
import { LoginForm } from '@/components/auth/LoginForm';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  // O fluxo é: logado ⇒ vai direto pro app.
  const user = await getCurrentUser();
  if (user) {
    redirect(searchParams?.next || '/chat');
  }

  return (
    <AuthShell>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}

