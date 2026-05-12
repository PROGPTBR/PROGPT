'use client';

type Suggestion = { label: string; query: string };

const SUGGESTIONS: Suggestion[] = [
  { label: 'Definir', query: 'O que é a matriz de Kraljic?' },
  { label: 'Aplicar', query: 'Como aplicar TCO em SaaS?' },
  { label: 'Comparar', query: 'Porter vs Kraljic em compras estratégicas' },
  { label: 'Recomendar', query: 'Estratégia de compras para varejo de alimentos' },
];

// Sub-projeto 18: discoverability suggestion that triggers the
// `library_overview` classifier intent. Lives separately from the four
// task-oriented cards so it stands out as the "first question to ask".
const LIBRARY_OVERVIEW_QUERY = 'Sobre o que você pode me ensinar?';

export function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 gap-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">ProcurementGPT</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-md">
          Especialista em teorias de procurement. Pergunte sobre frameworks, aplicações e casos.
        </p>
      </div>
      <div className="w-full max-w-xl flex flex-col gap-3">
        <button
          type="button"
          onClick={() => onPick(LIBRARY_OVERVIEW_QUERY)}
          className="text-left rounded-lg border border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors p-4"
        >
          <div className="text-xs font-semibold uppercase tracking-wide text-primary">
            Descobrir
          </div>
          <div className="mt-1 text-sm text-foreground">{LIBRARY_OVERVIEW_QUERY}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Lista os temas que estão na base de conhecimento agora
          </div>
        </button>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => onPick(s.query)}
              className="text-left rounded-lg border border-border bg-card hover:bg-accent transition-colors p-4"
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-primary">
                {s.label}
              </div>
              <div className="mt-1 text-sm text-foreground">{s.query}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
