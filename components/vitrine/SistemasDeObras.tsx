'use client';

import { useEffect, useState } from 'react';

import { SISTEMAS_COMPLETOS, SISTEMAS_DE_OBRAS, type SistemaCompleto } from '@/lib/vitrine/sistema-completo';
import { SistemaCompletoFrame } from './SistemaCompletoFrame';

// Aba Gestão de Obras para quem apresenta (sub-projeto 91): dois sistemas
// completos de demonstração, escolhidos num seletor no topo. A escolha fica
// lembrada no navegador de quem apresenta.
const CHAVE = 'progpt_gestao_obras_sistema_v1';

export function SistemasDeObras() {
  const [sistema, setSistema] = useState<SistemaCompleto>('obras');

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE) as SistemaCompleto | null;
      if (salvo && SISTEMAS_DE_OBRAS.includes(salvo)) setSistema(salvo);
    } catch {
      // sem armazenamento: começa no primeiro
    }
  }, []);

  const escolher = (s: SistemaCompleto) => {
    setSistema(s);
    try {
      localStorage.setItem(CHAVE, s);
    } catch {
      // ok
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div role="tablist" aria-label="Sistema de obras" className="flex shrink-0 flex-wrap gap-2">
        {SISTEMAS_DE_OBRAS.map((s) => {
          const ativo = s === sistema;
          return (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={ativo}
              onClick={() => escolher(s)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                ativo
                  ? 'border-transparent bg-brand-gradient text-black'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground'
              }`}
            >
              {SISTEMAS_COMPLETOS[s].titulo}
            </button>
          );
        })}
      </div>
      <div className="min-h-0 flex-1">
        <SistemaCompletoFrame key={sistema} sistema={sistema} />
      </div>
    </div>
  );
}
