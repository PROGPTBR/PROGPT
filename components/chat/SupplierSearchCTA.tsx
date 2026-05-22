'use client';

import Link from 'next/link';
import { ArrowRight, Factory } from 'lucide-react';

type Props = {
  query: string;
};

export function SupplierSearchCTA({ query }: Props) {
  const href = query
    ? `/assistants/suppliers?q=${encodeURIComponent(query)}`
    : '/assistants/suppliers';
  return (
    <Link
      href={href}
      className="group mt-4 flex items-start gap-3 rounded-2xl border border-brand/30 bg-brand/5 hover:bg-brand/10 hover:border-brand/50 px-4 py-3 transition-all duration-300 active:scale-[0.99]"
    >
      <Factory
        className="h-5 w-5 text-brand flex-shrink-0 mt-0.5"
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="text-sm font-medium text-foreground">
          Abrir Busca de Fornecedores
        </div>
        <div className="text-xs text-muted-foreground line-clamp-2">
          Pré-preenchido com: <span className="italic">&ldquo;{query}&rdquo;</span>
        </div>
      </div>
      <ArrowRight
        className="h-4 w-4 text-brand flex-shrink-0 mt-1 group-hover:translate-x-0.5 transition-transform"
        aria-hidden="true"
      />
    </Link>
  );
}
