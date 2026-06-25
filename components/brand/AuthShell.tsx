import Link from 'next/link';
import { Bot, FileSpreadsheet, Sparkles, Clock } from 'lucide-react';
import { Header } from '@/app/login/header';

// Layout das páginas de auth (login, signup, forgot, reset).
// Split em 2 colunas: painel "Bem-vindo" com gradiente da marca (cor constante
// nos dois temas, estilo das grandes plataformas) + card do formulário no tema
// da página. No mobile só o card aparece. Tema claro/escuro via header.

const HIGHLIGHTS = [
  {
    Icon: Bot,
    title: 'Chat especialista',
    text: 'Treinado em centenas de artigos de procurement (Kraljic, Porter, Monczka).',
  },
  {
    Icon: Sparkles,
    title: '8 assistentes que executam',
    text: 'RFP, Kraljic, Porter, Negociação, ABC, Financeiro, Scorecard e mais.',
  },
  {
    Icon: FileSpreadsheet,
    title: 'Documentos prontos',
    text: 'Entregas em .docx e .xlsx, prontas pra usar com sua marca.',
  },
  {
    Icon: Clock,
    title: '3 dias grátis',
    text: 'Teste tudo sem compromisso. Cancele quando quiser.',
  },
];

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-background text-foreground font-outfit antialiased flex flex-col">
      <Header />

      <main className="relative z-10 flex-1 grid lg:grid-cols-2 pt-[73px]">
        {/* Painel "Bem-vindo" — gradiente vivo da marca, cor constante nos dois
            temas (como os onboardings das grandes plataformas). */}
        <aside className="relative hidden lg:flex flex-col justify-center gap-10 overflow-hidden bg-gradient-to-br from-[#0ed1e0] via-[#0e8de1] to-[#0a6fbf] px-12 xl:px-16 py-14 text-white">
          {/* Blobs orgânicos decorativos */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-24 -right-16 h-80 w-80 rounded-full bg-white/15 blur-3xl" />
            <div className="absolute bottom-[-6rem] left-[-4rem] h-96 w-96 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute top-1/3 left-1/4 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            {/* marca d'água do logo em branco */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/2bsupply-logo.png"
              alt=""
              className="absolute -bottom-10 -right-10 w-72 select-none opacity-10 brightness-0 invert"
            />
          </div>

          {/* Topo — selo */}
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-medium backdrop-blur-sm ring-1 ring-white/25">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              PROGPT · uma plataforma 2B Supply
            </span>
          </div>

          {/* Centro — boas-vindas + pitch */}
          <div className="relative space-y-5 max-w-lg">
            <h2 className="text-4xl xl:text-5xl font-bold tracking-tight leading-[1.1]">
              Bem-vindo à IA de{' '}
              <span className="underline decoration-white/40 decoration-4 underline-offset-4">
                Strategic Sourcing
              </span>
              .
            </h2>
            <p className="text-lg text-white/85">
              Decisões de compras mais rápidas e fundamentadas — do diagnóstico
              da categoria à negociação.
            </p>
          </div>

          {/* Base — highlights */}
          <ul className="relative space-y-4 max-w-lg">
            {HIGHLIGHTS.map(({ Icon, title, text }) => (
              <li key={title} className="flex items-start gap-3.5">
                <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <div className="text-sm font-semibold">{title}</div>
                  <div className="text-sm text-white/75">{text}</div>
                </div>
              </li>
            ))}
          </ul>
        </aside>

        {/* Coluna do formulário. flex-col + my-auto centraliza quando cabe e
            deixa a página rolar (sem cortar o topo) quando o form é mais alto
            que a viewport — caso do cadastro card-first. */}
        <div className="relative flex flex-col px-6 py-10">
          {/* glow sutil da marca atrás do card */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 brand-aura opacity-60"
          />
          <div className="relative my-auto mx-auto w-full max-w-md bg-card border border-border rounded-2xl p-8 shadow-xl dark:shadow-2xl dark:shadow-black/40">
            {children}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-4 text-xs text-muted-foreground text-center space-y-2">
        <div>
          PROGPT · uma plataforma{' '}
          <a
            href="https://2bsupply.com.br/en/"
            target="_blank"
            rel="noreferrer noopener"
            className="hover:text-brand transition-colors"
          >
            2B Supply
          </a>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10px]">
          <Link href="/termos" className="hover:text-foreground transition-colors">
            Termos
          </Link>
          <span aria-hidden>·</span>
          <Link href="/privacidade" className="hover:text-foreground transition-colors">
            Privacidade
          </Link>
          <span aria-hidden>·</span>
          <Link href="/cookies" className="hover:text-foreground transition-colors">
            Cookies
          </Link>
        </div>
      </footer>
    </div>
  );
}
