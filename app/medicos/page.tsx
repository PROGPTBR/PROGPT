import { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ShieldCheck, Smartphone, Stethoscope } from 'lucide-react';

import { Header } from '@/app/login/header';
import { LoginForm } from '@/components/auth/LoginForm';
import { AppNaMao } from '@/components/medico/AppNaMao';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Área Médica | 2BSUPPLY.IA',
  description: 'Das cirurgias feitas ao dinheiro na conta: demonstrativos, notas, cobranças e pagamentos do médico num só lugar.',
};

// Entrada da Área Médica (sub-projeto 104): feita para o médico. Mostra o que
// o app faz (demonstração animada no celular) e o login na mesma tela. O
// formulário é o mesmo do sistema; o destino depois de entrar é a Área Médica.
export default async function MedicosPage({ searchParams }: { searchParams?: { next?: string } }) {
  if (await getCurrentUser()) redirect('/area-medica');
  // O formulário de login lê o destino do endereço.
  if (!searchParams?.next) redirect('/medicos?next=%2Farea-medica');

  return (
    <div className="relative flex min-h-screen flex-col bg-background text-foreground antialiased">
      <div aria-hidden className="pointer-events-none absolute -top-24 right-0 h-96 w-96 rounded-full bg-brand/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute bottom-0 left-0 h-80 w-80 rounded-full bg-brand/5 blur-3xl" />
      <Header />

      <main className="relative z-10 mx-auto grid w-full max-w-[1500px] flex-1 items-center gap-10 px-4 pb-12 pt-24 sm:px-6 lg:grid-cols-[1.35fr_1fr] lg:px-10">
        <section className="order-2 lg:order-1">
          <p className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
            <Stethoscope className="h-3.5 w-3.5" aria-hidden /> Área Médica
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Você opera. O app cobra, confere e avisa quando o dinheiro cai.</h1>
          <p className="mt-3 max-w-2xl text-base text-muted-foreground">
            Chega de planilha: cada cirurgia é acompanhada do demonstrativo do hospital até o pagamento, e o que ficou sem pagar é cobrado até entrar.
          </p>
          <div className="mt-8">
            <AppNaMao />
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-1.5">
              <Smartphone className="h-4 w-4 text-brand" aria-hidden /> Funciona no celular, como um aplicativo
            </li>
            <li className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-brand" aria-hidden /> Acesso só seu, liberado pela 2B Supply
            </li>
          </ul>
        </section>

        <section className="order-1 lg:order-2">
          <div className="mx-auto w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-xl sm:p-8">
            <p className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand">
              <Stethoscope className="h-3.5 w-3.5" aria-hidden /> Área Médica
            </p>
            <Suspense fallback={null}>
              <LoginForm />
            </Suspense>
          </div>
        </section>
      </main>
    </div>
  );
}
