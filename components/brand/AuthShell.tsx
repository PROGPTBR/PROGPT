import Link from 'next/link';
import { Header } from '@/app/login/header';
import Image from "next/image";
import { CompanyInfo } from '@/components/legal/CompanyInfo';

// Layout das páginas de auth (login, signup, forgot, reset).
// Split em 2 colunas: painel "Bem-vindo" com gradiente da marca (cor constante
// nos dois temas, estilo das grandes plataformas) + card do formulário no tema
// da página. No mobile só o card aparece. Tema claro/escuro via header.

// const HIGHLIGHTS = [
  // {
  //  Icon: Bot,
   // title: 'Chat especialista',
  //  text: 'Treinado em centenas de artigos de procurement (Kraljic, Porter, Monczka).',
  //},
  //{
  //  Icon: Sparkles,
  //  title: '8 assistentes que executam',
   // text: 'RFP, Kraljic, Porter, Negociação, ABC, Financeiro, Scorecard e mais.',
  //},
  //{
  //  Icon: FileSpreadsheet,
   // title: 'Documentos prontos',
   // text: 'Entregas em .docx e .xlsx, prontas pra usar com sua marca.',
  //},
  //{
   // Icon: Clock,
  //  title: '3 dias grátis',
   // text: 'Teste tudo sem compromisso. Cancele quando quiser.',
  //},
//];

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-background text-foreground font-outfit antialiased flex flex-col">
      <Header />

      <main className="relative z-10 flex-1 grid lg:grid-cols-1-2 pt-[73px]">
        {/* Painel "Bem-vindo" — gradiente vivo da marca, cor constante nos dois
            temas (como os onboardings das grandes plataformas). */}
        <aside className="justify-start relative hidden lg:flex flex-col gap-8 overflow-hidden  px-12 xl:px-16 py-14 text-white">
          {/* Blobs orgânicos decorativos */}
      

          
<section>

  {/* Video
  <video className="video-entrada" autoPlay muted  loop  playsInline>
    <source src="/videos/background.mp4" type="video/mp4" />
  </video>
*/}

  <div className="relative text-center conteudo-entrada ">
    <span className="inline-flex subtitulo-entrada">
      <strong>Transforme dados</strong> em decisões estratégicas com a
    </span>

    <h1 className="titulo-entrada">
      <span>Inteligência Artificial</span>
      <br />
      para Suprimentos
    </h1>
  </div>

<div className="relative text-center">
  <div className="imagem-entrada-01">
     <Image
    src="/imagens/imagem-de-fundo-entrada-chatsupply-01.png"
    alt="Descrição da imagem"
/>
  </div>
  <div className="imagem-entrada-02">
         <Image
    src="/imagens/imagem-de-fundo-entrada-chatsupply-02.png"
    alt="Descrição da imagem"
/>
  </div>
  <div className="imagem-entrada-03">
         <Image
    src="/imagens/imagem-de-fundo-entrada-chatsupply-03.png"
    alt="Descrição da imagem"
/>
  </div>
  </div>

</section>



          {/* Centro — boas-vindas + pitch 
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
          </div>*/}

          {/* Base — highlights 
          <ul className="relative space-y-4 max-w-lg">
            //{HIGHLIGHTS.map(({ Icon, title, text }) => (
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
          </ul>*/}
        </aside>

        {/* Coluna do formulário. flex-col + my-auto centraliza quando cabe e
            deixa a página rolar (sem cortar o topo) quando o form é mais alto
            que a viewport — caso do cadastro card-first. */}
        <div className="relative flex flex-col px-6 py-10">
          {/* glow sutil da marca atrás do card */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
          />
          <div className="relative my-auto mx-auto w-full max-w-lg bg-card border border-border rounded-2xl p-8 shadow-xl dark:shadow-2xl dark:shadow-black/40">
            {children}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-6 text-xs text-muted-foreground text-center space-y-3">
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
