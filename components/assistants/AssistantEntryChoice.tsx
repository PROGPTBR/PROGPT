'use client';

import {
  ArrowRight,
  Download,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

// Entry screen shown when the user lands on /assistants/rfp or
// /assistants/kraljic for the first time (and on reset). Two cards:
//
//   1) Baixar template — downloads a blank Excel template for offline
//      manual filling. No backend involved; the file is served from
//      /public/templates/.
//   2) Criar com assistente — switches the parent state machine to the
//      form phase (existing AI-assisted flow).
//
// Pure presentational — parent owns the "phase" state.

type Props = {
  /** Headline before the cards (e.g., "Assistente de RFP"). */
  title: string;
  /** One-line subhead under the title. */
  subtitle: string;
  /** URL of the downloadable template (under /public/templates/...). */
  templateHref: string;
  /** Filename used by the browser when downloading. */
  templateFilename: string;
  /** Display label for the template format (e.g., ".xlsx · planilha"). */
  templateFormat: string;
  /** One-line description of what the manual-fill option gives the user. */
  templateDescription: string;
  /** One-line description of what the assisted option gives the user. */
  assistedDescription: string;
  /** Icon for the manual-fill card. Defaults to Download. */
  TemplateIcon?: LucideIcon;
  /** Icon for the assisted card. Defaults to Sparkles. */
  AssistedIcon?: LucideIcon;
  /** Callback invoked when user picks the assisted path. */
  onAssistedClick: () => void;
};

export function AssistantEntryChoice({
  title,
  subtitle,
  templateHref,
  templateFilename,
  templateFormat,
  templateDescription,
  assistedDescription,
  TemplateIcon = Download,
  AssistedIcon = Sparkles,
  onAssistedClick,
}: Props) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          {title} <span className="text-brand">.</span>
        </h1>
        <p className="text-sm text-gray-400 mt-2 max-w-2xl">{subtitle}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Card 1 — Download template */}
        <a
          href={templateHref}
          download={templateFilename}
          className="group flex flex-col rounded-2xl border border-white/5 bg-[#141414] hover:bg-[#181818] hover:border-white/10 transition-all duration-300 p-6 active:scale-[0.99]"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-shrink-0 rounded-xl bg-white/5 border border-white/10 p-3 text-gray-300 group-hover:text-white transition-colors">
              <TemplateIcon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
              Opção 1
            </div>
          </div>

          <h2 className="text-xl font-semibold tracking-tight text-white">
            Baixar template
          </h2>
          <p className="text-sm text-gray-400 mt-2 leading-relaxed flex-1">
            {templateDescription}
          </p>

          <div className="mt-5 flex items-center justify-between pt-4 border-t border-white/5">
            <span className="text-[11px] text-gray-500 uppercase tracking-wider">
              {templateFormat}
            </span>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
              Baixar
              <Download
                className="h-3.5 w-3.5 group-hover:translate-y-0.5 transition-transform"
                aria-hidden="true"
              />
            </span>
          </div>
        </a>

        {/* Card 2 — Create with assistant */}
        <button
          type="button"
          onClick={onAssistedClick}
          className="group flex flex-col text-left rounded-2xl border border-brand/30 bg-brand/5 hover:bg-brand/10 hover:border-brand/50 transition-all duration-300 p-6 active:scale-[0.99]"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-shrink-0 rounded-xl bg-brand/10 border border-brand/30 p-3 text-brand">
              <AssistedIcon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-brand">
              Opção 2 · Recomendado
            </div>
          </div>

          <h2 className="text-xl font-semibold tracking-tight text-white">
            Criar com assistente
          </h2>
          <p className="text-sm text-gray-400 mt-2 leading-relaxed flex-1">
            {assistedDescription}
          </p>

          <div className="mt-5 flex items-center justify-between pt-4 border-t border-brand/10">
            <span className="text-[11px] text-brand uppercase tracking-wider font-medium">
              Formulário guiado
            </span>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-brand">
              Começar
              <ArrowRight
                className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform"
                aria-hidden="true"
              />
            </span>
          </div>
        </button>
      </div>
    </div>
  );
}
