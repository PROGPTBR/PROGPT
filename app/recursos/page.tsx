'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Header } from '../login/header';

import {
  ArrowRight,
  Zap,
  Eye,
  ShieldCheck,
  Database,
  Clock,
  Layers,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

const BENEFITS = [
  {
    icon: Layers,
    title: 'Retrieval híbrido',
    blurb: 'Vetorial + lexical FTS + Cohere rerank — nunca só cosine.',
  },
  {
    icon: ShieldCheck,
    title: 'Sem alucinação',
    blurb:
      'Respostas fundamentadas na base. Sem fonte, o bot diz. Sem IDs ou citações falsas no texto.',
  },
  {
    icon: Eye,
    title: 'PDF multimodal',
    blurb:
      'Tabelas e figuras viram chunks dedicados. Captions e estrutura preservadas.',
  },
  {
    icon: Database,
    title: 'Biblioteca curada',
    blurb:
      'Admin controla taxonomia, classifica candidatos, promove temas canônicos quando estabilizam.',
  },
  {
    icon: Clock,
    title: 'Histórico persistente',
    blurb:
      'Cada conversa e cada RFP/análise fica salva — recuperável a qualquer momento.',
  },
  {
    icon: Zap,
    title: 'Streaming nativo',
    blurb: 'Resposta começa em < 3s via SSE. Sem tela em branco esperando.',
  },
];

const USE_CASES = [
  {
    id: 'kraljic',
    label: 'Estratégia · Kraljic',
    title:
      'Classifique 30 categorias em 5 minutos e receba um plano de ação por quadrante.',
    href: '/assistants/kraljic',
    image:
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=800&q=80&auto=format&fit=crop',
    alt: 'Dashboard de analytics com gráficos — visualização de portfólio',
  },
];

const FEATURE_CARDS = [
  {
    title: 'Chat especialista',
    blurb:
      'Centenas de artigos canônicos (Kraljic, Porter, Monczka, Cousins) viraram a memória do seu time. Pergunte como faria para um colega sênior.',
    image:
      'https://images.unsplash.com/photo-1568667256549-094345857637?w=800&h=600&q=80&auto=format&fit=crop',
    alt: 'Biblioteca em espiral repleta de livros — base de conhecimento curada',
  },
  {
    title: '7 assistentes que executam',
    blurb:
      'Perfil de Categoria, ABC, Porter, Busca de Fornecedores, Kraljic, RFP, Negociação, Análise Financeira — cada passo do Strategic Sourcing com um assistente próprio que entrega o artefato pronto em .docx/.xlsx.',
    image:
      'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&h=600&q=80&auto=format&fit=crop',
    alt: 'Documentos financeiros e calculadora — artefatos prontos para usar',
  },
  {
    title: 'Base curada',
    blurb:
      'Retrieval híbrido (vetorial + lexical + rerank) com gate de relevância — sem alucinação, sem citação fake. Quando não tem fonte na base, o bot diz.',
    image:
      'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&h=600&q=80&auto=format&fit=crop',
    alt: 'Mão assinando um contrato — fundamentação documentada',
  },
];

export default function PricingPage() {
const router = useRouter();

  return (
    <>
      <Header />

      <div className="min-h-screen bg-background text-foreground">
   

        <main className="max-w-7xl mx-auto px-6 py-12">

           <div className="max-w-7xl mx-auto px-6 py-16 flex items-center justify-between">
    <button
  onClick={() => router.back()}
  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-brand transition-colors"
>
  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
  Voltar
</button>

          </div>

          <div className="flex items-center gap-2 mb-4">
          <h1 className="text-3xl text-foreground md:text-4xl font-semibold tracking-tight mx-auto text-center">
          Recursos <span className="text-brand">.</span>
        </h1>
</div>

 {/* ───── Intro · 3 cards ───── */}
        <section
          id="sobre"
          className="px-6 md:px-12 max-w-7xl mx-auto relative z-10"
        >
          <div className="mb-16 reveal">
            <div className="flex items-center gap-2 mb-4">
              <div
                aria-hidden="true"
                className="w-1.5 h-1.5 rounded-full bg-brand"
              />
              <span className="text-sm text-muted-foreground font-medium">
                PROGPT · uma plataforma 2B Supply
              </span>
            </div>
            <h2 className="text-4xl md:text-5xl font-medium tracking-tight max-w-4xl">
              <span className="text-foreground">Inteligência invisível</span>{' '}
              <span className="text-brand">
                acelerando cada um dos 8 passos do Strategic Sourcing.
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURE_CARDS.map((card, idx) => (
              <div
                key={card.title}
                className={`reveal ${
                  idx === 1 ? 'reveal-delay-1' : idx === 2 ? 'reveal-delay-2' : ''
                }`}
              >
                <div className="rounded-2xl overflow-hidden mb-6 bg-card aspect-[4/3] relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={card.image}
                    alt={card.alt}
                    className="w-full h-full object-cover opacity-80 mix-blend-luminosity hover:mix-blend-normal transition-all duration-500"
                  />
                </div>
                <h3 className="text-xl font-medium text-foreground mb-2">{card.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{card.blurb}</p>
              </div>
            ))}
          </div>
        </section>


{/* ───── Use cases (tabs simulado) ───── */}
        <section
          id="assistentes"
          className="mt-10 py-24 px-6 md:px-12 max-w-7xl border-border"
        >
                 <div className="flex items-center gap-2 mb-4">
              <div
                aria-hidden="true"
                className="w-1.5 h-1.5 rounded-full bg-brand"
              />
              <span className="text-sm text-muted-foreground font-medium">
                Casos de uso
              </span>
            </div>

          <div className="mb-12 reveal">
            <h2 className="text-4xl md:text-5xl font-medium tracking-tight max-w-4xl">
              <span className="text-foreground">Diferentes caminhos,</span>{' '}
              <span className="text-brand">guiados por um especialista silencioso.</span>
            </h2>
          </div>

          <div className="reveal">
            <div className="flex space-x-6 border-b border-border mb-10 overflow-x-auto whitespace-nowrap pb-px">
              <button className="text-foreground border-b-2 border-brand pb-3 px-1 text-sm font-medium">
                Estratégia · Kraljic
              </button>
              <button className="text-muted-foreground hover:text-muted-foreground border-b-2 border-transparent pb-3 px-1 text-sm font-medium transition-colors">
                RFP / RFQ
              </button>
              <button className="text-muted-foreground hover:text-muted-foreground border-b-2 border-transparent pb-3 px-1 text-sm font-medium transition-colors">
                Análise de portfólio
              </button>
              <button className="text-muted-foreground hover:text-muted-foreground border-b-2 border-transparent pb-3 px-1 text-sm font-medium transition-colors">
                Negociação <span className="ml-1 text-xs text-muted-foreground">(em breve)</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="rounded-2xl overflow-hidden bg-card aspect-video relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={USE_CASES[0]!.image}
                  alt={USE_CASES[0]!.alt}
                  className="w-full h-full object-cover"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-tr from-brand/10 via-transparent to-transparent"
                />
              </div>
              <div className="lg:pl-8">
                <span className="text-sm text-brand mb-4 block font-medium">
                  {USE_CASES[0]!.label}
                </span>
                <h3 className="text-3xl font-medium text-foreground mb-6 leading-tight">
                  {USE_CASES[0]!.title}
                </h3>
                <Link
                  href={USE_CASES[0]!.href}
                  className="inline-flex items-center justify-center gap-2 bg-brand-gradient text-black px-6 py-2.5 rounded-full text-sm font-medium hover:bg-brand/90 active:scale-95 transition-all duration-300"
                >
                  Conhecer o assistente
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </section>

  {/* ───── Seção Benefícios ───── */}
    <section
          id="beneficios"
          className="mt-10 px-6 md:px-12 max-w-7xl mx-auto border-border"
        >
               <div className="flex items-center gap-2 mb-4">
              <div
                aria-hidden="true"
                className="w-1.5 h-1.5 rounded-full bg-brand"
              />
              <span className="text-sm text-muted-foreground font-medium">
                Benefícios 
              </span>
            </div>

             <h2 className="mb-16 text-4xl md:text-5xl font-medium tracking-tight max-w-4xl">
              <span className="text-foreground">Poder invisível ao seu lado,</span>{' '}
              <span className="text-brand">
                entregando resultados todos os dias.
              </span>
            </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-muted border border-border rounded-2xl overflow-hidden">
            {BENEFITS.map((b, idx) => {
              const Icon = b.icon;
              return (
                <div
                  key={b.title}
                  className={`bg-[#080c16] p-8 reveal hover:bg-[#060a1426] transition-colors ${
                    idx % 3 === 1
                      ? 'reveal-delay-1'
                      : idx % 3 === 2
                        ? 'reveal-delay-2'
                        : ''
                  }`}
                >
                    
                  <div className="w-14 h-14 rounded-full border border-brand/30 bg-brand/5 flex items-center justify-center mb-6 text-brand">
                    <Icon className="w-7 h-7" aria-hidden="true" />
                  </div>
                  <h4 className="text-foreground font-medium mb-3">{b.title}</h4>
                  <p className="text-muted-foreground text-sm leading-relaxed">{b.blurb}</p>
                </div>
              );
            })}
          </div>
        </section>


        </main>
      </div>
    </>
  );
}