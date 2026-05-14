'use client';

import Link from 'next/link';
import { FileText, Clock, History } from 'lucide-react';

// Sub-projeto 20: hub page that lists available assistants. v1 has only
// RFP; future sub-projetos add Spec Técnica, Análise de Cotação, etc.

type Assistant = {
  type: 'rfp';
  href: string;
  title: string;
  description: string;
  cta: string;
  status: 'available' | 'coming-soon';
};

const ASSISTANTS: Assistant[] = [
  {
    type: 'rfp',
    href: '/assistants/rfp',
    title: 'Assistente de RFP',
    description:
      'Gera um draft completo de RFP (Request for Proposal) com base nos parâmetros da sua categoria, no template selecionado e na base de conhecimento.',
    cta: 'Começar',
    status: 'available',
  },
];

export function AssistantsHub() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Assistentes</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Cada assistente combina a base de conhecimento com templates curados pra te entregar
            um artefato pronto pra usar. Mais assistentes em breve.
          </p>
        </div>
        <Link
          href="/assistants/history"
          className="inline-flex items-center gap-1.5 text-sm rounded-md border border-input bg-background hover:bg-accent px-3 h-9"
        >
          <History className="h-4 w-4" />
          Meus RFPs
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ASSISTANTS.map((a) => {
          const Inner = (
            <div className="rounded-lg border border-border bg-card hover:bg-accent transition-colors p-5 h-full flex flex-col">
              <div className="flex items-start gap-3">
                <div className="rounded-md bg-primary/10 p-2 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h2 className="text-sm font-semibold">{a.title}</h2>
                  <p className="text-xs text-muted-foreground mt-1">{a.description}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                {a.status === 'coming-soon' ? (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Em breve
                  </span>
                ) : (
                  <span className="text-xs text-primary font-medium">{a.cta} →</span>
                )}
              </div>
            </div>
          );
          if (a.status === 'available') {
            return (
              <Link key={a.type} href={a.href} className="block">
                {Inner}
              </Link>
            );
          }
          return (
            <div key={a.type} className="opacity-60 cursor-not-allowed">
              {Inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
