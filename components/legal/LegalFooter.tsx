import Link from 'next/link';

// Sub-projeto 28 — footer compartilhado com links pros 3 docs legais.
// Discreto, segundo plano. Mountar em layouts user-facing (landing,
// login, signup, account/*). NÃO mountar no /chat (UX-noisy).

export function LegalFooter() {
  return (
    <footer className="border-t border-border bg-background/50 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] text-muted-foreground">
        <Link href="/termos" className="hover:text-foreground transition-colors">
          Termos de Uso
        </Link>
        <span aria-hidden>·</span>
        <Link href="/privacidade" className="hover:text-foreground transition-colors">
          Privacidade
        </Link>
        <span aria-hidden>·</span>
        <Link href="/cookies" className="hover:text-foreground transition-colors">
          Cookies
        </Link>
        <span aria-hidden>·</span>
        <a
          href="mailto:rgoalves@gmail.com?subject=Suporte"
          className="hover:text-foreground transition-colors"
        >
          Suporte
        </a>
      </div>
    </footer>
  );
}
