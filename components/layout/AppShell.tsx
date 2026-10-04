import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Header } from '@/app/login/header';
import { SupportWidget } from '@/components/support/SupportWidget';

// Moldura única das telas do produto (logado). Antes cada página repetia o
// mesmo bloco de Header + brilhos + <main>, e a repetição foi derivando:
// larguras de max-w-3xl a max-w-7xl, pt-20 vs pt-24, px-4 vs px-6, uma página
// com dois brilhos e outra com um só. Tudo isso passa a sair daqui.
//
// Largura: 'default' é o padrão de quase tudo; 'narrow' só para telas de
// formulário (perfil); 'wide' para as que são essencialmente uma tela cheia
// de ferramenta (simulador).

export type AppShellWidth = 'narrow' | 'default' | 'wide';

const WIDTH: Record<AppShellWidth, string> = {
  narrow: 'max-w-3xl',
  default: 'max-w-6xl',
  wide: 'max-w-[1600px]',
};

export function AppShell({
  children,
  width = 'default',
  back,
  actions,
  fill = false,
}: {
  children: React.ReactNode;
  width?: AppShellWidth;
  /** Link de volta no topo do conteúdo. */
  back?: { href: string; label: string };
  /** Conteúdo alinhado à direita, na mesma linha do link de volta. */
  actions?: React.ReactNode;
  /** Ocupa exatamente a altura da janela (ferramenta embutida que rola por conta própria). */
  fill?: boolean;
}) {
  const hasTopRow = Boolean(back || actions);

  return (
    <>
      <Header />
      <div
        className={
          'relative bg-background text-foreground antialiased ' +
          (fill ? 'h-[100dvh] overflow-hidden' : 'min-h-screen overflow-x-hidden')
        }
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 right-1/4 h-96 w-96 rounded-full bg-brand/8 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 -left-20 h-80 w-80 rounded-full bg-brand/5 blur-3xl"
        />

        <main
          className={
            'relative z-10 mx-auto w-full px-4 pt-20 sm:px-6 sm:pt-24 ' +
            WIDTH[width] +
            (fill ? ' flex h-full min-h-0 flex-col gap-3 pb-3' : ' pb-12')
          }
        >
          {hasTopRow && (
            <div
              className={
                'print-hide flex items-center justify-between gap-3 ' +
                (fill ? 'shrink-0' : 'mb-6')
              }
            >
              {back ? (
                <Link
                  href={back.href}
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  {back.label}
                </Link>
              ) : (
                <span />
              )}
              {actions}
            </div>
          )}

          {children}
        </main>
      </div>
      <SupportWidget />
    </>
  );
}
