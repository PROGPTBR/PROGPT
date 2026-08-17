import Link from 'next/link';
import Image from 'next/image';
import { Header } from '@/app/login/header';
import { CompanyInfo } from '@/components/legal/CompanyInfo';

// Layout das páginas de auth (login, signup, forgot, reset).
//
// Fundo atmosférico: a imagem "tech" original (imagem-de-fundo-entrada-...-1.jpg)
// volta como fundo de TELA CHEIA, incorporada ao fundo do site — opacidade
// baixa + um overlay do próprio `bg-background` que dissolve as bordas (sem
// retângulo duro) + aura sutil da marca. Funciona nos dois temas (fica mais
// forte no escuro, vira uma textura discreta no claro).
//
// Sobre esse fundo: à esquerda (desktop) a chamada + as screenshots reais do
// sistema flutuam; à direita o card do formulário (`.panel`), estreito
// (`max-w-md`) e centrado — corrige a tela de login larga demais.

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-background text-foreground font-sans antialiased flex flex-col">
      {/* Fundo tecnológico incorporado em TODA a tela */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/imagens/imagem-de-fundo-entrada-chatsupply-1.jpg"
          alt=""
          className="h-full w-full object-cover opacity-25 dark:opacity-[0.6]"
        />
        {/* Overlay uniforme e leve: dá contraste ao conteúdo sem apagar a
            textura — a imagem tech permanece visível de ponta a ponta. */}
        <div className="absolute inset-0 bg-background/60 dark:bg-background/45" />
        <div className="absolute inset-0" />
      </div>

      <Header />

      <main className="relative z-10 flex-1 grid lg:grid-cols-[1.15fr_1fr]">
        {/* ── Chamada + screenshots do sistema (transparente: o fundo tech
              aparece por trás e unifica a tela) ── */}
        <aside className="relative hidden lg:flex flex-col justify-center gap-12 px-12 xl:px-16 py-14">
          <div className="relative mx-auto w-full max-w-xl text-center">
            <span className="block text-xs sm:text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Transforme dados em decisões estratégicas com a
            </span>
            <h2 className="mt-3 text-4xl xl:text-5xl font-bold leading-[1.05] tracking-tight">
              <span className="text-brand-gradient">Inteligência Artificial</span>
              <br />
              <span className="text-foreground/80">para Suprimentos</span>
            </h2>
          </div>

          {/* Screenshots reais — a principal + duas flutuantes */}
          <div className="relative mx-auto w-full max-w-xl">
            <div className="overflow-hidden rounded-xl border border-border shadow-2xl shadow-black/30 dark:shadow-black/50">
              <Image
                src="/imagens/imagem-de-fundo-entrada-chatsupply-01.png"
                alt="Painel do PROGPT em uso"
                width={684}
                height={407}
                priority
                className="h-auto w-full"
              />
            </div>

            <div className="absolute -bottom-6 left-2 w-[42%] overflow-hidden rounded-lg border border-border shadow-xl shadow-black/40 backdrop-blur-sm">
              <Image
                src="/imagens/imagem-de-fundo-entrada-chatsupply-02.png"
                alt=""
                width={247}
                height={147}
                className="h-auto w-full"
              />
            </div>

            <div className="absolute -bottom-8 right-1 w-[44%] overflow-hidden rounded-lg border border-border shadow-xl shadow-black/40 backdrop-blur-sm">
              <Image
                src="/imagens/imagem-de-fundo-entrada-chatsupply-03.png"
                alt=""
                width={276}
                height={164}
                className="h-auto w-full"
              />
            </div>
          </div>
        </aside>

        {/* ── Coluna do formulário ── */}
        <div className="relative flex items-center justify-center px-4 sm:px-6 py-10">
          <div className="w-full max-w-md">
            <div className="panel p-6 sm:p-8">{children}</div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-6 text-xs text-muted-foreground text-center space-y-3 border-t border-border">
        <CompanyInfo />
        <div>
          PROGPT · uma plataforma{' '}
          <a
            href="https://2bsupply.com.br/en/"
            target="_blank"
            rel="noreferrer noopener"
            className="hover:text-brand transition-colors"
          >
            2BSUPPLY
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
