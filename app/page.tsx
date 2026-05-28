'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import {
  ArrowRight,
  Plus,
  Zap,
  Eye,
  ShieldCheck,
  Database,
  Clock,
  Layers,
} from 'lucide-react';

// Landing page — dark atmospheric aesthetic ported from a reference
// design, adapted with 2B Supply brand colors (cyan #0ed1e0). Uses the
// brand Outfit font (loaded in app/layout.tsx). All other surfaces in
// the app keep their light shadcn tokens — this is a self-contained dark
// landing that does NOT cascade.
//
// Reveal-on-scroll uses a single IntersectionObserver registered in
// useEffect — no animation library dependency.

const NAV_LINKS = [
  { href: '#sobre', label: 'Sobre' },
  { href: '#assistentes', label: 'Assistentes' },
  { href: '#como-funciona', label: 'Como funciona' },
  { href: '/pricing', label: 'Planos' },
  { href: '#faq', label: 'FAQ' },
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

const STEPS = [
  {
    n: 1,
    title: 'Pergunte',
    blurb:
      'Texto livre, PT ou EN. Faça a pergunta como faria para um colega sênior — sem reescrever em "linguagem de IA".',
  },
  {
    n: 2,
    title: 'Recupere',
    blurb:
      'Retrieval híbrido busca, rankeia e injeta os trechos mais relevantes da biblioteca curada antes do modelo responder.',
  },
  {
    n: 3,
    title: 'Aplique',
    blurb:
      'Receba uma resposta com profundidade de especialista — ou, se for um assistente, um artefato pronto em .docx / .xlsx.',
  },
];

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

const FAQS = [
  'O que é o PROGPT?',
  'Qual a diferença em relação ao ChatGPT genérico?',
  'A base de conhecimento é da minha empresa ou compartilhada?',
  'Quanto custa? Tem plano gratuito?',
  'Como funcionam os 7 assistentes (RFP, Kraljic, Negociação…)?',
  'Posso baixar os artefatos em Word ou Excel?',
  'Como cancelo a assinatura?',
];

export default function Landing() {
  // Reveal-on-scroll: add `active` class when element enters viewport.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('active');
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 },
    );
    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Navbar scroll effect — solidify on scroll past 50px.
  useEffect(() => {
    const navbar = document.getElementById('landing-navbar');
    if (!navbar) return;
    const onScroll = () => {
      if (window.scrollY > 50) {
        navbar.classList.add('bg-black/80', 'backdrop-blur-xl');
        navbar.classList.remove('bg-black/20');
      } else {
        navbar.classList.add('bg-black/20');
        navbar.classList.remove('bg-black/80', 'backdrop-blur-xl');
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <style jsx global>{`
        .reveal {
          opacity: 0;
          transform: translateY(30px);
          transition: opacity 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94),
            transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        .reveal.active {
          opacity: 1;
          transform: translateY(0);
        }
        .reveal-delay-1 {
          transition-delay: 100ms;
        }
        .reveal-delay-2 {
          transition-delay: 200ms;
        }
        .reveal-delay-3 {
          transition-delay: 300ms;
        }
        .landing-text-gradient {
          background: linear-gradient(180deg, #ffffff 0%, #a3a3a3 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
      `}</style>

      <div className="min-h-screen bg-[#0d0d0d] text-white font-outfit antialiased overflow-x-hidden selection:bg-brand selection:text-black">
        {/* ───── Navbar ───── */}
        <nav
          id="landing-navbar"
          className="fixed top-0 left-0 w-full z-50 transition-all duration-300 backdrop-blur-md bg-black/20 border-b border-white/5 py-4 px-6 md:px-12 flex justify-between items-center"
        >
          <Link href="/" className="flex items-center">
            <BrandLogo size="md" priority />
          </Link>

          <div className="hidden md:flex space-x-8 items-center text-sm font-medium text-gray-300">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="hover:text-white transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>

          <Link
            href="/login"
            className="inline-flex items-center justify-center bg-brand text-black px-5 h-9 rounded-full text-sm font-medium hover:bg-brand/90 active:scale-95 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0d0d]"
          >
            Entrar
          </Link>
        </nav>

        {/* ───── Hero ───── */}
        <section className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
          <div className="absolute inset-0 z-0 pointer-events-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1494412651409-8963ce7935a7?w=1600&h=1080&q=80&auto=format&fit=crop"
              alt=""
              aria-hidden="true"
              className="w-full h-full object-cover opacity-70"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0d0d0d]/80 to-[#0d0d0d]" />
            {/* Cyan glow shape to reinforce brand */}
            <div
              aria-hidden="true"
              className="absolute top-1/4 right-1/4 h-96 w-96 rounded-full bg-brand/20 blur-3xl mix-blend-screen"
            />
          </div>

          <div className="relative z-10 text-center px-6 max-w-4xl mx-auto flex flex-col items-center mt-16 md:mt-0">
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-medium tracking-tighter leading-[1.05] mb-6 reveal">
              <span className="text-white">Onde decisões</span>
              <br />
              <span className="text-brand">ganham profundidade.</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-300 mb-10 max-w-xl mx-auto reveal reveal-delay-1 leading-relaxed font-light">
              Um especialista de procurement com a clareza de quem leu Kraljic,
              Porter, Monczka e Cousins — e a velocidade da IA.
            </p>
            <div className="reveal reveal-delay-2 flex flex-wrap gap-3 justify-center">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 bg-brand text-black px-8 py-3 rounded-full text-sm font-medium hover:bg-brand/90 active:scale-95 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0d0d]"
              >
                Começar agora
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
              <a
                href="#assistentes"
                className="inline-flex items-center justify-center bg-white/5 text-white px-8 py-3 rounded-full text-sm font-medium hover:bg-white/10 active:scale-95 transition-all duration-300 border border-white/10"
              >
                Ver assistentes
              </a>
            </div>
          </div>

          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center opacity-50 reveal reveal-delay-3">
            <svg
              className="w-5 h-5 mb-2 animate-bounce"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
            <span className="text-xs uppercase tracking-widest">Role para explorar</span>
          </div>
        </section>

        {/* ───── Intro · 3 cards ───── */}
        <section
          id="sobre"
          className="py-24 px-6 md:px-12 max-w-7xl mx-auto relative z-10 bg-[#0d0d0d]"
        >
          <div className="mb-16 reveal">
            <div className="flex items-center gap-2 mb-4">
              <div
                aria-hidden="true"
                className="w-1.5 h-1.5 rounded-full bg-brand"
              />
              <span className="text-sm text-gray-400 font-medium">
                PROGPT · uma plataforma 2B Supply
              </span>
            </div>
            <h2 className="text-4xl md:text-5xl font-medium tracking-tight max-w-4xl">
              <span className="text-white">Inteligência invisível</span>{' '}
              <span className="text-gray-500">
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
                <div className="rounded-2xl overflow-hidden mb-6 bg-[#1a1a1a] aspect-[4/3] relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={card.image}
                    alt={card.alt}
                    className="w-full h-full object-cover opacity-80 mix-blend-luminosity hover:mix-blend-normal transition-all duration-500"
                  />
                </div>
                <h3 className="text-xl font-medium text-white mb-2">{card.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{card.blurb}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ───── Use cases (tabs simulado) ───── */}
        <section
          id="assistentes"
          className="py-24 px-6 md:px-12 max-w-7xl mx-auto border-t border-white/5"
        >
          <div className="mb-12 reveal">
            <div className="flex items-center gap-2 mb-4">
              <div aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-brand" />
              <span className="text-sm text-gray-400 font-medium">Casos de uso</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-medium tracking-tight max-w-4xl">
              <span className="text-white">Diferentes caminhos,</span>{' '}
              <span className="text-gray-500">guiados por um especialista silencioso.</span>
            </h2>
          </div>

          <div className="reveal">
            <div className="flex space-x-6 border-b border-white/10 mb-10 overflow-x-auto whitespace-nowrap pb-px">
              <button className="text-white border-b-2 border-brand pb-3 px-1 text-sm font-medium">
                Estratégia · Kraljic
              </button>
              <button className="text-gray-500 hover:text-gray-300 border-b-2 border-transparent pb-3 px-1 text-sm font-medium transition-colors">
                RFP / RFQ
              </button>
              <button className="text-gray-500 hover:text-gray-300 border-b-2 border-transparent pb-3 px-1 text-sm font-medium transition-colors">
                Análise de portfólio
              </button>
              <button className="text-gray-500 hover:text-gray-300 border-b-2 border-transparent pb-3 px-1 text-sm font-medium transition-colors">
                Negociação <span className="ml-1 text-xs text-gray-600">(em breve)</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="rounded-2xl overflow-hidden bg-[#1a1a1a] aspect-video relative">
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
                <h3 className="text-3xl font-medium text-white mb-6 leading-tight">
                  {USE_CASES[0]!.title}
                </h3>
                <Link
                  href={USE_CASES[0]!.href}
                  className="inline-flex items-center justify-center gap-2 bg-brand text-black px-6 py-2.5 rounded-full text-sm font-medium hover:bg-brand/90 active:scale-95 transition-all duration-300"
                >
                  Conhecer o assistente
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ───── How It Works ───── */}
        <section
          id="como-funciona"
          className="py-24 px-6 md:px-12 max-w-7xl mx-auto border-t border-white/5"
        >
          <div className="mb-16 reveal">
            <div className="flex items-center gap-2 mb-4">
              <div aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-brand" />
              <span className="text-sm text-gray-400 font-medium">Como funciona</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-medium tracking-tight">
              <span className="text-white">Uma pergunta,</span>
              <br />
              <span className="text-gray-500">três passos até a clareza.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1 rounded-2xl overflow-hidden bg-[#1a1a1a] aspect-[4/3] relative reveal">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=1000&h=800&q=80&auto=format&fit=crop"
                alt=""
                aria-hidden="true"
                className="w-full h-full object-cover opacity-90"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-brand/15"
              />
            </div>

            <div className="order-1 lg:order-2 space-y-12">
              {STEPS.map((step, idx) => (
                <div
                  key={step.n}
                  className={`flex gap-6 reveal ${
                    idx === 1 ? 'reveal-delay-1' : idx === 2 ? 'reveal-delay-2' : ''
                  }`}
                >
                  <div className="mt-1 flex-shrink-0 w-10 h-10 rounded-full border border-brand/30 bg-brand/5 flex items-center justify-center text-brand text-sm font-medium">
                    {step.n}
                  </div>
                  <div>
                    <h4 className="text-xl font-medium text-white mb-2">{step.title}</h4>
                    <p className="text-gray-400 text-sm leading-relaxed">{step.blurb}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ───── Benefits grid ───── */}
        <section
          id="beneficios"
          className="py-24 px-6 md:px-12 max-w-7xl mx-auto border-t border-white/5"
        >
          <div className="mb-16 reveal">
            <div className="flex items-center gap-2 mb-4">
              <div aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-brand" />
              <span className="text-sm text-gray-400 font-medium">Benefícios</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-medium tracking-tight max-w-4xl">
              <span className="text-white">Poder invisível ao seu lado,</span>{' '}
              <span className="text-gray-500">entregando resultados todos os dias.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/5 border border-white/5 rounded-2xl overflow-hidden">
            {BENEFITS.map((b, idx) => {
              const Icon = b.icon;
              return (
                <div
                  key={b.title}
                  className={`bg-[#111111] p-8 reveal hover:bg-[#151515] transition-colors ${
                    idx % 3 === 1
                      ? 'reveal-delay-1'
                      : idx % 3 === 2
                        ? 'reveal-delay-2'
                        : ''
                  }`}
                >
                  <div className="w-10 h-10 rounded-full border border-brand/30 bg-brand/5 flex items-center justify-center mb-6 text-brand">
                    <Icon className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <h4 className="text-white font-medium mb-3">{b.title}</h4>
                  <p className="text-gray-400 text-sm leading-relaxed">{b.blurb}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ───── Planos ───── */}
        <section id="planos" className="py-24 px-6 md:px-12 max-w-7xl mx-auto border-t border-white/5">
          <div className="mb-12 reveal">
            <div className="flex items-center gap-2 mb-4">
              <div aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-brand" />
              <span className="text-sm text-gray-400 font-medium">Planos</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-medium tracking-tight max-w-3xl">
              <span className="text-white">Comece grátis,</span>{' '}
              <span className="text-gray-500">faça upgrade quando precisar.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 reveal">
            {/* Free */}
            <div className="bg-[#111111] border border-white/5 rounded-2xl p-8 flex flex-col">
              <div className="text-xs uppercase tracking-wider text-gray-400 mb-2">Free</div>
              <div className="text-4xl font-medium text-white mb-1">R$ 0</div>
              <div className="text-xs text-gray-500 mb-6">grátis pra sempre</div>
              <ul className="space-y-2 text-sm text-gray-300 mb-8 flex-1">
                <li className="flex gap-2"><span className="text-brand">✓</span> Chat especialista ilimitado</li>
                <li className="flex gap-2"><span className="text-brand">✓</span> 1 execução grátis de cada assistente (lifetime)</li>
                <li className="flex gap-2"><span className="text-brand">✓</span> Suporte pela comunidade</li>
              </ul>
              <Link
                href="/signup"
                className="inline-flex w-full items-center justify-center gap-2 bg-white/5 border border-white/10 text-white py-2.5 rounded-full text-sm font-medium hover:bg-white/10 active:scale-95 transition-all duration-300"
              >
                Criar conta grátis
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>

            {/* Pro */}
            <div className="relative bg-[#1a1a1a] border-2 border-brand rounded-2xl p-8 flex flex-col">
              <div className="absolute -top-3 left-8 bg-brand text-black text-[10px] uppercase tracking-wider font-semibold px-3 py-1 rounded-full">
                Recomendado
              </div>
              <div className="text-xs uppercase tracking-wider text-brand mb-2">Pro</div>
              <div className="flex items-baseline gap-1 mb-1">
                <div className="text-4xl font-medium text-white">R$ 99</div>
                <div className="text-sm text-gray-400">/mês</div>
              </div>
              <div className="text-xs text-gray-500 mb-6">cancele quando quiser</div>
              <ul className="space-y-2 text-sm text-gray-300 mb-8 flex-1">
                <li className="flex gap-2"><span className="text-brand">✓</span> Tudo do Free</li>
                <li className="flex gap-2"><span className="text-brand">✓</span> 7 assistentes ilimitados (RFP, Kraljic, Negociação, etc.)</li>
                <li className="flex gap-2"><span className="text-brand">✓</span> Geração ilimitada de .docx e .xlsx</li>
                <li className="flex gap-2"><span className="text-brand">✓</span> Suporte por email</li>
              </ul>
              <Link
                href="/pricing"
                className="inline-flex w-full items-center justify-center gap-2 bg-brand text-black py-2.5 rounded-full text-sm font-medium hover:bg-brand/90 active:scale-95 transition-all duration-300"
              >
                Ver detalhes do Pro
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {/* ───── FAQ ───── */}
        <section
          id="faq"
          className="py-24 px-6 md:px-12 max-w-7xl mx-auto border-t border-white/5"
        >
          <div className="mb-16 reveal">
            <div className="flex items-center gap-2 mb-4">
              <div aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-brand" />
              <span className="text-sm text-gray-400 font-medium">FAQ</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-medium tracking-tight">
              <span className="text-white">Suas dúvidas,</span>{' '}
              <span className="text-gray-500">respondidas com clareza.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-4 reveal">
            <div className="space-y-4">
              {FAQS.slice(0, 3).map((q) => (
                <div
                  key={q}
                  className="border-b border-white/5 py-4 flex justify-between items-center cursor-pointer group"
                >
                  <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                    {q}
                  </span>
                  <Plus className="w-4 h-4 text-gray-500 group-hover:text-brand transition-colors" aria-hidden="true" />
                </div>
              ))}
            </div>
            <div className="space-y-4">
              {FAQS.slice(3).map((q) => (
                <div
                  key={q}
                  className="border-b border-white/5 py-4 flex justify-between items-center cursor-pointer group"
                >
                  <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                    {q}
                  </span>
                  <Plus className="w-4 h-4 text-gray-500 group-hover:text-brand transition-colors" aria-hidden="true" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ───── Final CTA ───── */}
        <section className="py-12 px-6 md:px-12 max-w-7xl mx-auto reveal">
          <div className="relative rounded-3xl overflow-hidden min-h-[400px] flex items-center p-8 md:p-12">
            <div className="absolute inset-0 z-0 pointer-events-none">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&h=600&q=80&auto=format&fit=crop"
                alt=""
                aria-hidden="true"
                className="w-full h-full object-cover opacity-50"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#0d0d0d] via-[#0d0d0d]/80 to-transparent" />
              <div
                aria-hidden="true"
                className="absolute top-1/3 right-1/4 h-72 w-72 rounded-full bg-brand/25 blur-3xl mix-blend-screen"
              />
            </div>

            <div className="relative z-10 max-w-lg">
              <h2 className="text-4xl md:text-5xl font-medium text-white mb-6 leading-tight">
                Da pergunta ao artefato,{' '}
                <span className="text-brand">sem fricção.</span>
              </h2>
              <p className="text-gray-300 mb-8 leading-relaxed">
                Acesso é por convite. Entre com a conta cadastrada pelo admin da
                sua organização.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 bg-brand text-black px-8 py-3 rounded-full text-sm font-medium hover:bg-brand/90 active:scale-95 transition-all duration-300"
              >
                Entrar agora
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {/* ───── Footer ───── */}
        <footer className="py-12 px-6 md:px-12 max-w-7xl mx-auto border-t border-white/5 mt-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
            <div className="max-w-xs">
              <div className="mb-4">
                <BrandLogo size="lg" />
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">
                PROGPT — plataforma 2B Supply. Inteligência aplicada para cada
                passo do Strategic Sourcing.
              </p>
            </div>

            <div className="space-y-3">
              <span className="text-sm font-medium text-white block">Navegação</span>
              <div className="flex flex-col gap-2">
                {NAV_LINKS.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="text-sm text-gray-500 hover:text-white transition-colors"
                  >
                    {link.label}
                  </a>
                ))}
                <Link
                  href="/login"
                  className="text-sm text-gray-500 hover:text-white transition-colors"
                >
                  Entrar
                </Link>
              </div>
            </div>

            <div className="space-y-3">
              <span className="text-sm font-medium text-white block">Contato</span>
              <div className="text-sm text-gray-500 leading-relaxed space-y-1">
                <div>2B Supply</div>
                <div>CNPJ 36.335.299/0001-82</div>
                <a
                  href="tel:+5521999792912"
                  className="block hover:text-white transition-colors"
                >
                  +55 (21) 99979-2912
                </a>
                <a
                  href="mailto:comercial@2bsupply.com.br"
                  className="block hover:text-white transition-colors"
                >
                  comercial@2bsupply.com.br
                </a>
                <a
                  href="https://2bsupply.com.br/en/"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-block hover:text-brand transition-colors mt-1 text-xs"
                >
                  2bsupply.com.br ↗
                </a>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-white/5 flex flex-wrap items-center justify-between gap-4 text-xs text-gray-600">
            <div>© 2026 2B Supply · Todos os direitos reservados</div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <Link href="/termos" className="hover:text-white transition-colors">
                Termos de Uso
              </Link>
              <Link href="/privacidade" className="hover:text-white transition-colors">
                Privacidade
              </Link>
              <Link href="/cookies" className="hover:text-white transition-colors">
                Cookies
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
