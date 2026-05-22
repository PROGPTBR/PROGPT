'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  FileText,
  Layers,
  TrendingUp,
  UserCircle2,
} from 'lucide-react';

// CTA card que aparece embaixo de uma resposta do chat quando o LLM
// recomenda usar uma das ferramentas dedicadas. Substitui o link
// "aqui" enterrado no markdown (que ficava pequeno demais pra clicar
// no mobile e sujeito a hallucination de URL pelo LLM).
//
// Quem detecta o tipo é o backend (/api/chat onFinish faz regex em
// /assistants/<type> no text final) e anexa annotation. Aqui só
// renderiza, com label/icon/href estável por tipo.

export type AssistantToolType =
  | 'rfp'
  | 'kraljic'
  | 'porter'
  | 'abc'
  | 'financial'
  | 'profile';

type Meta = {
  title: string;
  blurb: string;
  Icon: typeof FileText;
};

const META: Record<AssistantToolType, Meta> = {
  rfp: {
    title: 'Abrir RFP / Cotação',
    blurb: 'Form pré-curado + draft em .docx e planilha .xlsx com colunas fiscais BR',
    Icon: FileText,
  },
  kraljic: {
    title: 'Abrir Matriz de Kraljic',
    blurb: 'Classifica até 200 categorias + plano de ação + bubble chart',
    Icon: Layers,
  },
  porter: {
    title: 'Abrir Análise de Porter',
    blurb: '5 Forças com intensidade e recomendações por categoria',
    Icon: TrendingUp,
  },
  abc: {
    title: 'Abrir Análise ABC',
    blurb: 'Curva de Pareto + plano por classe A/B/C',
    Icon: BarChart3,
  },
  financial: {
    title: 'Abrir Análise Financeira',
    blurb: 'Score 0–100 da saúde do fornecedor por 12 indicadores',
    Icon: Briefcase,
  },
  profile: {
    title: 'Abrir Perfil da Categoria',
    blurb: 'Caracterize uma categoria de compra antes de partir pra análise',
    Icon: UserCircle2,
  },
};

type Props = {
  type: AssistantToolType;
};

export function AssistantToolCTA({ type }: Props) {
  const meta = META[type];
  if (!meta) return null;
  const { title, blurb, Icon } = meta;
  return (
    <Link
      href={`/assistants/${type}`}
      className="group mt-4 flex items-start gap-3 rounded-2xl border border-brand/30 bg-brand/5 hover:bg-brand/10 hover:border-brand/50 px-4 py-3 transition-all duration-300 active:scale-[0.99]"
    >
      <Icon
        className="h-5 w-5 text-brand flex-shrink-0 mt-0.5"
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="text-sm font-medium text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground line-clamp-2">{blurb}</div>
      </div>
      <ArrowRight
        className="h-4 w-4 text-brand flex-shrink-0 mt-1 group-hover:translate-x-0.5 transition-transform"
        aria-hidden="true"
      />
    </Link>
  );
}

const VALID_TYPES = new Set<AssistantToolType>([
  'rfp',
  'kraljic',
  'porter',
  'abc',
  'financial',
  'profile',
]);

// Server-callable detector. Procura o PRIMEIRO `/assistants/<type>`
// canônico no texto da resposta do LLM. Retorna null se não achar nada
// ou se achar `suppliers` (que tem CTA próprio via supplier_search
// intent, com query pré-preenchida).
export function detectAssistantToolCTA(text: string): AssistantToolType | null {
  const m = text.match(/\/assistants\/([a-z][a-z0-9-]*)\b/i);
  if (!m) return null;
  const candidate = m[1]!.toLowerCase() as AssistantToolType;
  if (candidate === ('suppliers' as AssistantToolType)) return null;
  if (!VALID_TYPES.has(candidate)) return null;
  return candidate;
}
