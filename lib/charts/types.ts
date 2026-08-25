// "Gráfico Rápido" (/assistants/graficos) — tipos compartilhados entre
// parse → infer → series → render. Ao contrário dos outros *-chart.ts (que
// recebem sempre a mesma shape de análise, ex.: AbcAnalysis), esta ferramenta
// aceita QUALQUER tabela que o usuário colar/subir — por isso o pipeline
// passa por uma etapa extra de inferência (heurística + LLM) antes de virar
// uma série plotável.

export type QuickChartKind = 'bar' | 'line' | 'pie';

export type QuickChartTable = {
  headers: string[];
  rows: (string | number | null)[][];
};

export type QuickChartSpec = {
  chartType: QuickChartKind;
  categoryColumn: string;
  valueColumn: string;
  title: string;
};

export type QuickChartSeries = {
  labels: string[];
  values: number[];
};
