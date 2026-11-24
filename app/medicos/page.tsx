import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ShieldCheck, Smartphone, Stethoscope } from 'lucide-react';

import { AppNaMao } from '@/components/medico/AppNaMao';
import { LoginMedico } from '@/components/medico/LoginMedico';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Área Médica',
  description: 'Das cirurgias feitas ao dinheiro na conta: demonstrativos, notas, cobranças e pagamentos do médico num só lugar.',
};

// Entrada da Área Médica (sub-projetos 104 e 107). É um produto à parte do
// sistema de compras: a tela tem só a apresentação do app e o login do médico.
// Nada de menu do site, planos, cadastro ou chat.
export default async function MedicosPage() {
  if (await getCurrentUser()) redirect('/area-medica');

  return (
    <div className="relative flex min-h-screen flex-col bg-background text-foreground antialiased">
      <div aria-hidden className="pointer-events-none absolute -top-24 right-0 h-96 w-96 rounded-full bg-brand/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute bottom-0 left-0 h-80 w-80 rounded-full bg-brand/5 blur-3xl" />
      <header className="relative z-10 mx-auto flex h-16 w-full max-w-[1500px] items-center px-4 sm:px-6 lg:px-10">
        <span className="flex items-center gap-2 text-base font-semibold">
          <Stethoscope className="h-6 w-6 text-brand" aria-hidden /> Área Médica
        </span>
      </header>

      <main className="relative z-10 mx-auto grid w-full max-w-[1500px] flex-1 items-center gap-10 px-4 pb-12 pt-4 sm:px-6 lg:grid-cols-[1.35fr_1fr] lg:px-10">
        <section className="order-2 lg:order-1">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Você opera. O app cobra, confere e avisa quando o dinheiro cai.</h1>
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
              <ShieldCheck className="h-4 w-4 text-brand" aria-hidden /> Acesso só seu, com os seus dados separados
            </li>
          </ul>
        </section>

        <section className="order-1 lg:order-2">
          <div className="mx-auto w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-xl sm:p-8">
            <h2 className="text-xl font-semibold">Entrar</h2>
            <p className="mb-5 mt-1 text-sm text-muted-foreground">Use o e-mail e a senha que você recebeu.</p>
            <LoginMedico />
          </div>
        </section>
      </main>
    </div>
  );
}
