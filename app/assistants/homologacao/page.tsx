import Link from 'next/link';
import { Mail, ShieldCheck } from 'lucide-react';
import { LEGAL_CONTACT_EMAIL } from '@/lib/legal/constants';

export const dynamic = 'force-dynamic';

// Homologação de Fornecedor virou "sob demanda" por decisão do diretor
// (backlog 2026-08-19, ver docs/product/backlog-diretor-2026-08-19.md, Batch D):
// depende de projeto/contrato dedicado, então a criação de um novo run fica
// bloqueada aqui. `<HomologacaoAssistant/>`, a rota de API e o CHECK do banco
// seguem intactos — histórico de runs antigos continua abrindo normalmente em
// /assistants/runs/[id] (PastHomologacaoView).
export default function HomologacaoAssistantPage() {
  const mailtoHref = `mailto:${LEGAL_CONTACT_EMAIL}?subject=${encodeURIComponent(
    'Interesse: Homologação de Fornecedor',
  )}`;

  return (
    <div className="panel flex flex-col items-center text-center px-6 py-16">
      <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient-soft text-brand">
        <ShieldCheck className="h-7 w-7" aria-hidden="true" />
      </span>
      <span className="mb-3 inline-flex rounded-full bg-brand-gradient px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-black">
        Sob demanda
      </span>
      <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
        Homologação de Fornecedor
      </h1>
      <p className="mt-3 max-w-xl text-sm text-muted-foreground leading-relaxed">
        Esta ferramenta demanda um projeto dedicado de integração com as bases
        de compliance do seu setor. Fale com o nosso time para avaliar seu
        caso.
      </p>
      <a
        href={mailtoHref}
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand-gradient text-black px-5 h-10 text-sm font-semibold hover:brightness-110 active:scale-95 transition-all"
      >
        <Mail className="h-4 w-4" aria-hidden="true" />
        Falar com o time
      </a>
      <Link
        href="/assistants"
        className="mt-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        Ver os assistentes disponíveis
      </Link>
    </div>
  );
}
