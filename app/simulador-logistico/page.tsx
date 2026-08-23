import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { Header } from '../login/header';
import { DifalSimulator } from '@/components/simulador-logistico/DifalSimulator';

export const dynamic = 'force-dynamic';

// Simulador Logístico (DIFAL) — calculadora determinística (sem LLM no
// caminho de cálculo, ver lib/simulador-logistico/difal.ts). Gated no
// middleware.ts (matcher '/simulador-logistico/:path*'); o guard abaixo é
// defesa em profundidade, mesmo padrão de app/simulador/page.tsx.
export default async function SimuladorLogisticoPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/simulador-logistico');

  return (
    <>
      <Header />
      <div className="relative min-h-screen bg-background text-foreground font-outfit antialiased overflow-x-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 right-1/4 h-96 w-96 rounded-full bg-brand/8 blur-3xl"
        />
        <main className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 pt-20 sm:pt-24 pb-12">
          <div className="mb-6">
            <Link
              href="/assistants"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Assistentes
            </Link>
          </div>

          <DifalSimulator />
        </main>
      </div>
    </>
  );
}
