// Tipos do Painel unificado (dashboard estilo BI do cliente). O payload é
// computado server-side em GET /api/dashboard e renderizado por
// components/dashboard/UnifiedDashboard.tsx.

export type DashboardOverview = {
  sessions: number; // conversas no chat
  assistantRuns: number; // execuções de assistentes concluídas (status=done)
  invoicesProcessed: number; // notas usáveis na Análise de Gastos
  suppliersAnalyzed: number; // fornecedores distintos analisados
  categoriesCovered: number; // categorias de gasto distintas
  spendAnalyzedRef: number; // gasto total analisado (moeda de referência)
};

export type DashboardBar = {
  key: string;
  totalRef: number;
  pct: number; // 0-1
};

export type DashboardSpend = {
  referenceCurrency: string;
  totalRef: number;
  invoiceCount: number;
  ticketMedio: number;
  poCoveragePct: number; // 0-100
  byCategory: DashboardBar[];
  bySupplier: DashboardBar[];
  byMonth: { key: string; totalRef: number }[]; // YYYY-MM crescente
};

export type DashboardPayload = {
  generatedAt: string; // ISO
  company: { name: string | null };
  overview: DashboardOverview;
  runsByType: { type: string; label: string; count: number }[];
  activityByMonth: { key: string; sessions: number; runs: number }[]; // últimos 12 meses
  spend: DashboardSpend | null; // null quando o usuário ainda não rodou Análise de Gastos
  plan: {
    status: string | null;
    plan: string | null;
    currentPeriodEnd: string | null;
  };
};
