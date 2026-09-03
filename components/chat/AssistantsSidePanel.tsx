'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Building2,
  Calculator,
  FileText,
  Handshake,
  LineChart,
  Search,
  Sparkles,
  Truck,
  X,
} from 'lucide-react';

import { ASSISTANTS } from '@/components/assistants/assistants-data';
import { supabaseBrowser } from '@/lib/db/supabase-browser';

type Props = {
  onClose: () => void;
};

type Assistant = (typeof ASSISTANTS)[number];

type CategoryId =
  | 'strategy'
  | 'suppliers'
  | 'sourcing'
  | 'costs'
  | 'negotiation'
  | 'decision'
  | 'others';

/* =========================================================
   ÍCONES DOS ASSISTENTES
========================================================= */

const ASSISTANT_ICONS = {
  abc: BarChart3,
  spend_analysis: LineChart,
  porter: Building2,
  suppliers: Search,
  kraljic: Building2,
  rfp: FileText,
  negotiation: Handshake,
  financial: BarChart3,
  scorecard: BarChart3,
  homologacao: Building2,
  pesquisa_precos: Search,
  indicadores: LineChart,

  equalizador: BarChart3,
  equalizador_propostas: BarChart3,

  simulador_tributario: Calculator,
  tributario: Calculator,

  simulador_logistico: Truck,
  logistico: Truck,

  grafico_rapido: BarChart3,
} as const;

/* =========================================================
   JORNADA DE COMPRAS
========================================================= */

const JOURNEY = [
  'Analisar',
  'Planejar',
  'Buscar',
  'Cotar',
  'Comparar',
  'Negociar',
  'Decidir',
];

/* =========================================================
   CATEGORIAS
========================================================= */

const CATEGORY_CONFIG: Array<{
  id: CategoryId;
  title: string;
  description: string;
}> = [
  {
    id: 'strategy',
    title: 'Estratégia e Inteligência',
    description: 'Entenda gastos, mercado e oportunidades.',
  },
  {
    id: 'suppliers',
    title: 'Fornecedores',
    description: 'Encontre e avalie fornecedores.',
  },
  {
    id: 'sourcing',
    title: 'Cotação e Sourcing',
    description: 'Estruture processos e compare propostas.',
  },
  {
    id: 'costs',
    title: 'Custos e Tributos',
    description: 'Simule impactos tributários e logísticos.',
  },
  {
    id: 'negotiation',
    title: 'Negociação',
    description: 'Prepare estratégias e cenários.',
  },
  {
    id: 'decision',
    title: 'Análise e Decisão',
    description: 'Transforme dados em decisões.',
  },
];

/* =========================================================
   NORMALIZA TEXTO
========================================================= */

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/* =========================================================
   DESCOBRE A CATEGORIA DO ASSISTENTE
========================================================= */

function getAssistantCategory(assistant: Assistant): CategoryId {
  const id = normalizeText(String(assistant.id ?? ''));
  const title = normalizeText(String(assistant.title ?? ''));

  const text = `${id} ${title}`;

  /* Estratégia e Inteligência */
  if (
    text.includes('spend_analysis') ||
    text.includes('analise de gastos') ||
    text.includes('analise gastos') ||
    text.includes('abc') ||
    text.includes('porter') ||
    text.includes('kraljic') ||
    text.includes('indicadores') ||
    text.includes('pesquisa_precos') ||
    text.includes('pesquisa de precos') ||
    text.includes('pesquisa precos')
  ) {
    return 'strategy';
  }

  /* Fornecedores */
  if (
    text.includes('suppliers') ||
    text.includes('busca de fornecedores') ||
    text.includes('busca fornecedores') ||
    text.includes('scorecard') ||
    text.includes('supplier scorecard') ||
    text.includes('financial') ||
    text.includes('analise financeira')
  ) {
    return 'suppliers';
  }

  /* Cotação e Sourcing */
  if (
    text.includes('rfp') ||
    text.includes('equalizador') ||
    text.includes('equalizer') ||
    text.includes('propostas')
  ) {
    return 'sourcing';
  }

  /* Custos e Tributos */
  if (
    text.includes('tribut') ||
    text.includes('tax') ||
    text.includes('logistic') ||
    text.includes('frete')
  ) {
    return 'costs';
  }

  /* Negociação */
  if (
    text.includes('negotiation') ||
    text.includes('negociacao')
  ) {
    return 'negotiation';
  }

  /* Análise e Decisão */
  if (
    text.includes('grafico rapido') ||
    text.includes('grafico_rapido') ||
    text.includes('quick chart')
  ) {
    return 'decision';
  }

  return 'others';
}

/* =========================================================
   ORDEM DOS ASSISTENTES

   ESSA É A PARTE QUE CONTROLA A POSIÇÃO DELES.
========================================================= */

function getAssistantOrder(assistant: Assistant) {
  const id = normalizeText(String(assistant.id ?? ''));
  const title = normalizeText(String(assistant.title ?? ''));

  const text = `${id} ${title}`;

  /* ---------------------------------------------------------
     ESTRATÉGIA E INTELIGÊNCIA

     1. Análise de Gastos
     2. Análise ABC
     3. Porter
     4. Kraljic
     5. Indicadores Econômicos
     6. Pesquisa de Preços
  --------------------------------------------------------- */

  if (
    text.includes('spend_analysis') ||
    text.includes('analise de gastos')
  ) {
    return 10;
  }

  if (
    id === 'abc' ||
    text.includes('analise abc')
  ) {
    return 20;
  }

  if (text.includes('porter')) {
    return 30;
  }

  if (text.includes('kraljic')) {
    return 40;
  }

  if (text.includes('indicadores')) {
    return 50;
  }

  if (
    text.includes('pesquisa_precos') ||
    text.includes('pesquisa de precos')
  ) {
    return 60;
  }

  /* ---------------------------------------------------------
     FORNECEDORES

     1. Busca de Fornecedores
     2. Supplier Scorecard
     3. Análise Financeira
  --------------------------------------------------------- */

  if (
    id === 'suppliers' ||
    text.includes('busca de fornecedores')
  ) {
    return 110;
  }

  if (text.includes('scorecard')) {
    return 120;
  }

  if (
    id === 'financial' ||
    text.includes('analise financeira')
  ) {
    return 130;
  }

  /* ---------------------------------------------------------
     COTAÇÃO E SOURCING

     1. RFP
     2. Equalizador de Propostas
  --------------------------------------------------------- */

  if (
    id === 'rfp' ||
    text.includes(' rfp') ||
    text.startsWith('rfp')
  ) {
    return 210;
  }

  if (
    text.includes('equalizador') ||
    text.includes('equalizer')
  ) {
    return 220;
  }

  /* ---------------------------------------------------------
     CUSTOS E TRIBUTOS

     1. Simulador Tributário
     2. Simulador Logístico
  --------------------------------------------------------- */

  if (text.includes('tribut')) {
    return 310;
  }

  if (
    text.includes('logistic') ||
    text.includes('frete')
  ) {
    return 320;
  }

  /* ---------------------------------------------------------
     NEGOCIAÇÃO

     1. Simulador de Negociação
  --------------------------------------------------------- */

  if (
    text.includes('negotiation') ||
    text.includes('negociacao')
  ) {
    return 410;
  }

  /* ---------------------------------------------------------
     ANÁLISE E DECISÃO

     1. Gráfico Rápido
  --------------------------------------------------------- */

  if (
    text.includes('grafico rapido') ||
    text.includes('grafico_rapido') ||
    text.includes('quick chart')
  ) {
    return 510;
  }

  /* Qualquer assistente novo fica por último */
  return 9999;
}

/* =========================================================
   COMPONENTE
========================================================= */

export function AssistantsSidePanel({ onClose }: Props) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const sb = supabaseBrowser();

    sb.auth.getUser().then(async ({ data }) => {
      const user = data.user;

      if (!user) return;

      const { data: profile } = await sb
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      const role =
        (profile as { role?: string } | null)?.role ?? 'user';

      setIsAdmin(role === 'admin');
    });
  }, []);

  /* =========================================================
     ADMIN PODE TESTAR ASSISTENTES "EM BREVE"
  ========================================================= */

  const isUnlockedForAdmin = (assistant: Assistant) =>
    assistant.badge === 'em_breve' && isAdmin;

  /* =========================================================
     ASSISTENTES VISÍVEIS
  ========================================================= */

  const visibleAssistants = useMemo(() => {
    return ASSISTANTS.filter(
      (assistant) => assistant.showInSidePanel !== false
    );
  }, []);

  /* =========================================================
     ORGANIZA POR CATEGORIA + ORDEM
  ========================================================= */

  const categories = useMemo(() => {
    return CATEGORY_CONFIG.map((category) => ({
      ...category,

      assistants: visibleAssistants
        .filter(
          (assistant) =>
            getAssistantCategory(assistant) === category.id
        )
        .sort(
          (a, b) =>
            getAssistantOrder(a) - getAssistantOrder(b)
        ),
    })).filter((category) => category.assistants.length > 0);
  }, [visibleAssistants]);

  /* =========================================================
     NÃO MAPEADOS
  ========================================================= */

  const otherAssistants = useMemo(() => {
    return visibleAssistants
      .filter(
        (assistant) =>
          getAssistantCategory(assistant) === 'others'
      )
      .sort(
        (a, b) =>
          getAssistantOrder(a) - getAssistantOrder(b)
      );
  }, [visibleAssistants]);

  /* =========================================================
     CARD DO ASSISTENTE
  ========================================================= */

  const renderAssistant = (assistant: Assistant) => {
    const Icon =
      ASSISTANT_ICONS[
        assistant.id as keyof typeof ASSISTANT_ICONS
      ] ?? Sparkles;

    const locked =
      Boolean(assistant.badge) &&
      !isUnlockedForAdmin(assistant);

    const content = (
      <>
        {/* Ícone */}
        <div
          className="
            relative
            flex
            h-10
            w-10
            shrink-0
            items-center
            justify-center
            overflow-hidden
            rounded-xl
            border
            border-brand/20
            bg-brand-gradient-soft
          "
        >
          <Icon
            className={`
              h-[18px]
              w-[18px]
              ${
                locked
                  ? 'text-muted-foreground'
                  : 'text-brand'
              }
            `}
          />

          {!locked && (
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand/10 to-transparent" />
          )}
        </div>

        {/* Texto */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`
                truncate
                text-[13px]
                font-semibold
                ${
                  locked
                    ? 'text-muted-foreground'
                    : 'text-foreground'
                }
              `}
            >
              {assistant.title}
            </span>

            {locked && (
              <span
                className="
                  shrink-0
                  rounded-full
                  border
                  border-border
                  bg-background/40
                  px-2
                  py-0.5
                  text-[9px]
                  font-semibold
                  uppercase
                  tracking-wide
                  text-muted-foreground
                "
              >
                {assistant.badge === 'sob_demanda'
                  ? 'Sob demanda'
                  : 'Em breve'}
              </span>
            )}
          </div>

          <div className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground">
            {assistant.sideSubtitle ?? assistant.short}
          </div>
        </div>

        {/* Seta */}
        {!locked && (
          <ArrowRight
            className="
              h-3.5
              w-3.5
              shrink-0
              text-muted-foreground/50
              transition-all
              group-hover:translate-x-0.5
              group-hover:text-brand
            "
          />
        )}
      </>
    );

    /* Assistente bloqueado */
    if (locked) {
      return (
        <div
          key={assistant.id}
          className="
            flex
            cursor-default
            items-center
            gap-3
            rounded-xl
            border
            border-border/60
            bg-background/15
            px-3
            py-2.5
            opacity-65
          "
        >
          {content}
        </div>
      );
    }

    /* Assistente disponível */
    return (
      <Link
        key={assistant.id}
        href={assistant.href}
        onClick={onClose}
        className="
          group
          flex
          items-center
          gap-3
          rounded-xl
          border
          border-border
          bg-background/25
          px-3
          py-2.5
          transition-all
          hover:border-brand/50
          hover:bg-brand/5
          hover:shadow-sm
        "
      >
        {content}
      </Link>
    );
  };

  return (
    <aside
      className="
        dark
        flex
        h-full
        w-[24rem]
        shrink-0
        flex-col
        overflow-hidden
        border-r
        border-border
        bg-card/95
        text-foreground

        md:my-2
        md:h-[calc(100vh-1rem)]
        md:rounded-2xl
        md:border
        md:shadow-panel

        dark:md:ring-1
        dark:md:ring-white/10
      "
    >
      {/* =====================================================
          HEADER
      ====================================================== */}

      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Assistentes
          </h2>

          <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-brand">
            Jornada de Compras
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar assistentes"
          title="Fechar"
          className="
            flex
            h-9
            w-9
            items-center
            justify-center
            rounded-lg
            text-muted-foreground
            transition-colors
            hover:bg-accent
            hover:text-foreground
          "
        >
          <X className="h-5 w-5" />
        </button>
      </div>

     {/* =====================================================
    CONTEÚDO COM SCROLL
====================================================== */}

<div className="flex-1 overflow-y-auto px-4 pb-5">

  {/* =====================================================
      INTRODUÇÃO
  ====================================================== */}

  <div className="px-1 pb-3 pt-4">
    <h3 className="text-sm font-semibold leading-snug text-foreground">
      Escolha em qual etapa de Compras você precisa de apoio.
    </h3>

    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
      Encontre o especialista certo para cada etapa do seu processo.
    </p>
  </div>

  {/* =====================================================
      JORNADA
  ====================================================== */}

  <div className="pb-5">
    <div
      className="
        rounded-xl
        border
        border-brand/20
        bg-brand/5
        px-3
        py-3
      "
    >
      <div className="mb-2 flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-brand" />

        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-brand">
          Sua jornada
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5">
        {JOURNEY.map((step, index) => (
          <div
            key={step}
            className="flex items-center gap-1.5"
          >
            <span
              className="
                whitespace-nowrap
                rounded-md
                bg-background/40
                px-1.5
                py-1
                text-[10px]
                font-medium
                text-foreground/90
              "
            >
              {step}
            </span>

            {index < JOURNEY.length - 1 && (
              <span className="text-[10px] text-brand/70">
                →
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  </div>

  {/* =====================================================
      LISTA POR CATEGORIA
  ====================================================== */}

  <div className="space-y-6">
    {categories.map((category) => (
      <section key={category.id}>

        {/* Categoria */}

        <div className="mb-2.5 px-1">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />

            <h4
              className="
                text-[11px]
                font-bold
                uppercase
                tracking-[0.08em]
                text-foreground
              "
            >
              {category.title}
            </h4>
          </div>

          <p className="ml-3.5 mt-0.5 text-[10px] leading-4 text-muted-foreground">
            {category.description}
          </p>
        </div>

        {/* Assistentes */}

        <div className="space-y-2">
          {category.assistants.map(renderAssistant)}
        </div>

      </section>
    ))}

    {/* =================================================
        OUTROS ASSISTENTES
    ================================================== */}

    {otherAssistants.length > 0 && (
      <section>
        <div className="mb-2.5 px-1">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />

            <h4
              className="
                text-[11px]
                font-bold
                uppercase
                tracking-[0.08em]
                text-foreground
              "
            >
              Outros especialistas
            </h4>
          </div>
        </div>

        <div className="space-y-2">
          {otherAssistants.map(renderAssistant)}
        </div>
      </section>
    )}
  </div>
</div>

      {/* =====================================================
          RODAPÉ
      ====================================================== */}

      <div className="border-t border-border bg-card/80 p-4">
        <Link
          href="/assistants"
          onClick={onClose}
          className="
            flex
            items-center
            justify-between
            rounded-xl
            px-3
            py-2.5
            text-sm
            font-medium
            text-brand
            transition-colors
            hover:bg-accent
          "
        >
          <span>Ver todos os assistentes</span>

          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </aside>
  );
}