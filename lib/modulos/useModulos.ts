'use client';

import { useEffect, useMemo, useState } from 'react';
import { moduloDoHref } from './catalogo';

// Módulos desligados para a empresa do usuário, para esconder menus, cards e
// atalhos. Uma busca por carregamento de página, compartilhada entre os
// componentes. Enquanto carrega (ou se falhar) nada é escondido: o bloqueio de
// verdade é no middleware e nas rotas.

let pedido: Promise<string[]> | null = null;

function carregar(): Promise<string[]> {
  if (!pedido) {
    pedido = fetch('/api/account/modulos', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { desativados: [] }))
      .then((d: { desativados?: unknown }) =>
        Array.isArray(d.desativados) ? d.desativados.filter((x): x is string => typeof x === 'string') : [],
      )
      .catch(() => {
        pedido = null;
        return [];
      });
  }
  return pedido;
}

export function useModulosDesativados(inicial?: readonly string[]): ReadonlySet<string> {
  const [lista, setLista] = useState<readonly string[]>(inicial ?? []);
  useEffect(() => {
    let vivo = true;
    void carregar().then((l) => {
      if (vivo) setLista(l);
    });
    return () => {
      vivo = false;
    };
  }, []);
  return useMemo(() => new Set(lista), [lista]);
}

/** true quando o href pertence a um módulo desligado. */
export function hrefDesligado(href: string, desligados: ReadonlySet<string>): boolean {
  if (desligados.size === 0) return false;
  const m = moduloDoHref(href);
  return m !== null && desligados.has(m);
}
