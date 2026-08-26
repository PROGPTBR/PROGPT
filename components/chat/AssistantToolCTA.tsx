'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { META, pathFor, type AssistantToolType } from './assistant-tool-cta-shared';

// Card visual + amigável que aparece embaixo de uma resposta do chat quando o
// LLM recomenda usar uma das ferramentas dedicadas. Substitui o caminho cru
// "/assistants/rfp" no texto (que ficava feio e não-clicável) por um convite
// claro: ícone + nome do assistente + o que ele faz + ação "Abrir".
//
// A lógica pura (tipos, META, detectAssistantToolCTA, stripAssistantPaths)
// mora em ./assistant-tool-cta-shared (SEM 'use client') porque
// app/api/chat/route.ts (server) também precisa chamar detectAssistantToolCTA
// — ver o comentário grande naquele arquivo pra entender por que isso
// importa. Este arquivo só re-exporta o que os outros client components
// (Message.tsx) já importavam daqui, pra não quebrar ninguém.

export type { AssistantToolType };
export { detectAssistantToolCTA, stripAssistantPaths } from './assistant-tool-cta-shared';

type Props = {
  type: AssistantToolType;
};

export function AssistantToolCTA({ type }: Props) {
  const meta = META[type];
  if (!meta) return null;
  const { title, blurb, Icon } = meta;
  return (
    <Link
      href={pathFor(type)}
      aria-label={`Abrir ${title}`}
      className="group no-underline mt-4 flex items-center gap-4 rounded-2xl border border-brand/30 bg-gradient-to-br from-brand/10 to-brand/[0.04] hover:from-brand/20 hover:to-brand/10 hover:border-brand/60 px-4 py-4 shadow-sm hover:shadow-md transition-all duration-300 active:scale-[0.99]"
    >
      <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand group-hover:bg-brand/25 transition-colors">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-brand">
          Ferramenta dedicada
        </div>
        <div className="text-sm font-semibold text-foreground leading-tight">
          {title}
        </div>
        <div className="text-xs text-muted-foreground leading-snug line-clamp-3">
          {blurb}
        </div>
      </div>
      <span className="flex items-center gap-1 self-center text-xs font-semibold text-brand flex-shrink-0 whitespace-nowrap">
        Abrir
        <ArrowRight
          className="h-4 w-4 group-hover:translate-x-0.5 transition-transform"
          aria-hidden="true"
        />
      </span>
    </Link>
  );
}
