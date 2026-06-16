import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { LEGAL_LAST_UPDATED, CURRENT_LEGAL_VERSION } from '@/lib/legal/constants';

// Sub-projeto 28 — layout compartilhado dos 3 documentos legais.
// Header com voltar + título + versão · markdown renderizado · footer
// com referência cruzada pros outros docs.

type Props = {
  title: string;
  markdown: string;
};

export function LegalDocument({ title, markdown }: Props) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Voltar
          </Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-12 space-y-6">
        <div className="space-y-2 pb-6 border-b border-border">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <div className="text-xs text-muted-foreground space-x-3">
            <span>Última atualização: {LEGAL_LAST_UPDATED}</span>
            <span>·</span>
            <span>Versão {CURRENT_LEGAL_VERSION}</span>
          </div>
        </div>
        <article className="prose prose-sm dark:prose-invert max-w-none [&_h2]:mt-8 [&_h3]:mt-6 [&_a]:text-brand [&_a]:no-underline hover:[&_a]:underline [&_table]:block [&_table]:overflow-x-auto">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        </article>
        <footer className="pt-8 border-t border-border text-xs text-muted-foreground flex flex-wrap gap-4">
          <Link href="/termos" className="hover:text-foreground transition-colors">
            Termos de Uso
          </Link>
          <Link href="/privacidade" className="hover:text-foreground transition-colors">
            Política de Privacidade
          </Link>
          <Link href="/cookies" className="hover:text-foreground transition-colors">
            Política de Cookies
          </Link>
        </footer>
      </main>
    </div>
  );
}
