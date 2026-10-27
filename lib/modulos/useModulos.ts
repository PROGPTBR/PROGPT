'use client';

import { useEffect, useMemo, useState } from 'react';
import { MODULO_IDS, moduloDoHref } from './catalogo';

// Até confirmar a disponibilidade, oculta os módulos cadastrados.
// Este filtro controla a exibição. As permissões de acesso
// continuam sendo verificadas no servidor.

const TODOS_OS_MODULOS: readonly string[] = [...MODULO_IDS];

export function useModulosDesativados(
  inicial?: readonly string[],
): ReadonlySet<string> {
  const [lista, setLista] = useState<readonly string[]>(
    () => inicial ?? TODOS_OS_MODULOS,
  );

  useEffect(() => {
    const controller = new AbortController();

    async function carregar() {
      try {
        const response = await fetch('/api/account/modulos', {
          cache: 'no-store',
          credentials: 'same-origin',
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('Não foi possível consultar os módulos.');
        }

        const dados: unknown = await response.json();

        if (
          typeof dados !== 'object' ||
          dados === null ||
          !('desativados' in dados) ||
          !Array.isArray(dados.desativados) ||
          !dados.desativados.every(
            (item: unknown): item is string =>
              typeof item === 'string',
          )
        ) {
          throw new Error('Resposta de módulos inválida.');
        }

        if (!controller.signal.aborted) {
          setLista(
            dados.desativados.filter((id) => MODULO_IDS.has(id)),
          );
        }
      } catch {
        if (!controller.signal.aborted) {
          setLista(TODOS_OS_MODULOS);
        }
      }
    }

    void carregar();

    return () => {
      controller.abort();
    };
  }, []);

  return useMemo(() => new Set(lista), [lista]);
}

/** Indica se o endereço pertence a um módulo desativado. */
export function hrefDesligado(
  href: string,
  desligados: ReadonlySet<string>,
): boolean {
  const modulo = moduloDoHref(href);

  return modulo !== null && desligados.has(modulo);
}