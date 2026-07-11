'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Header } from '../login/header';

import {
  ArrowRight,
  Search,
  Eye,
  ShieldCheck,
  Database,
  Clock,
  Mic,
  BarChart3,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

const BENEFITS = [
  {
    icon: BarChart3,
    title: 'Dashboard moderna',
    blurb:
      'Um painel visual e interativo reúne TODOS os seus dados em tempo real — gasto por categoria, top fornecedores, evolução mensal e uso da plataforma. É a sua central de BI, sem precisar montar um Power BI.',
  },
  {
    icon: Search,
    title: 'Busca inteligente',
    blurb:
      'A IA encontra respostas com mais precisão, cruzando contexto, palavras-chave e relevância do conteúdo.',
  },
  {
    icon: ShieldCheck,
    title: 'Sem alucinação',
    blurb:
      'Nada de resposta inventada. Se a informação não estiver na base, o bot avisa de forma transparente.',
  },
  {
    icon: Eye,
    title: 'PDF multimodal',
    blurb:
      'A IA entende textos, tabelas, figuras e gráficos dos PDFs, preservando o contexto da informação.',
  },
  {
    icon: Database,
    title: 'Biblioteca curada',
    blurb:
      'Seu time constrói uma base viva, organizada por temas, prioridades e conteúdos estratégicos.',
  },
  {
    icon: Clock,
    title: 'Histórico persistente',
    blurb:
      'Tudo que foi conversado, analisado ou solicitado fica salvo para consulta futura.',
  },
  {
    icon: Mic,
    title: 'Pedidos por áudio',
    blurb:
      'O comprador fala com a IA por áudio on-line e recebe respostas rápidas, sem ficar esperando no escuro.',
  },
];

// Showcase interativo de ferramentas — clicar na aba troca a tela + descrição.
// IMAGENS SÃO PLACEHOLDERS (Unsplash): trocar pelos prints reais de cada
// assistente quando disponíveis (decisão gestor 2026-07-08).
const USE_CASES = [
  {
    id: 'dashboard',
    tab: 'Dashboard',
    label: 'Painel · Todos os seus dados',
    desc: 'Uma dashboard moderna e interativa que mostra todos os seus dados em tempo real — gasto por categoria, top fornecedores, evolução mensal e uso da plataforma. Sem planilha, sem Power BI.',
    href: '/painel',
    soon: false,
    image:
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=800&q=80&auto=format&fit=crop',
    alt: 'Dashboard moderna com gráficos e KPIs (placeholder)',
  },
  {
    id: 'rfi-rfq',
    tab: 'RFI/RFQ',
    label: 'RFI/RFQ · Cotação inteligente',
    desc: 'Crie solicitações de cotação, compare fornecedores e organize propostas em poucos minutos.',
    href: '/assistants/rfp',
    soon: false,
    image:
      'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1200&h=800&q=80&auto=format&fit=crop',
    alt: 'Documentos e cotações — RFI/RFQ (placeholder)',
  },
  {
    id: 'abc',
    tab: 'Curva ABC',
    label: 'Curva ABC · Análise de gastos',
    desc: 'Classifique itens, fornecedores ou categorias por impacto financeiro e foque no que realmente pesa no resultado.',
    href: '/assistants/abc',
    soon: false,
    image:
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=800&q=80&auto=format&fit=crop',
    alt: 'Dashboard de analytics — Curva ABC (placeholder)',
  },
  {
    id: 'tco',
    tab: 'TCO Online',
    label: 'TCO Online · Custo total de compra',
    desc: 'Calcule o custo real da compra, incluindo preço, frete, impostos, riscos e condições comerciais.',
    href: null,
    soon: true,
    image:
      'https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=1200&h=800&q=80&auto=format&fit=crop',
    alt: 'Calculadora e planilhas — TCO (placeholder)',
  },
  {
    id: 'pedidos',
    tab: 'Pedidos',
    label: 'Pedidos · Acompanhamento inteligente',
    desc: 'Monitore pedidos em aberto, prazos, atrasos e pontos críticos antes que virem urgência.',
    href: null,
    soon: true,
    image:
      'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200&h=800&q=80&auto=format&fit=crop',
    alt: 'Painel de acompanhamento de pedidos (placeholder)',
  },
  {
    id: 'negociacao',
    tab: 'Negociação',
    label: 'Negociação · Analista em tempo real',
    desc: 'Receba apoio durante a negociação com argumentos, riscos, concessões e próximos passos.',
    href: null,
    soon: true,
    image:
      'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1200&h=800&q=80&auto=format&fit=crop',
    alt: 'Reunião de negociação (placeholder)',
  },
  {
    id: 'should-cost',
    tab: 'Should Cost',
    label: 'Should Cost · Preço justo',
    desc: 'Estime quanto um item deveria custar e use como referência para negociar com base em dados.',
    href: null,
    soon: true,
    image:
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&h=800&q=80&auto=format&fit=crop',
    alt: 'Gráficos de custo — Should Cost (placeholder)',
  },
];

const FEATURE_CARDS = [
  {
    title: 'Chat especialista',
    blurb:
      'Uma das melhores bases de conhecimento do mercado de IA em Suprimentos agora trabalha junto com o seu time. Reunimos centenas de processos e referências importantes, como Kraljic, Porter, Lean Six Sigma, PMI, dentre outras fontes, para criar uma inteligência capaz de responder como um especialista sênior da área de Suprimentos. Basta perguntar sua dúvida de forma simples, como você perguntaria a um colega experiente.',
    image:
      'https://images.unsplash.com/photo-1568667256549-094345857637?w=800&h=600&q=80&auto=format&fit=crop',
    alt: 'Biblioteca em espiral repleta de livros — base de conhecimento curada',
  },
  {
    title: '7 assistentes que executam',
    blurb:
      'Diversos assistentes já desenvolvidos que podem trabalhar para você de maneira automática.',
    image:
      'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&h=600&q=80&auto=format&fit=crop',
    alt: 'Documentos financeiros e calculadora — artefatos prontos para usar',
  },
  {
    title: 'Base checada por centenas de especialistas de Suprimentos',
    blurb:
      'Uma das melhores bases de IA em Suprimentos, criada com fontes confiáveis e selecionadas. O Chat busca as respostas com precisão, evita informações inventadas e não cria citações falsas. Quando não encontra uma fonte segura, ele simplesmente informa.',
    image:
      'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&h=600&q=80&auto=format&fit=crop',
    alt: 'Mão assinando um contrato — fundamentação documentada',
  },
];

export default function PricingPage() {
const router = useRouter();
const [activeTab, setActiveTab] = useState('dashboard');
const activeCase = USE_CASES.find((u) => u.id === activeTab) ?? USE_CASES[0]!;

  return (
    <>
      <Header />

      <div className="min-h-screen bg-background text-foreground">
   

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-12">

           <div className="max-w-7xl mx-auto px-0 sm:px-6 py-6 sm:py-16 flex items-center justify-between">
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
          className="px-0 sm:px-6 md:px-12 max-w-7xl mx-auto relative z-10"
        >
          <div className="mb-16 reveal">
            <div className="flex items-center gap-2 mb-4">
              <div
                aria-hidden="true"
                className="w-1.5 h-1.5 rounded-full bg-brand"
              />
              <span className="text-sm text-muted-foreground font-medium">
                PROGPT · uma plataforma 2BSUPPLY
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight max-w-4xl">
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
          className="mt-10 py-16 sm:py-24 px-0 sm:px-6 md:px-12 max-w-7xl border-border"
        >
                 <div className="flex items-center gap-2 mb-4">
              <div
                aria-hidden="true"
                className="w-1.5 h-1.5 rounded-full bg-brand"
              />
              <span className="text-sm text-muted-foreground font-medium">
                Assistentes Estratégicos
              </span>
            </div>

          <div className="mb-12 reveal">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight max-w-4xl">
              <span className="text-foreground">Diferentes caminhos,</span>{' '}
              <span className="text-brand">guiados por um especialista silencioso.</span>
            </h2>
          </div>

          <div className="reveal">
            <div className="flex space-x-6 border-b border-border mb-10 overflow-x-auto whitespace-nowrap pb-px">
              {USE_CASES.map((uc) => (
                <button
                  key={uc.id}
                  type="button"
                  onClick={() => setActiveTab(uc.id)}
                  className={`border-b-2 pb-3 px-1 text-sm font-medium transition-colors ${
                    activeTab === uc.id
                      ? 'text-foreground border-brand'
                      : 'text-muted-foreground hover:text-foreground border-transparent'
                  }`}
                >
                  {uc.tab}
                  {uc.soon && (
                    <span className="ml-1 text-xs text-muted-foreground">(em breve)</span>
                  )}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="rounded-2xl overflow-hidden bg-card aspect-video relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={activeCase.image}
                  src={activeCase.image}
                  alt={activeCase.alt}
                  className="w-full h-full object-cover"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-tr from-brand/10 via-transparent to-transparent"
                />
              </div>
              <div className="lg:pl-8">
                <span className="text-sm text-brand mb-4 block font-medium">
                  {activeCase.label}
                </span>
                <h3 className="text-3xl font-medium text-foreground mb-6 leading-tight">
                  {activeCase.desc}
                </h3>
                {activeCase.soon ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-4 py-2 text-sm font-medium text-muted-foreground">
                    Em breve
                  </span>
                ) : (
                  <Link
                    href="/signup"
                    className="inline-flex items-center justify-center gap-2 bg-brand-gradient text-black px-6 py-2.5 rounded-full text-sm font-medium hover:bg-brand/90 active:scale-95 transition-all duration-300"
                  >
                    Faça sua inscrição e conheça o Assistente
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>

  {/* ───── Seção Benefícios ───── */}
    <section
          id="beneficios"
          className="mt-10 px-0 sm:px-6 md:px-12 max-w-7xl mx-auto border-border"
        >
               <div className="flex items-center gap-2 mb-4">
              <div
                aria-hidden="true"
                className="w-1.5 h-1.5 rounded-full bg-brand"
              />
              <span className="text-sm text-muted-foreground font-medium">
                Benefícios estratégicos para Suprimentos
              </span>
            </div>

             <h2 className="mb-16 text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight max-w-4xl">
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
                  className={`bg-card p-8 reveal hover:bg-accent transition-colors ${
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