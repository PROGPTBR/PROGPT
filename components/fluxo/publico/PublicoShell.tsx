import { BrandLogo } from '@/components/brand/BrandLogo';
import { LegalFooter } from '@/components/legal/LegalFooter';

// Moldura das páginas públicas do Fluxo (acompanhamento e aprovação por
// e-mail, sub-projeto 90): quem abre não tem conta, então não há menu nem
// cabeçalho do produto, só a marca e o conteúdo.
export function PublicoShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans antialiased flex flex-col">
      <header className="mx-auto w-full max-w-2xl px-4 sm:px-6 pt-8">
        <BrandLogo size="sm" />
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 sm:px-6 py-8">{children}</main>
      <LegalFooter />
    </div>
  );
}

export function LinkIndisponivel({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-2">
      <h1 className="text-xl font-semibold">{titulo}</h1>
      <p className="text-sm text-muted-foreground">{texto}</p>
    </div>
  );
}
