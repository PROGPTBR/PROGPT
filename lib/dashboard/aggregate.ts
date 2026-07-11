import { assistantLabel } from './labels';

// Agregações puras (sem I/O) do Painel unificado — testáveis e reusadas pela
// rota GET /api/dashboard. A leitura das tabelas (service-role) fica na rota;
// aqui só transformamos os dados já carregados.

/** Últimos `n` meses (inclusive o mês de `ref`), como 'YYYY-MM' em ordem crescente. */
export function lastNMonths(ref: Date, n: number): string[] {
  const out: string[] = [];
  const y = ref.getUTCFullYear();
  const m = ref.getUTCMonth();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

/** 'YYYY-MM-DD...' ou ISO → 'YYYY-MM'. */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

/** Conta quantas datas caem em cada mês da janela `months`. Fora da janela é ignorado. */
export function tallyByMonth(
  isoDates: string[],
  months: string[],
): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const mk of months) acc[mk] = 0;
  const set = new Set(months);
  for (const iso of isoDates) {
    if (!iso) continue;
    const k = monthKey(iso);
    if (set.has(k)) acc[k] = (acc[k] ?? 0) + 1;
  }
  return acc;
}

/** Série de atividade (conversas + execuções) por mês, na janela dada. */
export function activitySeries(
  months: string[],
  sessionDates: string[],
  runDates: string[],
): { key: string; sessions: number; runs: number }[] {
  const s = tallyByMonth(sessionDates, months);
  const r = tallyByMonth(runDates, months);
  return months.map((key) => ({ key, sessions: s[key] ?? 0, runs: r[key] ?? 0 }));
}

/** Execuções concluídas agrupadas por tipo de assistente, desc por contagem. */
export function groupRunsByType(
  runs: { assistant_type: string; status: string }[],
): { type: string; label: string; count: number }[] {
  const map = new Map<string, number>();
  for (const run of runs) {
    if (run.status !== 'done') continue;
    map.set(run.assistant_type, (map.get(run.assistant_type) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([type, count]) => ({ type, label: assistantLabel(type), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
