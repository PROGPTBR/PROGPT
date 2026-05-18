import Link from 'next/link';
import {
  ArrowRight,
  Clock,
  FileText,
  LayoutGrid,
  MessageCircle,
  Sparkles,
} from 'lucide-react';

// Landing page (Material You / Material Design 3 aesthetic).
// Opt-in via the `md-*` token namespace defined in tailwind.config.ts —
// this page does not affect the rest of the app's styling.

type SourcingStep = {
  n: number;
  title: string;
  blurb: string;
  available?: {
    assistant: 'rfp' | 'kraljic';
    label: string;
  };
};

const STEPS: SourcingStep[] = [
  {
    n: 1,
    title: 'Perfil da Categoria',
    blurb:
      'Entendimento profundo da categoria, suas especificidades e impacto no negócio.',
  },
  {
    n: 2,
    title: 'Análise da Categoria',
    blurb: 'Coleta e análise de dados internos: volumes, custos, contratos.',
  },
  {
    n: 3,
    title: 'Visão do Mercado',
    blurb:
      'Mapeamento de fornecedores, tendências, riscos e oportunidades.',
  },
  {
    n: 4,
    title: 'Estratégia de Sourcing',
    blurb:
      'Definição de como abordar o mercado — competição, parcerias, simplificação ou proteção.',
    available: { assistant: 'kraljic', label: 'Matriz de Kraljic' },
  },
  {
    n: 5,
    title: 'Engajamento de Fornecedores',
    blurb: 'Condução do processo de RFI, RFP ou RFQ.',
    available: { assistant: 'rfp', label: 'Gerador de RFP' },
  },
  {
    n: 6,
    title: 'Negociação',
    blurb:
      'Negociação estruturada para maximizar valor — não apenas reduzir preços.',
  },
  {
    n: 7,
    title: 'Implementação do Contrato',
    blurb: 'Formalização de acordos claros, alinhados com a estratégia.',
  },
  {
    n: 8,
    title: 'Controle e Melhoria',
    blurb: 'Monitoramento de KPIs, ajustes de estratégia, melhoria contínua.',
  },
];

export default function Landing() {
  return (
    <main className="min-h-screen bg-md-background font-roboto text-md-foreground antialiased">
      {/* ───── Hero ───── */}
      <section className="relative overflow-hidden px-4 pt-8 pb-12 md:pt-12 md:pb-20">
        <div className="relative mx-auto max-w-6xl rounded-md-lg md:rounded-md-hero bg-md-surface-container px-6 py-16 md:px-16 md:py-24 overflow-hidden">
          {/* Decorative organic blur shapes (Material You signature). */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-20 -right-20 h-80 w-80 rounded-full bg-md-primary/30 blur-3xl mix-blend-multiply"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-md-tertiary/25 blur-3xl mix-blend-multiply"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-1/3 left-1/2 h-64 w-64 rounded-full bg-md-secondary-container/60 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(103,80,164,0.12)_0%,_transparent_50%)]"
          />

          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full bg-md-primary-container px-4 py-1.5 text-xs font-medium text-md-on-primary-container">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Parte do ecossistema 2B Supply
            </div>

            <h1 className="mt-6 text-4xl md:text-6xl font-medium tracking-tight leading-[1.1] max-w-3xl">
              Procurement com{' '}
              <span className="text-md-primary">inteligência aplicada</span>.
            </h1>

            <p className="mt-6 text-lg md:text-xl text-md-on-surface-variant max-w-2xl leading-relaxed">
              Chat especialista treinado em centenas de artigos canônicos e
              assistentes que entregam artefatos prontos — alinhados aos 8
              passos do Strategic Sourcing.
            </p>

            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-md-primary text-md-on-primary px-8 h-12 text-sm font-medium shadow-sm hover:bg-md-primary/90 hover:shadow-md active:scale-95 transition-all duration-300 ease-md-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary focus-visible:ring-offset-2"
              >
                Entrar
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a
                href="#passos"
                className="inline-flex items-center justify-center rounded-full border border-md-outline text-md-primary px-8 h-12 text-sm font-medium hover:bg-md-primary/5 active:scale-95 transition-all duration-300 ease-md-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary focus-visible:ring-offset-2"
              >
                Conhecer os assistentes
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ───── 8 passos do Strategic Sourcing ───── */}
      <section
        id="passos"
        className="relative px-4 py-16 md:py-24"
      >
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <h2 className="text-3xl md:text-5xl font-medium tracking-tight">
              Os 8 passos do Strategic Sourcing
            </h2>
            <p className="mt-4 text-base md:text-lg text-md-on-surface-variant leading-relaxed">
              Cada passo ganha um assistente dedicado. Hoje, dois já entregam
              artefatos prontos; os demais estão na fila.
            </p>
          </div>

          <ol className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS.map((step) => (
              <li
                key={step.n}
                className="group relative rounded-md-lg bg-md-surface-container p-6 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-300 ease-md-standard"
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    aria-hidden="true"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-md-primary-container text-md-on-primary-container text-sm font-medium"
                  >
                    {step.n}
                  </div>
                  {step.available ? (
                    <span className="inline-flex items-center rounded-full bg-md-tertiary-container px-2.5 py-0.5 text-[10px] font-medium text-md-on-tertiary-container">
                      Disponível
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] text-md-on-surface-variant">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      Em breve
                    </span>
                  )}
                </div>
                <h3 className="mt-5 text-lg font-medium tracking-tight">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm text-md-on-surface-variant leading-relaxed">
                  {step.blurb}
                </p>
                {step.available && (
                  <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-md-primary">
                    {step.available.assistant === 'kraljic' ? (
                      <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {step.available.label}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ───── Chat especialista ───── */}
      <section className="relative px-4 py-16 md:py-24">
        <div className="relative mx-auto max-w-6xl rounded-md-xxl md:rounded-md-hero bg-md-secondary-container px-6 py-16 md:px-16 md:py-20 overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-20 -right-32 h-72 w-72 rounded-full bg-md-primary/20 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 right-1/4 h-64 w-64 rounded-full bg-md-tertiary/20 blur-3xl"
          />

          <div className="relative grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/50 backdrop-blur-sm px-4 py-1.5 text-xs font-medium text-md-on-secondary-container">
                <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                Chat com base de conhecimento
              </div>
              <h2 className="mt-6 text-3xl md:text-5xl font-medium tracking-tight text-md-on-secondary-container">
                Pergunte a um especialista sênior.
              </h2>
              <p className="mt-4 text-base md:text-lg text-md-on-secondary-container/80 leading-relaxed">
                Retrieval híbrido (vetorial + lexical + rerank) sobre uma
                biblioteca curada de Kraljic, Porter, Monczka, Cousins e
                outros — sem alucinação, sem citações soltas, com a profundidade
                de quem leu o material.
              </p>
              <Link
                href="/chat"
                className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-md-primary text-md-on-primary px-8 h-12 text-sm font-medium shadow-sm hover:bg-md-primary/90 hover:shadow-md active:scale-95 transition-all duration-300 ease-md-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary focus-visible:ring-offset-2"
              >
                Abrir o chat
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>

            {/* Mock-up bubble showing a chat turn */}
            <div className="relative">
              <div className="rounded-md-lg bg-white/70 backdrop-blur-sm border border-white/40 p-6 shadow-md">
                <p className="text-xs font-medium text-md-on-surface-variant uppercase tracking-wider">
                  Você
                </p>
                <p className="mt-2 text-sm text-md-foreground">
                  Como aplicar o quadrante &ldquo;Alavancável&rdquo; do Kraljic
                  em uma categoria de embalagens?
                </p>
                <div className="mt-5 rounded-md-md bg-md-primary-container p-4">
                  <p className="text-xs font-medium text-md-on-primary-container uppercase tracking-wider">
                    ProcurementGPT
                  </p>
                  <p className="mt-2 text-sm text-md-on-primary-container leading-relaxed">
                    Embalagens costumam cair em <em>Alavancável</em> quando há
                    alto impacto financeiro e mercado fornecedor maduro (Kraljic,
                    HBR 1983). A jogada padrão é leverage buying: pool spend,
                    competição cruzada e renegociação trimestral via RFQ...
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───── CTA final ───── */}
      <section className="relative px-4 pb-20 md:pb-32">
        <div className="relative mx-auto max-w-4xl rounded-md-xxl md:rounded-md-hero bg-md-primary text-md-on-primary px-6 py-16 md:px-16 md:py-20 overflow-hidden shadow-lg">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-32 -left-20 h-80 w-80 rounded-full bg-white/15 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-md-tertiary/40 blur-3xl"
          />

          <div className="relative text-center">
            <h2 className="text-3xl md:text-5xl font-medium tracking-tight">
              Pronto para acelerar seu sourcing?
            </h2>
            <p className="mt-4 text-base md:text-lg text-md-on-primary/85 max-w-xl mx-auto leading-relaxed">
              Acesso é por convite — faça login com a conta cadastrada pelo
              admin da sua organização.
            </p>
            <Link
              href="/login"
              className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-white text-md-primary px-8 h-12 text-sm font-medium shadow-sm hover:shadow-md active:scale-95 transition-all duration-300 ease-md-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-md-primary"
            >
              Entrar
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* ───── Footer ───── */}
      <footer className="border-t border-md-outline-variant px-4 py-8">
        <div className="mx-auto max-w-6xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs text-md-on-surface-variant">
          <div>
            ProcurementGPT · parte do ecossistema{' '}
            <a
              href="https://2bsupply.com.br/en/"
              target="_blank"
              rel="noreferrer noopener"
              className="text-md-primary hover:underline"
            >
              2B Supply
            </a>
          </div>
          <div className="flex gap-6">
            <Link href="/login" className="hover:text-md-foreground transition-colors">
              Entrar
            </Link>
            <a
              href="mailto:rgoalves@gmail.com"
              className="hover:text-md-foreground transition-colors"
            >
              Contato
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
