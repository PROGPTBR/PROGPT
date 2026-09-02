import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Clock } from 'lucide-react';
import { getCurrentUser, getProfile } from '@/lib/auth';
import { Header } from '../login/header';
import { SimuladorFrame } from '@/components/simulador/SimuladorFrame';

export const dynamic = 'force-dynamic';

// Simulador Tributário — DESATIVADO pro público por decisão do diretor
// (2026-08-19): a tela continua visível, mas em estado "Em breve". Admin
// (role='admin') vê o simulador funcional (<SimuladorFrame/>) pra
// testar/validar antes do religamento geral. Gated no middleware.ts; o
// guard abaixo é defesa em profundidade.
export default async function SimuladorPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/simulador');

  const profile = await getProfile(user.id);
  const isAdmin = profile?.role === 'admin';

  if (isAdmin) {
    return (
      <>
        <Header />
        <div className="relative h-[100dvh] overflow-hidden bg-background text-foreground font-outfit antialiased">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-0 right-1/4 h-96 w-96 rounded-full bg-brand/8 blur-3xl"
          />
          <main className="relative z-10 mx-auto flex h-full max-w-[1600px] flex-col gap-2 px-3 pt-[4.75rem] pb-3 sm:px-5 sm:pt-24">
            <div className="flex shrink-0 items-center justify-between">
              <Link
                href="/assistants"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Assistentes
              </Link>
              <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Em teste · visível só pra admin
              </span>
            </div>

            <div className="min-h-0 flex-1">
              <SimuladorFrame />
            </div>
          </main>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="relative min-h-screen bg-background text-foreground font-outfit antialiased overflow-x-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 right-1/4 h-96 w-96 rounded-full bg-brand/8 blur-3xl"
        />
        <main className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6 pt-20 sm:pt-24 pb-12">
          <div className="mb-6">
            <Link
              href="/assistants"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Assistentes
            </Link>
          </div>

          <div className="panel flex flex-col items-center text-center px-6 py-16">
            <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient-soft text-brand">
              <Clock className="h-7 w-7" aria-hidden="true" />
            </span>
            <span className="mb-3 inline-flex rounded-full bg-brand-gradient px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-black">
              Em breve
            </span>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Simulador Tributário
            </h1>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground leading-relaxed">
              Estamos finalizando o comparativo entre o Simples Nacional e o novo
              modelo da Reforma Tributária (IBS/CBS). Em breve você poderá simular
              a carga e o impacto no seu status contábil por aqui.
            </p>
            <Link
              href="/assistants"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand-gradient text-black px-5 h-10 text-sm font-semibold hover:brightness-110 active:scale-95 transition-all"
            >
              Ver os assistentes disponíveis
            </Link>
          </div>
        </main>
      </div>
    </>
  );
}
