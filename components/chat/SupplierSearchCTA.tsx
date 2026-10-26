'use client';

import Link from 'next/link';
import { ArrowRight, Factory, MapPinned } from 'lucide-react';
import { pareceMapaDaOperacao } from '@/lib/mapa-fornecedores/tipos';
import { useModulosDesativados } from '@/lib/modulos/useModulos';

type Props = {
  query: string;
};

// Pedido de fornecedores no chat. Item ou serviço: só a Busca de Fornecedores
// (vendor list, internet e Receita). Operação inteira (várias categorias, com
// mapa): o Mapa de Fornecedores da Operação em primeiro e a Busca como
// alternativa.
export function SupplierSearchCTA({ query }: Props) {
  const desligados = useModulosDesativados();
  const busca = {
    id: 'suppliers',
    href: query ? `/assistants/suppliers?q=${encodeURIComponent(query.slice(0, 1500))}` : '/assistants/suppliers',
    titulo: 'Abrir Busca de Fornecedores',
    sub: 'Vendor list, internet e Receita Federal, para um item ou serviço',
    Icon: Factory,
  };
  const mapa = {
    id: 'mapa_fornecedores',
    href: query ? `/assistants/mapa_fornecedores?q=${encodeURIComponent(query.slice(0, 6000))}` : '/assistants/mapa_fornecedores',
    titulo: 'Mapear fornecedores da operação',
    sub: 'Categorias de compra, até 50 fornecedores da região num mapa',
    Icon: MapPinned,
  };
  const operacaoInteira = pareceMapaDaOperacao(query);
  const opcoes = (operacaoInteira ? [mapa, busca] : [busca]).filter((o) => !desligados.has(o.id));

  return (
    <div className="mt-4 space-y-2">
      {opcoes.map(({ id, href, titulo, sub, Icon }, i) => (
        <Link
          key={id}
          href={href}
          className={`group flex items-start gap-3 rounded-2xl border px-4 py-3 transition-all duration-300 active:scale-[0.99] ${
            i === 0 ? 'border-brand/30 bg-brand/5 hover:bg-brand/10 hover:border-brand/50' : 'border-border hover:bg-muted'
          }`}
        >
          <Icon className="h-5 w-5 text-brand flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1 min-w-0 space-y-0.5">
            <div className="text-sm font-medium text-foreground">{titulo}</div>
            <div className="text-xs text-muted-foreground line-clamp-2">
              {sub}. Pré-preenchido com: <span className="italic">&ldquo;{query}&rdquo;</span>
            </div>
          </div>
          <ArrowRight
            className="h-4 w-4 text-brand flex-shrink-0 mt-1 group-hover:translate-x-0.5 transition-transform"
            aria-hidden="true"
          />
        </Link>
      ))}
    </div>
  );
}
