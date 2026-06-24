// Tipos do assistente Spend Analysis (Análise de Gastos).
//
// - `SpendInvoiceRow`  → shape de uma linha da tabela spend_invoices (DB).
// - `SpendInvoiceFields` → campos extraídos de um PDF/planilha (pré-persistência).
// - `CubeInvoice` / `SpendCube` → entrada e saída da agregação determinística
//   (lib/spend/cube.ts), pura e testável.

export type SpendInvoiceStatus =
  | 'pending'
  | 'extracting'
  | 'done'
  | 'needs_review'
  | 'error';

export type SpendInvoiceSource = 'pdf' | 'sheet';

/** Linha da tabela `spend_invoices` (serialização do Postgres). */
export type SpendInvoiceRow = {
  id: string;
  run_id: string;
  user_id: string;
  storage_path: string | null;
  filename: string;
  source: SpendInvoiceSource;
  status: SpendInvoiceStatus;
  invoice_number: string | null;
  po_number: string | null;
  country: string | null;
  currency: string | null;
  total: number | null;
  total_ref: number | null;
  fx_rate: number | null;
  payment_terms: string | null;
  description: string | null;
  supplier: string | null;
  supplier_normalized: string | null;
  invoice_date: string | null; // YYYY-MM-DD
  category: string | null;
  category_justification: string | null;
  low_confidence: boolean;
  ocr_used: boolean;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

/** Campos de uma invoice extraídos de PDF ou planilha (antes de persistir). */
export type SpendInvoiceFields = {
  invoiceNumber?: string | null;
  poNumber?: string | null;
  country?: string | null;
  currency?: string | null;
  total?: number | null;
  paymentTerms?: string | null;
  description?: string | null;
  supplier?: string | null;
  invoiceDate?: string | null; // YYYY-MM-DD
  category?: string | null;
  categoryJustification?: string | null;
  lowConfidence?: boolean;
  ocrUsed?: boolean;
};

// ── Spend cube (agregação determinística) ────────────────────────────────

/** Entrada mínima do cube — uma invoice já extraída + normalizada + convertida. */
export type CubeInvoice = {
  supplier: string;
  supplierNormalized: string;
  category: string;
  country: string;
  currency: string;
  total: number | null; // valor na moeda original
  totalRef: number | null; // convertido pra moeda de referência (null = sem câmbio)
  poNumber: string | null; // ausente / "Sem PO" = sem PO
  invoiceDate: string | null; // YYYY-MM-DD
};

export type SpendBreakdown = {
  key: string;
  totalRef: number;
  pct: number; // 0-1, fração do totalRef
  count: number;
};

export type SpendCube = {
  referenceCurrency: string;
  totalRef: number;
  invoiceCount: number; // notas com câmbio resolvido (entram no totalRef)
  byCategory: SpendBreakdown[];
  bySupplier: SpendBreakdown[];
  byCountry: SpendBreakdown[];
  byMonth: { key: string; totalRef: number; count: number }[]; // key = YYYY-MM
  pareto: { key: string; totalRef: number; cumPct: number }[]; // fornecedores desc, cumulativo
  poCoveragePct: number; // % de notas com PO (sobre todas as notas)
  poSpendPct: number; // % do spend (ref) com PO
  tailSpend: { suppliersBeyond80Pct: number; tailSpendRef: number };
  ticketMedio: number; // totalRef / invoiceCount
  semCambio: { currency: string; total: number; count: number }[]; // notas sem conversão
};
