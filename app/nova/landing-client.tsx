'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { PricingTable } from '@/components/billing/PricingTable';
import { HeroVideo } from './HeroVideo';
import { FaWhatsapp } from "react-icons/fa";
import { FiMail, FiFileText } from "react-icons/fi";
import {
  ArrowRight,
  Bot,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Database,
  Eye,
  Headphones,
  Layers,
  Library,
  LogIn,
  Menu,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  X,
  Zap,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import styles from './nova.module.css';
import CertificacoesGrid from '@/app/certificacoes/CertificacoesGrid';
/* ============================================================
   FEATURES
============================================================ */
const features = [
  {
    icon: Layers,
    title: 'Assistentes prontos para Suprimentos',
    text:
      'Execute análises, cotações, gestão de contratos, simulador de negociações e criação de dashboards prontos para uso sem precisar começar cada processo do zero.',
  },
  {
    icon: ShieldCheck,
    title: 'Fornecedores encontrados e homologados',
    text:
      'Encontre novas opções, organize documentos e avalie riscos para tomar decisões com mais segurança e agilidade.',
  },
  {
    icon: Eye,
    title: 'Propostas analisadas em segundos mostrando o custo real',
    text:
      'Compare preços, analise tributos, fretes e DIFAL, Monitore prazos e faça analise de riscos. A PROGPT ajuda você com base em um TCO completo a escolher a melhor proposta não apenas a mais barata.',
  },
  {
    icon: Database,
    title: 'Gestão de Contratos sob controle',
    text:
      'Identifique cláusulas críticas, obrigações, penalidades, reajustes, prazos e riscos antes que se transformem em problemas. Faça uma analise de um contratos em poucos minutos.',
  },
  {
    icon: Clock,
    title: 'Inteligência especializada em Compras',
    text:
      'Receba respostas fundamentadas no universo de Suprimentos Estratégicos, com conhecimento estruturado para apoiar decisões reais.',
  },
  {
    icon: Zap,
    title: 'Dados transformados em decisões',
    text:
      'Crie análises, relatórios e painéis em BI interativos para acompanhar compras, contratos, fornecedores e indicadores de desempenho.',
  },
];
/* ============================================================
   FAQ
============================================================ */
const faqs = [
  [
    'O que é o PROGPT?',
    'Uma plataforma de inteligência artificial especializada em Suprimentos, criada para apoiar análises, cotações, contratos, negociação e estratégia.',
  ],
  [
    'Qual a diferença para uma IA genérica?',
    'O PROGPT reúne contexto, fluxos e assistentes desenhados para a rotina de Compras, com entregáveis práticos e linguagem da área.',
  ],
  [
    'Como a tecnologia da PROGPT torna as respostas mais rápidas e precisas ?',
    'A PROGPT utiliza uma arquitetura desenvolvida para oferecer mais qualidade, velocidade e continuidade nas análises:\n- Retrieval híbrido: combina pesquisa semântica e busca por palavras-chave para localizar as informações mais relevantes antes de elaborar a resposta.\n- PDF multimodal: interpreta textos, tabelas, imagens e estruturas presentes em documentos, propostas e contratos em PDF.\n- Histórico persistente: mantém o contexto das conversas e análises anteriores, permitindo retomar processos sem precisar começar tudo novamente.\n- Streaming nativo: apresenta a resposta à medida que ela é processada, reduzindo o tempo de espera durante a utilização.\nNa prática, esses recursos permitem análises mais ágeis, contextualizadas e adequadas às atividades de Compras e Suprimentos',
  ],
  [
    'Posso usar no celular?',
    'Sim. A plataforma funciona no navegador e pode ser instalada como aplicativo.',
  ],
  [
    'Meus dados ficam seguros?',
    'Seus dados são privados e protegidos. Aplicamos controles de acesso e boas práticas de segurança em toda a plataforma.',
  ],
  [
    'Posso cancelar quando quiser?',
    'Sim. Você pode interromper a renovação da assinatura sem burocracia.',
  ],
];
/* ============================================================
   ASSISTENTES / CASOS DE USO
============================================================ */
const useCases = [
  {
    tab: 'Dashboard',
    label: 'PAINEL CUSTOMIZÁVEL | TODA A OPERAÇÃO EM UM SÓ LUGAR',
    title:
      'Da solicitação de compra à entrega ao cliente: toda a sua operação sob controle.\n\n' +
      'Centralize em um poderoso dashboard as solicitações da produção, cotações, pendências com fornecedores, pedidos, prazos, entregas e localização das cargas.\n\n' +
      'Crie métricas, alertas e novos processos de acompanhamento totalmente adaptados à realidade da sua empresa.\n\n' +
      'Menos planilhas dispersas. Mais visibilidade para agir antes que o problema chegue ao cliente.\n\n' +
      'SOLICITAÇÕES | FORNECEDORES | PEDIDOS | ENTREGAS | INDICADORES',
    image:
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=800&q=80&auto=format&fit=crop',
    href: '/painel',
    soon: false,
    cta: 'Marque sua demonstração.',
  },
  {
    tab: 'RFI/RFQ',
    label: 'RFI/RFQ · Cotação inteligente',
    title:
      'Crie solicitações de cotação, compare fornecedores e organize propostas em poucos minutos.',
    image:
      'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1200&h=800&q=80&auto=format&fit=crop',
    href: '/assistants/rfp',
    soon: false,
  },
  {
    tab: 'Curva ABC',
    label: 'Curva ABC · Análise de gastos',
    title:
      'Classifique itens, fornecedores ou categorias por impacto financeiro e foque no que realmente pesa no resultado.',
    image:
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=800&q=80&auto=format&fit=crop',
    href: '/assistants/abc',
    soon: false,
  },
  {
    tab: 'TCO Online',
    label: 'TCO Online · Custo total de compra',
    title:
      'Calcule o custo real da compra, incluindo preço, frete, impostos, riscos e condições comerciais.',
    image:
      'https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=1200&h=800&q=80&auto=format&fit=crop',
    href: '/assistants/spend_analysis',
    soon: false,
  },
  {
    tab: 'Envio de Ordens de compras automáticas',
    label:
      'Envio de Ordens de compras automáticas · Compras mais rápidas, sem tarefas manuais.',
    title:
      'Automatize o envio de Ordens de Compra e ganhe agilidade no processo.',
    image:
      'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200&h=800&q=80&auto=format&fit=crop',
    href: '/',
    soon: true,
  },
  {
    tab: 'Negociação',
    label: 'Negociação · Analista em tempo real',
    title:
      'Receba apoio durante a negociação com argumentos, riscos, concessões e próximos passos.',
    image:
      'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1200&h=800&q=80&auto=format&fit=crop',
    href: '/assistants/negotiation',
    soon: false,
  },
  {
    tab: 'Should Cost',
    label: 'Should Cost · Preço justo',
    title:
      'Estime quanto um item deveria custar e use como referência para negociar com base em dados.',
    image:
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&h=800&q=80&auto=format&fit=crop',
    href: '/signup',
    soon: true,
  },
  {
    tab: 'Painel de análise tributária',
    label: 'Painel de análise tributária',
    title:
      'Analise tributos, impostos e impactos fiscais das operações de compra para apoiar decisões mais seguras e estratégicas.',
    image:
      'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=1200&h=800&q=80&auto=format&fit=crop',
    href: '/signup',
    soon: true,
  },
  {
    tab: 'Guia de Rotas com análise do DIFAL',
    label: 'Guia de Rotas · Análise do DIFAL',
    title:
      'Avalie rotas de compra considerando o impacto do DIFAL e outros fatores tributários envolvidos na operação.',
    image:
      'https://images.unsplash.com/photo-1524661135-423995f22d0b?w=1200&h=800&q=80&auto=format&fit=crop',
    href: '/signup',
    soon: true,
  },
];
/* ============================================================
   TYPES
============================================================ */
const certificacoes = [
  {
    numero: 'ISO/IEC 42001:2023',
    titulo: 'Gestão de Inteligência Artificial',
    descricao: 'Diretrizes para o uso responsável e seguro da inteligência artificial.',
    imagem: 'https://2bsupply.com.br/wp-content/uploads/2026/09/certificacao-iso-42001-2023-2bsupply-01.png',
    pdf: 'https://taydbrfqmgvjzelvablx.supabase.co/storage/v1/object/public/Certificacoes/iso-42001.pd.pdf',
  },
  {
    numero: 'ISO 27701:2019',
    titulo: 'Gestão da Privacidade da Informação',
    descricao: 'Proteção de dados pessoais e práticas de privacidade.',
    imagem: 'https://2bsupply.com.br/wp-content/uploads/2026/09/certificacao-iso-27701-2019-2bsupply-01.png',
    pdf: 'https://taydbrfqmgvjzelvablx.supabase.co/storage/v1/object/public/Certificacoes/iso-27701.pdf',
  },
  {
    numero: 'ISO/IEC 27001:2022',
    titulo: 'Gestão da Segurança da Informação',
    descricao: 'Segurança e proteção das informações.',
    imagem: 'https://2bsupply.com.br/wp-content/uploads/2026/09/certificacao-iso-27001-2022-2bsupply-01.png',
    pdf: 'https://taydbrfqmgvjzelvablx.supabase.co/storage/v1/object/public/Certificacoes/iso-27001-2.pdf',
  },
  {
    numero: 'ISO 9001:2015',
    titulo: 'Gestão da Qualidade',
    descricao: 'Melhoria contínua dos processos e serviços.',
    imagem: 'https://2bsupply.com.br/wp-content/uploads/2026/09/certificacao-iso-9001-2015-2bsupply-01.png',
    pdf: 'https://taydbrfqmgvjzelvablx.supabase.co/storage/v1/object/public/Certificacoes/iso-9001.pdf',
  },
] as const;
type Plan = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: string;
  features: string[];
};
/* ============================================================
   BUTTON
============================================================ */
const Button = ({
  children = 'QUERO CONHECER O PROGPT',
  className = '',
}: {
  children?: React.ReactNode;
  className?: string;
}) => (
  <Link href="/signup" className={`${styles.cta} ${className}`}>
    {children}
    <ArrowRight size={17} />
  </Link>
);
/* ============================================================
   COMPONENT
============================================================ */
export function NovaLanding({
  plans,
  authed,
}: {
  plans: Plan[];
  authed: boolean;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [menu, setMenu] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [activeSection, setActiveSection] = useState('');
  const [activeUseCase, setActiveUseCase] = useState(0);
  /* ==========================================================
     REF DO SLIDER
  ========================================================== */
  const useCaseTabsRef = useRef<HTMLDivElement>(null);
  const scrollUseCases = (direction: 'left' | 'right') => {
    const container = useCaseTabsRef.current;
    if (!container) return;
    const distance = Math.min(
      container.clientWidth * 0.65,
      500
    );
    container.scrollBy({
      left:
        direction === 'right'
          ? distance
          : -distance,
      behavior: 'smooth',
    });
  };
  const isDark =
    !mounted || resolvedTheme !== 'light';
  useEffect(() => {
    setMounted(true);
  }, []);
  /* ==========================================================
     SEÇÃO ATIVA DO MENU
  ========================================================== */
  useEffect(() => {
    const sections = [
      'sobre',
      'recursos',
      'planos',
      'faq',
    ]
      .map((id) => document.getElementById(id))
      .filter(
        (section): section is HTMLElement =>
          Boolean(section)
      );
    const updateActiveSection = () => {
      const marker = window.scrollY + 140;
      let current = '';
      for (const section of sections) {
        if (section.offsetTop <= marker) {
          current = section.id;
        } else {
          break;
        }
      }
      setActiveSection(current);
    };
    updateActiveSection();
    window.addEventListener(
      'scroll',
      updateActiveSection,
      {
        passive: true,
      }
    );
    window.addEventListener(
      'resize',
      updateActiveSection
    );
    return () => {
      window.removeEventListener(
        'scroll',
        updateActiveSection
      );
      window.removeEventListener(
        'resize',
        updateActiveSection
      );
    };
  }, []);
  const navClass = (section: string) =>
    activeSection === section
      ? styles.navActive
      : undefined;
  const selectedUseCase =
    useCases[activeUseCase]!;
  return (
    <main
      className={`${styles.page} ${
        isDark
          ? styles.darkTheme
          : styles.lightTheme
      }`}
    >
      {/* ======================================================
          NAV
      ====================================================== */}
    <nav className={styles.nav}>
  {/* LOGO */}
  <Link
    href="/"
    className={styles.logo}
    aria-label="2B Supply - início"
  >
    <Image
      src={
        isDark
          ? '/progpt-logo-white.png'
          : '/progpt-logo-dark.png'
      }
      alt="2B Supply"
      width={168}
      height={48}
      priority
    />
  </Link>
  {/* MENU DESKTOP / MENU ABERTO NO MOBILE */}
  <div
    className={`${styles.navlinks} ${
      menu ? styles.navOpen : ''
    }`}
  >
    <a
      href="#sobre"
      className={navClass('sobre')}
      onClick={() => {
        setActiveSection('sobre');
        setMenu(false);
      }}
    >
      Sobre
    </a>
    <a
      href="#recursos"
      className={navClass('recursos')}
      onClick={() => {
        setActiveSection('recursos');
        setMenu(false);
      }}
    >
      Recursos
    </a>
    <a
      href="#planos"
      className={navClass('planos')}
      onClick={() => {
        setActiveSection('planos');
        setMenu(false);
      }}
    >
      Planos
    </a>
    <a
      href="#faq"
      className={navClass('faq')}
      onClick={() => {
        setActiveSection('faq');
        setMenu(false);
      }}
    >
      FAQ
    </a>
  </div>
  {/* AÇÕES DO TOPO */}
  <div className={styles.navActions}>
    <button
      type="button"
      onClick={() =>
        setTheme(isDark ? 'light' : 'dark')
      }
      className={styles.themeToggle}
      aria-label={
        isDark
          ? 'Mudar para tema claro'
          : 'Mudar para tema escuro'
      }
      title={
        isDark
          ? 'Tema claro'
          : 'Tema escuro'
      }
    >
      {isDark ? (
        <Sun size={18} aria-hidden="true" />
      ) : (
        <Moon size={18} aria-hidden="true" />
      )}
    </button>
    <Link
      href="/login"
      className={styles.topLogin}
    >
      <LogIn size={18} />
      <span>Entrar</span>
    </Link>
    <Button className={styles.navCta}>
      COMEÇAR AGORA
    </Button>
    <button
      type="button"
      className={styles.menuButton}
      onClick={() => setMenu(!menu)}
      aria-label={
        menu ? 'Fechar menu' : 'Abrir menu'
      }
      aria-expanded={menu}
    >
      {menu ? (
        <X size={26} />
      ) : (
        <Menu size={28} />
      )}
    </button>
  </div>
</nav>
      {/* ======================================================
          HERO
      ====================================================== */}
      <section className={styles.hero}>
        <div className={styles.grid} />
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}>
            <Sparkles size={15} />
            PROGPT · uma plataforma 2BSUPPLY
          </div>
          <h1>
           IA feita para quem{' '}
            <span>
              compra, negocia e decide.
            </span>
          </h1>
          <p className='mb-3'>
           Uma IA especializada em Compras e Suprimentos para apoiar análises de propostas, fornecedores, TCO, contratos, riscos, negociação e Strategic Sourcing.
<br/><br/>
Menos trabalho operacional. Mais capacidade para decidir melhor.
          </p>
          <Button />
          <small>
            <ShieldCheck size={15} />
          Acesse e veja como a IA pode apoiar sua rotina de Compras.
          </small>
        </div>
        <div className={styles.heroVisual}>
          <div className={styles.systemShot}>
            <HeroVideo />
          </div>
        </div>
      </section>
      {/* ======================================================
          PROOF
      ====================================================== */}
      <section className={styles.proof}>
        <div>
          <strong>+1.000</strong>
          <span>
            profissionais capacitados em IA para Suprimentos
          </span>
        </div>
        <i />
        <div>
          <strong>+30</strong>
          <span>
            assistentes especializados em Suprimentos
          </span>
        </div>
        <i />
        <div>
          <strong>24/7</strong>
          <span>
            apoio disponível para sua equipe
          </span>
        </div>
      </section>
      {/* ======================================================
          SOBRE
      ====================================================== */}
      <section
        className={styles.intelligence}
        id="sobre"
      >
        <div
          className={
            styles.intelligenceHeading
          }
        >
          <span>Sobre</span>
          <h2>
            Do diagnóstico à negociação:{' '}
            <em>
              IA apoiando os 8 passos&#x20;
              do Strategic Sourcing.
            </em>
          </h2>
        </div>
        <div
          className={
            styles.intelligenceGrid
          }
        >
          <article>
            <div
              className={`${styles.intelligenceVisual} ${styles.knowledgeVisual}`}
            >
              <div
                className={
                  styles.knowledgeCore
                }
              >
                <Library />
                <span>KNOWLEDGE</span>
              </div>
              <i />
              <i />
              <i />
            </div>
            <div
              className={
                styles.intelligenceContent
              }
            >
              <span>CONHECIMENTO</span>
              <h3>Especialista em Suprimentos ao seu lado</h3>
              <p>
                Acesse conhecimento aplicado em Strategic Sourcing, Kraljic, Porter, negociação, fornecedores, contratos e custos.
                <br />
                <br />
                Pergunte como faria a um profissional sênior da área e receba apoio para analisar, estruturar e decidir melhor.
              </p>
            </div>
          </article>
          <article>
            <div
              className={`${styles.intelligenceVisual} ${styles.agentsVisual}`}
            >
              <div
                className={styles.agentMain}
              >
                <Bot />
                <b>Assistente PRO</b>
                <small>
                  Pronto para executar
                </small>
              </div>
              <div
                className={
                  styles.agentChip
                }
              >
                ABC
              </div>
              <div
                className={
                  styles.agentChip
                }
              >
                RFP
              </div>
              <div
                className={
                  styles.agentChip
                }
              >
                Kraljic
              </div>
            </div>
            <div
              className={
                styles.intelligenceContent
              }
            >
              <span>EXECUÇÃO</span>
              <h3>
                Assistentes que trabalham junto com você
              </h3>
              <p>
                Conte com assistentes especializados para diferentes etapas de Compras.
                 <br />
                  <br />
Análise de categoria, fornecedores, RFP, propostas, TCO, negociação, contratos, riscos e análise financeira.
 <br />
  <br />
Menos trabalho manual. Mais velocidade para transformar dados em decisão.
              </p>
            </div>
          </article>
          <article>
            <div
              className={`${styles.intelligenceVisual} ${styles.baseVisual}`}
            >
              <div
                className={
                  styles.shieldRings
                }
              >
                <ShieldCheck />
              </div>
              <div
                className={
                  styles.sourceLine
                }
              >
                <Check />
                Fonte verificada
              </div>
            </div>
            <div
              className={
                styles.intelligenceContent
              }
            >
              <span>CONFIANÇA</span>
              <h3>Respostas com mais segurança</h3>
              <p>
                O ProGpt pode consultar fontes selecionadas, cruzar informações e indicar as referências utilizadas na análise.
<br />
                <br />
Quando não encontra base suficiente para responder, sinaliza a limitação em vez de simplesmente inventar uma resposta.
<br />
                <br />
Mais confiança para usar IA em decisões reais de Compras.
              </p>
            </div>
          </article>
        </div>
      </section>
      {/* CERTIFICAÇÕES ISO */}
      <section className="progpt-certifications" id="certificacoes" aria-labelledby="progpt-certifications-title">
        <div className="progpt-certifications-inner">
          <span>Nossas certificações</span>
          <h2 id="progpt-certifications-title">
           <em> Certificações</em> ISO
          </h2>
          <p className="progpt-certifications-intro">
         O PROGPT, solução de Inteligência Artificial da 2BSUPPLY, agora opera respaldado pelas certificações ISO do grupo, reforçando sua capacidade de atuar em processos críticos de Suprimentos com segurança, governança, qualidade e confiabilidade.
          </p>
          <CertificacoesGrid certificacoes={certificacoes} />
        </div>
      </section>
      <style>{`
        .progpt-certifications {
          color: #f8fbff;
          background: radial-gradient(ellipse at 52% 0%, rgba(14, 141, 225, .10), transparent 58%), #06101f;
          padding: 88px 24px 96px;
          border-top: 1px solid rgba(43, 167, 225, .12);
          border-bottom: 1px solid rgba(43, 167, 225, .12);
        }
        .progpt-certifications-inner { width: 100%; max-width: 1220px; margin: 0 auto; }
        .progpt-certifications-kicker { color: #27d6ec; font-size: 12px; font-weight: 700; letter-spacing: .14em; }
        .progpt-certifications h2 { margin: 12px 0 10px; font-size: clamp(30px, 3vw, 46px); line-height: 1.13; font-weight: 700; letter-spacing: -.035em; }
        .progpt-certifications h2 em { font-style: normal; color: #16cbed; }
        .progpt-certifications-intro { color: #a1b3c7; font-size: 16px; line-height: 1.6; margin: 0 0 30px; }
        .progpt-certifications-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
        .progpt-certifications-card { min-width: 0; overflow: hidden; display: flex; flex-direction: column; border: 1px solid rgba(42, 147, 201, .25); border-radius: 14px; background: #091829; }
        .progpt-certifications-image { aspect-ratio: 1672 / 941; overflow: hidden; background: #06101f; }
        .progpt-certifications-image img { display: block; width: 100%; height: 100%; object-fit: cover; }
        .progpt-certifications-preview { display: block; width: 100%; border: 0; padding: 0; cursor: zoom-in; }
        .progpt-certifications-trigger { border: 0; padding: 0; background: transparent; cursor: pointer; }
        .progpt-certifications-preview:focus-visible, .progpt-certifications-trigger:focus-visible { outline: 2px solid #24d7ee; outline-offset: 4px; }
        .progpt-certifications-body { display: flex; flex: 1; flex-direction: column; padding: 20px; }
        .progpt-certifications-body > span { color: #27d6ec; font-size: 11px; font-weight: 700; letter-spacing: .12em; }
        .progpt-certifications-body h3 { margin: 10px 0 4px; font-size: clamp(17px, 1.5vw, 21px); line-height: 1.2; font-weight: 700; }
        .progpt-certifications-name { margin: 0; color: #d9e8f6; font-size: 14px; line-height: 1.45; }
        .progpt-certifications-description { margin: 16px 0 22px; color: #9eafc2; font-size: 13px; line-height: 1.55; }
        .progpt-certifications-link { display: inline-flex; align-items: center; gap: 8px; margin-top: auto; align-self: flex-start; color: #24d7ee; font-size: 13px; font-weight: 700; text-decoration: none; }
        .progpt-certifications-link:hover { color: #80ecfa; }
        .progpt-certifications-link:focus-visible { outline: 2px solid #24d7ee; outline-offset: 5px; }
        .progpt-certifications-footnote { margin: 26px 0 0; color: #8ea2ba; font-size: 12px; text-align: center; line-height: 1.6; }
        @media (max-width: 950px) { .progpt-certifications-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 600px) { .progpt-certifications { padding: 64px 18px 72px; } .progpt-certifications-grid { grid-template-columns: 1fr; } }
      `}</style>
{/* ======================================================
          RECURSOS
      ====================================================== */}
      <section
        className={styles.features}
        id="recursos"
      >
        <div
          className={styles.sectionHeading}
        >
          <span>Recursos</span>
          <h2>
            Por que a PROGPT é{' '}
            <em>diferente</em>
          </h2>
          <p>
            Não é mais uma IA genérica.
            <br />
            É inteligência criada para
            Suprimentos.
            <br />
            Automatize tarefas, reduza riscos
            e transforme dados em decisões
            mais rápidas, seguras e
            estratégicas.
          </p>
        </div>
        <div className={styles.featureGrid}>
          {features.map(
            ({
              icon: Icon,
              title,
              text,
            }) => (
              <article
                key={title}
                className={
                  styles.featureCard
                }
              >
                <div
                  className={styles.iconBox}
                >
                  <Icon />
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            )
          )}
        </div>
        <Button />
      </section>
      {/* ======================================================
          ASSISTENTES
      ====================================================== */}
      <section
        className={styles.bonus}
        id="assistentes"
      >
        <div
          className={`${styles.sectionHeading} ${styles.useCaseHeading}`}
        >
          <span>
            Assistentes Estratégicos
          </span>
          <h2>
            Diferentes caminhos,
            <br />
            <em>
              guiados por um especialista
              silencioso.
            </em>
          </h2>
        </div>
        {/* ====================================================
            SLIDER DAS TABS
        ==================================================== */}
        <div
          className={styles.useCaseSlider}
        >
          {/* SETA ESQUERDA */}
          <button
            type="button"
            className={`${styles.useCaseSliderArrow} ${styles.useCaseSliderArrowLeft}`}
            onClick={() =>
              scrollUseCases('left')
            }
            aria-label="Ver assistentes anteriores"
          >
            <ChevronLeft size={17} />
          </button>
          {/* TABS */}
          <div
            ref={useCaseTabsRef}
            className={styles.useCaseTabs}
            role="tablist"
            aria-label="Casos de uso do PROGPT"
          >
            {useCases.map(
              (item, index) => (
                <button
                  key={item.tab}
                  role="tab"
                  aria-selected={
                    activeUseCase === index
                  }
                  className={
                    activeUseCase === index
                      ? styles.useCaseTabActive
                      : ''
                  }
onClick={() => {
  setActiveUseCase(index);
}}
                >
                  {item.tab}
                  {item.soon && (
                    <small>
                      {' '}
                      (em breve)
                    </small>
                  )}
                </button>
              )
            )}
          </div>
          {/* SETA DIREITA */}
          <button
            type="button"
            className={`${styles.useCaseSliderArrow} ${styles.useCaseSliderArrowRight}`}
            onClick={() =>
              scrollUseCases('right')
            }
            aria-label="Ver próximos assistentes"
          >
            <ChevronRight size={17} />
          </button>
        </div>
        {/* ====================================================
            CONTEÚDO DO ASSISTENTE
        ==================================================== */}
        <div
          className={styles.useCasePanel}
          role="tabpanel"
        >
          <div
            className={styles.useCaseVisual}
          >
            <img
              src={selectedUseCase.image}
              alt={`Imagem do recurso ${selectedUseCase.tab}`}
            />
          </div>
          <div
            className={styles.useCaseCopy}
          >
            <span>
              {selectedUseCase.label}
            </span>
            {selectedUseCase.cta ? (
              <>
                <h3
                  className={
                    styles.useCaseLead
                  }
                >
                  {
                    selectedUseCase.title.split(
                      '\n\n'
                    )[0]
                  }
                </h3>
                <p>
                  {selectedUseCase.title
                    .split('\n\n')
                    .slice(1)
                    .join('\n\n')}
                </p>
              </>
            ) : (
              <h3>
                {selectedUseCase.title}
              </h3>
            )}
            {selectedUseCase.soon ? (
              <span
                className={styles.soonBadge}
              >
                Em breve
              </span>
            ) : (
              <Link
                href={
                  selectedUseCase.href
                }
                className={styles.cta}
              >
                {selectedUseCase.cta ??
                  'CONHECER O ASSISTENTE'}
                <ArrowRight size={17} />
              </Link>
            )}
          </div>
        </div>
      </section>
      {/* ======================================================
          PLANOS
      ====================================================== */}
      <section
        className={styles.offer}
        id="planos"
      >
        <div
          className={styles.sectionHeading}
        >
          <span>
            <Sparkles size={14} />
            Planos PROGPT
          </span>
          <h2>
            <em>Menos burocracia</em> para o
            comprador.
            <br />
            <em>Mais controle</em> para a
            empresa.
          </h2>
          <p
            className={
              styles.offerSubtitle
            }
          >
            Escolha a solução ideal para
            transformar tarefas operacionais
            em processos mais rápidos,
            seguros e estratégicos.
          </p>
        </div>
        <div
          className={
            styles.pricingTableWrap
          }
        >
          {plans.length > 0 ? (
            <PricingTable
              authed={authed}
              isPro={false}
              plans={plans}
              userPlanSlug={null}
              profile={null}
              trialExpired={false}
              hideHeader
            />
          ) : (
            <Link
              href="/planos"
              className={styles.cta}
            >
              VER PLANOS
              <ArrowRight size={17} />
            </Link>
          )}
        </div>
      </section>
      {/* ======================================================
          FAQ
      ====================================================== */}
      <section
        className={styles.faq}
        id="faq"
      >
        <div>
          <span
            className={styles.kicker}
          >
            Perguntas frequentes
          </span>
          <h2>
            Suas dúvidas,
            <br />
            <em>
              respondidas com clareza.
            </em>
          </h2>
          <a
            href="https://wa.me/5521999792912"
            target="_blank"
            rel="noopener noreferrer"
            className={
              styles.outlineButton
            }
          >
            <Headphones />
            FALAR COM ESPECIALISTA
          </a>
        </div>
        <div
          className={styles.accordion}
        >
          {faqs.map(([q, a], i) => (
            <article
              key={q}
              className={
                openFaq === i
                  ? styles.faqOpen
                  : ''
              }
            >
              <button
                onClick={() =>
                  setOpenFaq(
                    openFaq === i
                      ? null
                      : i
                  )
                }
              >
                <span>
                  {String(i + 1).padStart(
                    2,
                    '0'
                  )}
                </span>
                {q}
                <ChevronDown />
              </button>
              {openFaq === i && (
                <p>{a}</p>
              )}
            </article>
          ))}
        </div>
      </section>
      {/* ======================================================
          FOOTER
      ====================================================== */}
      <footer className={styles.footer}>
        <div>
          <Link
            href="/"
            className={styles.logo}
            aria-label="2B Supply - início"
          >
            <Image
              src={
                isDark
                  ? '/progpt-logo-white.png'
                  : '/progpt-logo-dark.png'
              }
              alt="2B Supply"
              width={168}
              height={48}
              priority
            />
          </Link>
          <p>O Grupo 2BSUPPLY desenvolve soluções sob medida para a cadeia de suprimentos de Pequenas e Médias Empresas que precisam ganhar eficiência sem perder agilidade.</p>
<div className="elementor-widget-container">
<ul className="footer-contact-list">
  <li>
    <FaWhatsapp className="footer-contact-icon" aria-hidden="true" />
    <span>+55 (21) 99979-2912</span>
  </li>
  <li>
    <FiMail className="footer-contact-icon" aria-hidden="true" />
    <span>comercial@2bsupply.com.br</span>
  </li>
  <li>
    <FiFileText className="footer-contact-icon" aria-hidden="true" />
    <span>CNPJ: 36.335.299/0001-82</span>
  </li>
</ul>
</div>
        </div>
        <div>
          <b>Produto</b>
          <a href="#recursos">
            Recursos
          </a>
          <a href="#planos">
            Planos
          </a>
          <Link href="/login">
            Entrar
          </Link>
        </div>
        <div>
          <b>Legal</b>
          <Link href="/privacidade">
            Privacidade
          </Link>
          <Link href="/termos">
            Termos de uso
          </Link>
          <Link href="/cookies">
            Cookies
          </Link>
        </div>
    <div
  className={styles["footer-certifications"]}
  aria-label="Conheça as certificações da 2BSUPPLY"
>
  <span className={styles["footer-certifications-title"]}>
    Empresa Certificada ISO
  </span>

  <span className={styles["footer-certifications-logos"]}>
    {[
      {
        id: "42001",
        nome: "ISO/IEC 42001",
        descricao: "Gestão de Inteligência Artificial",
        src: "https://taydbrfqmgvjzelvablx.supabase.co/storage/v1/object/public/Certificacoes/selo-iso-42001-2 (2).png",
      },
      {
        id: "27001",
        nome: "ISO/IEC 27001",
        descricao: "Gestão da Segurança da Informação",
        src: "https://taydbrfqmgvjzelvablx.supabase.co/storage/v1/object/public/Certificacoes/selo-iso-27001-1.png",
      },
      {
        id: "27701",
        nome: "ISO/IEC 27701",
        descricao: "Gestão da Privacidade da Informação",
        src: "https://taydbrfqmgvjzelvablx.supabase.co/storage/v1/object/public/Certificacoes/selo-iso-27701-2 (1).png",
      },
      {
        id: "9001",
        nome: "ISO 9001",
        descricao: "Gestão da Qualidade",
        src: "https://taydbrfqmgvjzelvablx.supabase.co/storage/v1/object/public/Certificacoes/selo-iso-9001 (1).png",
      },
    ].map((certificacao) => (
      <span
        key={certificacao.id}
        className={styles["footer-certification-item"]}
        tabIndex={0}
        aria-describedby={`footer-tooltip-${certificacao.id}`}
      >
        <Image
          src={certificacao.src}
          alt={certificacao.nome}
          width={150}
          height={150}
          className={styles["footer-certification-image"]}
        />

        <span
          id={`footer-tooltip-${certificacao.id}`}
          role="tooltip"
          className={styles["footer-certification-tooltip"]}
        >
          <strong>{certificacao.nome}</strong>
          <span>{certificacao.descricao}</span>
        </span>
      </span>
    ))}
  </span>
</div>
        <small>
          © 2026 PROGPT. Todos os direitos
          reservados.
        </small>
      </footer>
    </main>
  );
}
