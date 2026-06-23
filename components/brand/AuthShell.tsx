import Link from 'next/link';
import { Bot, FileSpreadsheet, Sparkles, Clock, ChevronUp } from 'lucide-react';
import { Header } from '@/app/login/header';

// Layout das páginas de auth (login, signup, forgot, reset).
// Split em 2 colunas: painel de marketing (no tema da página) + card de auth.
// Camadas decorativas (anéis/nós) ao fundo dão profundidade. No mobile só o
// card aparece. Tema claro/escuro via toggle no header.

const HIGHLIGHTS = [
  {
    Icon: Bot,
    title: 'Chat especialista',
    text: 'Treinado em centenas de artigos de procurement (Kraljic, Porter, Monczka).',
  },
  {
    Icon: Sparkles,
    title: '7 assistentes que executam',
    text: 'RFP, Kraljic, Porter, Negociação, ABC, Financeiro e Scorecard.',
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

// Swipe-up estático (3 chevrons empilhados) — acento decorativo de fundo.
function SwipeStatic({ className = '', size = 'h-6 w-6' }: { className?: string; size?: string }) {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <ChevronUp className={`-mb-3 ${size}`} strokeWidth={2.5} aria-hidden="true" />
      <ChevronUp className={`-mb-3 ${size}`} strokeWidth={2.5} aria-hidden="true" />
      <ChevronUp className={size} strokeWidth={2.5} aria-hidden="true" />
    </div>
  );
}

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-background text-foreground font-outfit antialiased flex flex-col overflow-hidden">
      {/* Fundo moderno: glow da marca + marca d'água do logo (silhueta
          monocromática que funciona nos dois temas). */}
      <div
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden text-brand"
        aria-hidden="true"
      >
        <div className="brand-aura absolute inset-0" />
        {/* marca d'água do logo — menor (melhor qualidade) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/2bsupply-logo.png"
          alt=""
          className="absolute left-1/2 top-1/2 w-[38vw] max-w-xl -translate-x-1/2 -translate-y-1/2 select-none opacity-[0.05] brightness-0 dark:opacity-[0.07] dark:invert"
        />
        {/* swipe-ups estáticos estratégicos (não animados) */}
        <SwipeStatic size="h-7 w-7" className="absolute right-[10%] top-28 opacity-[0.13]" />
        <SwipeStatic size="h-6 w-6" className="absolute left-[14%] bottom-28 opacity-[0.10]" />
        <SwipeStatic size="h-5 w-5" className="absolute right-[30%] bottom-20 opacity-[0.08]" />
        <SwipeStatic size="h-5 w-5" className="absolute left-[44%] top-20 opacity-[0.07]" />
      </div>

      <Header />

      <main className="relative z-10 flex-1 grid lg:grid-cols-2 pt-[73px]">
        {/* Painel de marketing — no tema da página (sem fundo preto). */}
        <aside className="relative hidden lg:flex flex-col justify-center gap-10 px-12 xl:px-20">
          <div className="relative space-y-6 max-w-lg">
            <h2 className="text-4xl xl:text-5xl font-semibold tracking-tight text-foreground leading-[1.12]">
              A IA de{' '}
              <span className="text-brand-gradient">Strategic Sourcing</span>{' '}
              da 2B Supply.
            </h2>
            <p className="text-lg text-muted-foreground">
              Decisões de compras mais rápidas e fundamentadas — do diagnóstico
              da categoria à negociação.
            </p>
          </div>

          <ul className="relative space-y-5 max-w-lg">
            {HIGHLIGHTS.map(({ Icon, title, text }) => (
              <li key={title} className="flex items-start gap-3.5">
                <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-brand/20">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <div className="text-sm font-semibold text-foreground">{title}</div>
                  <div className="text-sm text-muted-foreground">{text}</div>
                </div>
              </li>
            ))}
          </ul>
        </aside>

        {/* Card de auth */}
        <div className="flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 shadow-xl dark:shadow-2xl dark:shadow-black/40">
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
