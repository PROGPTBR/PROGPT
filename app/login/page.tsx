import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { Header } from './header';
import { AuthShell } from '@/components/brand/AuthShell';
import { LoginForm } from '@/components/auth/LoginForm';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  // Já logado não deve ver a tela de login (pedia credencial de novo, "não
  // carregava"). O fluxo agora é: logado ⇒ vai direto pro app.
  const user = await getCurrentUser();
  if (user) {
    redirect(searchParams?.next || '/chat');
  }

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

