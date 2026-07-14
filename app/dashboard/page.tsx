import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { Header } from '../login/header';
import { DataStudio } from '@/components/dashboard/DataStudio';

export const dynamic = 'force-dynamic';

// Dashboard Studio — o cliente joga uma planilha e ela vira um painel denso
// estilo Power BI (KPIs, série temporal, rankings, cruzamentos). Client-side,
// sem DB. Gated no middleware.ts; o guard aqui é defesa em profundidade.
export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/dashboard');

  return (
    <>
      <Header />
      <div className="relative min-h-screen bg-background text-foreground font-outfit antialiased overflow-x-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 right-1/4 h-96 w-96 rounded-full bg-brand/8 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 -left-20 h-80 w-80 rounded-full bg-brand/5 blur-3xl"
        />

        <main className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 pt-20 sm:pt-24 pb-12">
          <div className="mb-6 print-hide">
            <Link
              href="/chat"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Voltar ao chat
            </Link>
          </div>
          <DataStudio />
        </main>
      </div>
    </>
  );
}
