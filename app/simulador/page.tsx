import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { Header } from '../login/header';
import { SimuladorFrame } from '@/components/simulador/SimuladorFrame';

export const dynamic = 'force-dynamic';

// Simulador SN x Reforma (Status Contábil) — app React auto-contido (bundle
// próprio) servido como asset estático em /simulador-sn-reforma.html e embutido
// via <iframe> na <SimuladorFrame>. O bundle traz seu próprio React/Tailwind; o
// iframe isola esse runtime do Next (React 18). A "cara do projeto" (Header,
// fundo, panel, barra de ferramentas) vive ao redor do iframe. Layout de altura
// cheia: o simulador ganha o máximo de tela + botão de tela cheia real. Gated no
// middleware.ts; o guard abaixo é defesa em profundidade (padrão de /fornecedores).
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
              href="/chat"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Voltar ao chat
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
