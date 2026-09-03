import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { Header } from '../login/header';
import { SimuladorFrame } from '@/components/simulador/SimuladorFrame';

export const dynamic = 'force-dynamic';

// Simulador Tributário — religado pro público em 2026-09-02 (decisão do
// diretor). Era "Em breve" pra não-admin desde 2026-08-19 (admin via
// <SimuladorFrame/> validava antes do religamento geral); agora todo
// usuário logado com acesso à página (gate de assinatura já é feito no
// middleware.ts) vê o simulador funcional.
export default async function SimuladorPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/simulador');

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
          </div>

          <div className="min-h-0 flex-1">
            <SimuladorFrame />
          </div>
        </main>
      </div>
    </>
  );
}
