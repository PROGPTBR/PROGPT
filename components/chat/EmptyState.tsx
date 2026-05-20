'use client';

import Link from 'next/link';
import { FolderOpen, ArrowRight } from 'lucide-react';

type Suggestion = { label: string; query: string };

const SUGGESTIONS: Suggestion[] = [
  { label: 'Definir', query: 'O que é a matriz de Kraljic?' },
  { label: 'Aplicar', query: 'Como aplicar TCO em SaaS?' },
  { label: 'Comparar', query: 'Porter vs Kraljic em compras estratégicas' },
  { label: 'Recomendar', query: 'Estratégia de compras para varejo de alimentos' },
];

// Sub-projeto 18: discoverability suggestion that triggers the
// `library_overview` classifier intent.
const LIBRARY_OVERVIEW_QUERY = 'Sobre o que você pode me ensinar?';

export function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 gap-10">
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          ProcurementGPT <span className="text-brand">.</span>
        </h1>
        <p className="mt-3 text-sm text-gray-400 max-w-md">
          Especialista em teorias de procurement. Pergunte sobre frameworks,
          aplicações e casos.
        </p>
      </div>
      <div className="w-full max-w-xl flex flex-col gap-3">
        {/* Sub-projeto 34 follow-up — orientar o usuário a criar um Perfil
            da Categoria, que ativa respostas direcionadas no chat. */}
        <Link
          href="/assistants/profile"
          className="group flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20 transition-all duration-300 p-4 active:scale-[0.99]"
        >
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand/10 border border-brand/30 flex items-center justify-center text-brand">
              <FolderOpen className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-brand">
                Personalize
              </div>
              <div className="mt-0.5 text-sm text-white font-medium">
                Crie um Perfil da Categoria
              </div>
              <div className="mt-0.5 text-xs text-gray-400 leading-relaxed">
                Caracterize sua categoria de compra (sub-segmentos,
                requisitos, prioridade) e use no chat com o seletor acima
                do campo de mensagem. As respostas passam a usar isso como
                contexto.
              </div>
            </div>
          </div>
          <ArrowRight
            className="flex-shrink-0 h-4 w-4 text-gray-500 group-hover:text-white group-hover:translate-x-0.5 transition-all"
            aria-hidden="true"
          />
        </Link>
        <button
          type="button"
          onClick={() => onPick(LIBRARY_OVERVIEW_QUERY)}
          className="text-left rounded-xl border border-brand/30 bg-brand/5 hover:bg-brand/10 hover:border-brand/50 transition-all duration-300 p-4 active:scale-[0.99]"
        >
          <div className="text-[10px] font-semibold uppercase tracking-wider text-brand">
            Descobrir
          </div>
          <div className="mt-1.5 text-sm text-white font-medium">
            {LIBRARY_OVERVIEW_QUERY}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            Lista os temas que estão na base de conhecimento agora
          </div>
        </button>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => onPick(s.query)}
              className="text-left rounded-xl border border-white/5 bg-[#141414] hover:bg-[#181818] hover:border-white/10 transition-all duration-300 p-4 active:scale-[0.99]"
            >
              <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                {s.label}
              </div>
              <div className="mt-1.5 text-sm text-white">{s.query}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
