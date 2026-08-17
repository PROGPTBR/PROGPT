import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { Header } from '../login/header';

export const dynamic = 'force-dynamic';

// Simulador SN x Reforma (Status Contábil) — app React auto-contido (bundle
// próprio) servido como asset estático em /simulador-sn-reforma.html e embutido
// via <iframe>. O bundle traz seu próprio React/Tailwind; o iframe isola esse
// runtime do Next (React 18) sem conflito. Toda a "cara do projeto" (Header,
// fundo, glow, panel) vive AQUI, ao redor do iframe. Gated no middleware.ts; o
// guard abaixo é defesa em profundidade (padrão de /fornecedores).
export default async function SimuladorPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/simulador');

  return (
    <>
      <Header />
      <div className="relative min-h-screen bg-background text-foreground font-outfit antialiased overflow-x-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 right-1/4 h-96 w-96 rounded-full bg-brand/8 blur-3xl"
        />
        <main className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 pt-20 sm:pt-24 pb-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <Link
              href="/chat"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Voltar ao chat
            </Link>
          </div>

          <header className="mb-5">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
              Simulador Tributário <span className="text-brand">.</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-2xl">
              Compare o Simples Nacional com o novo modelo da Reforma Tributária
              (IBS/CBS) e visualize o impacto no seu status contábil.
            </p>
          </header>

          <div className="panel overflow-hidden p-0">
            <iframe
              src="/simulador-sn-reforma.html"
              title="Simulador SN x Reforma"
              className="w-full h-[calc(100vh-14rem)] min-h-[560px] block bg-white"
              loading="lazy"
            />
          </div>
        </main>
      </div>
    </>
  );
}
