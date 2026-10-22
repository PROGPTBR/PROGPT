'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { ArrowRight, Database, MapPinned, Search } from 'lucide-react';

import { SuppliersAssistant } from '@/components/assistants/SuppliersAssistant';
import { MapaFornecedoresAssistant } from '@/components/assistants/mapa/MapaFornecedoresAssistant';
import { useAbaDoTour } from '@/components/vitrine/ui';

// Busca de Fornecedores e Mapa da Operação numa tela só (pedido do Alexandre,
// 2026-10-21: "estes dois poderiam ficar na mesma tela" e "antes de aparecer o
// local de busca, aparecer qual busca o cliente gostaria"). Primeiro o cliente
// escolhe o que quer encontrar; só depois aparece o campo, do jeito certo para
// cada caso. A escolha fica na URL (?tipo=) para voltar e compartilhar.

export type TipoBusca = 'item' | 'operacao';
const TIPOS: readonly TipoBusca[] = ['item', 'operacao'];

type Opcao = {
  id: TipoBusca | 'base';
  titulo: string;
  texto: string;
  exemplo: string;
  icone: typeof Search;
};

const OPCOES: Opcao[] = [
  {
    id: 'item',
    titulo: 'Um item ou serviço',
    texto: 'Quem vende ou presta o que você precisa, na sua região: empresas ativas na Receita Federal e na internet.',
    exemplo: 'Ex.: artigos de papelaria em Manaus',
    icone: Search,
  },
  {
    id: 'operacao',
    titulo: 'Todos os fornecedores da minha operação',
    texto: 'Descreva a empresa e a região: a IA monta as categorias de compra (CAPEX e OPEX) e mostra os fornecedores num mapa.',
    exemplo: 'Ex.: emissora de TV em Curitiba',
    icone: MapPinned,
  },
  {
    id: 'base',
    titulo: 'Na minha base de fornecedores',
    texto: 'Procure entre os fornecedores que você já salvou ou subiu na sua vendor list.',
    exemplo: 'Ex.: quem eu tenho de material elétrico',
    icone: Database,
  },
];

export function FornecedoresUnificado({
  tipoInicial,
  mapaLiberado,
  buscaAmpliada,
  pedidoMapa = '',
}: {
  tipoInicial: TipoBusca | null;
  /** Módulo do Mapa ligado para a empresa do usuário. */
  mapaLiberado: boolean;
  buscaAmpliada: boolean;
  pedidoMapa?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [tipo, setTipo] = useState<TipoBusca | null>(
    tipoInicial === 'operacao' && !mapaLiberado ? 'item' : tipoInicial,
  );

  const escolher = useCallback(
    (novo: TipoBusca | null) => {
      setTipo(novo);
      const q = new URLSearchParams(params.toString());
      if (novo) q.set('tipo', novo);
      else q.delete('tipo');
      // Trocar de tipo descarta o pedido do outro modo.
      if (novo !== tipoInicial) q.delete('q');
      const s = q.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    [params, pathname, router, tipoInicial],
  );

  // O tour pede o modo "item" para mostrar o formulário da busca.
  useAbaDoTour(TIPOS, escolher);

  const opcoes = OPCOES.filter((o) => o.id !== 'operacao' || mapaLiberado);

  if (!tipo) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Fornecedores <span className="text-brand">.</span>
          </h1>
          <p className="mt-2 text-muted-foreground">O que você quer encontrar?</p>
        </div>
        <div data-tour="busca-tipo" className="grid gap-3 md:grid-cols-3">
          {opcoes.map((o) => {
            const corpo = (
              <>
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand/10 text-brand">
                  <o.icone className="h-5 w-5" />
                </span>
                <span className="mt-4 block text-lg font-semibold">{o.titulo}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{o.texto}</span>
                <span className="mt-3 block text-xs text-muted-foreground/80">{o.exemplo}</span>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand">
                  Começar <ArrowRight className="h-4 w-4" />
                </span>
              </>
            );
            const classe =
              'group flex flex-col rounded-2xl border border-border bg-card p-5 text-left transition-colors hover:border-brand/60 hover:bg-brand/5';
            return o.id === 'base' ? (
              <Link key={o.id} href="/fornecedores" className={classe}>
                {corpo}
              </Link>
            ) : (
              <button key={o.id} type="button" onClick={() => escolher(o.id as TipoBusca)} className={classe}>
                {corpo}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div
        data-tour="busca-tipo"
        role="tablist"
        aria-label="Tipo de busca"
        className="flex flex-wrap items-center gap-1 rounded-xl bg-muted p-1 text-sm"
      >
        {opcoes.map((o) => {
          const ativa = o.id === tipo;
          const classe = `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
            ativa ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`;
          return o.id === 'base' ? (
            <Link key={o.id} href="/fornecedores" className={classe}>
              <o.icone className="h-4 w-4" /> {o.titulo}
            </Link>
          ) : (
            <button
              key={o.id}
              type="button"
              role="tab"
              aria-selected={ativa}
              onClick={() => escolher(o.id as TipoBusca)}
              className={classe}
            >
              <o.icone className="h-4 w-4" /> {o.titulo}
            </button>
          );
        })}
      </div>
      {tipo === 'item' ? (
        <SuppliersAssistant buscaAmpliada={buscaAmpliada} />
      ) : (
        <MapaFornecedoresAssistant pedidoInicial={pedidoMapa} />
      )}
    </div>
  );
}
