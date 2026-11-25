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
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-medico-escuro via-medico to-medico-claro text-white antialiased">
      <TemaClaro />
      {/* O azul toma a tela inteira; a curva acompanha a base */}
      <svg aria-hidden viewBox="0 0 1600 400" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 bottom-0 h-[45vh] w-full opacity-20">
        <path d="M0 300 C 240 270, 360 140, 600 190 S 1000 330, 1200 170 S 1480 60, 1600 100 L1600 400 L0 400 Z" fill="white" fillOpacity="0.2" />
        <path d="M0 300 C 240 270, 360 140, 600 190 S 1000 330, 1200 170 S 1480 60, 1600 100" fill="none" stroke="white" strokeWidth="2" />
      </svg>

      <main className="relative mx-auto grid min-h-screen w-full max-w-[1700px] items-center gap-10 px-5 py-8 sm:px-10 lg:grid-cols-[1.35fr_1fr] lg:gap-16 lg:px-16">
        {/* O que o app faz, com o celular na mão */}
        <section className="order-2 lg:order-1">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-white/15 ring-1 ring-white/25">
              <Stethoscope className="h-5 w-5" aria-hidden />
            </span>
            Área Médica
          </p>
          <h1 className="mt-6 max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl xl:text-6xl">Você opera. O app cobra, confere e avisa quando o dinheiro cai.</h1>
          <p className="mt-4 max-w-xl text-base text-white/80 sm:text-lg">O app acompanha o mês inteiro: as cirurgias feitas, o demonstrativo que o hospital manda, a nota fiscal e o pagamento. O que ficar de fora é cobrado até entrar.</p>
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
        </section>

        {/* Login: cartão branco sobre o azul */}
        <section className="order-1 flex justify-center lg:order-2 lg:justify-end">
          <div className="w-full max-w-md rounded-[2rem] bg-white p-7 text-neutral-900 shadow-[0_30px_80px_rgba(4,14,40,0.45)] sm:p-9">
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
