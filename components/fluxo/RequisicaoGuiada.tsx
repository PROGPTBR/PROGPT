'use client';

import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';

import {
  PERGUNTAS_GUIADAS,
  montarRequisicao,
  pendentes,
  type RespostasGuiadas,
} from '@/lib/fluxo/requisicao-guiada';

// Abertura de compra passo a passo: uma pergunta por vez, com respostas
// rápidas em botão. No fim mostra o texto montado (editável) e devolve para o
// formulário, que segue igual ao modo livre.

export function RequisicaoGuiada({
  onPronto,
  onRefazer,
}: {
  onPronto: (r: { titulo: string; requisicao: string }) => void;
  onRefazer: () => void;
}) {
  const [passo, setPasso] = useState(0);
  const [respostas, setRespostas] = useState<RespostasGuiadas>({});
  const total = PERGUNTAS_GUIADAS.length;
  const revisao = passo >= total;
  const p = PERGUNTAS_GUIADAS[Math.min(passo, total - 1)]!;
  const valor = respostas[p.campo] ?? '';

  function avancar() {
    if (!revisao && p.obrigatoria && !valor.trim()) return;
    const prox = passo + 1;
    setPasso(prox);
    if (prox >= total) onPronto(montarRequisicao(respostas));
  }

  if (revisao) {
    const faltam = pendentes(respostas);
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
          <Check className="h-4 w-4" aria-hidden /> Pronto. Confira o texto abaixo e abra o processo.
        </div>
        {faltam.length > 0 && (
          <p className="text-xs text-amber-700 dark:text-amber-400">Faltou responder: {faltam.map((f) => f.pergunta).join(' ')}</p>
        )}
        <button
          type="button"
          onClick={() => {
            setPasso(0);
            onRefazer();
          }}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Refazer as perguntas
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1" aria-hidden>
        {PERGUNTAS_GUIADAS.map((q, i) => (
          <span key={q.campo} className={`h-1.5 flex-1 rounded-full ${i <= passo ? 'bg-brand' : 'bg-muted'}`} />
        ))}
      </div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        Pergunta {passo + 1} de {total}
        {!p.obrigatoria && ' · opcional'}
      </div>
      <label htmlFor={`guiado-${p.campo}`} className="block text-base font-semibold">
        {p.pergunta}
      </label>
      <p className="text-xs text-muted-foreground">{p.ajuda}</p>

      {p.opcoes && (
        <div className="flex flex-wrap gap-2">
          {p.opcoes.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setRespostas((r) => ({ ...r, [p.campo]: o }))}
              className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                valor === o ? 'border-brand bg-brand/10 text-foreground' : 'border-border hover:bg-accent'
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      )}

      <input
        id={`guiado-${p.campo}`}
        autoFocus
        value={valor}
        onChange={(e) => setRespostas((r) => ({ ...r, [p.campo]: e.target.value }))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            avancar();
          }
        }}
        placeholder={p.placeholder}
        className="w-full rounded-lg border border-input bg-background px-3 h-10 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      />

      <div className="flex flex-wrap items-center gap-2">
        {passo > 0 && (
          <button
            type="button"
            onClick={() => setPasso((n) => n - 1)}
            className="inline-flex items-center gap-1 rounded-full border border-border h-9 px-4 text-sm hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> Voltar
          </button>
        )}
        <button
          type="button"
          onClick={avancar}
          disabled={p.obrigatoria && !valor.trim()}
          className="inline-flex items-center gap-1 rounded-full bg-foreground text-background h-9 px-4 text-sm font-medium disabled:opacity-40"
        >
          {passo === total - 1 ? 'Concluir' : 'Próxima'} <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
        {!p.obrigatoria && !valor.trim() && (
          <button type="button" onClick={avancar} className="text-xs text-muted-foreground hover:text-foreground">
            Pular
          </button>
        )}
        <span className="text-[11px] text-muted-foreground">Enter avança</span>
      </div>
    </div>
  );
}
