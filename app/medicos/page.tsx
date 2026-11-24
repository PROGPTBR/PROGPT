import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ShieldCheck, Smartphone, Stethoscope } from 'lucide-react';

import { AppNaMao } from '@/components/medico/AppNaMao';
import { LoginMedico } from '@/components/medico/LoginMedico';
import { TemaClaro } from '@/components/medico/TemaClaro';
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
    <div className="min-h-screen bg-[#f6f8fc] text-neutral-900 antialiased">
      <TemaClaro />
      <main className="mx-auto grid min-h-screen w-full max-w-[1600px] gap-6 p-3 sm:p-5 lg:grid-cols-[1.4fr_1fr]">
        {/* Painel azul-marinho: o que o app faz, com o celular na mão */}
        <section className="relative order-2 overflow-hidden rounded-[2rem] bg-gradient-to-br from-medico-escuro via-medico to-medico-claro p-6 text-white shadow-[0_24px_60px_rgba(10,31,77,0.30)] sm:p-10 lg:order-1">
          <svg aria-hidden viewBox="0 0 800 300" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 bottom-0 h-56 w-full opacity-20">
            <path d="M0 230 C 120 210, 180 110, 300 150 S 500 250, 600 130 S 740 50, 800 80 L800 300 L0 300 Z" fill="white" fillOpacity="0.2" />
            <path d="M0 230 C 120 210, 180 110, 300 150 S 500 250, 600 130 S 740 50, 800 80" fill="none" stroke="white" strokeWidth="2" />
          </svg>
          <div className="relative">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-white/15 ring-1 ring-white/25">
                <Stethoscope className="h-5 w-5" aria-hidden />
              </span>
              Área Médica
            </p>
            <h1 className="mt-6 max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">Você opera. O app cobra, confere e avisa quando o dinheiro cai.</h1>
            <p className="mt-4 max-w-xl text-base text-white/80">Cada cirurgia é acompanhada do demonstrativo do hospital até o pagamento, e o que ficou sem pagar é cobrado até entrar.</p>
            <div className="mt-10">
              <AppNaMao />
            </div>
            <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/80">
              <li className="flex items-center gap-1.5">
                <Smartphone className="h-4 w-4" aria-hidden /> Funciona no celular, como um aplicativo
              </li>
              <li className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" aria-hidden /> Acesso só seu, com os seus dados separados
              </li>
            </ul>
          </div>
        </section>

        {/* Login */}
        <section className="order-1 flex items-center justify-center lg:order-2">
          <div className="w-full max-w-md rounded-[2rem] bg-white p-7 shadow-[0_18px_50px_rgba(10,31,77,0.10)] ring-1 ring-black/5 sm:p-9">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-medico text-white">
              <Stethoscope className="h-6 w-6" aria-hidden />
            </span>
            <h2 className="mt-5 text-2xl font-semibold tracking-tight">Entrar</h2>
            <p className="mb-6 mt-1 text-sm text-neutral-500">Use o e-mail e a senha que você recebeu.</p>
            <LoginMedico />
          </div>
        </section>
      </main>
    </div>
  );
}
