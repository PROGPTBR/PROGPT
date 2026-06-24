import { getServerSupabase } from '@/lib/db/supabase';
import type { SpendInvoiceFields, SpendInvoiceRow, SpendInvoiceStatus } from './types';

// CRUD service-role da tabela spend_invoices. O pipeline (worker) e as rotas
// owner-gated usam estes helpers; a RLS owner-only é defesa-em-profundidade.

const TABLE = 'spend_invoices';

/** Mapeia os campos camelCase extraídos para as colunas snake_case do DB. */
function fieldsToColumns(f: SpendInvoiceFields): Record<string, unknown> {
  return {
    invoice_number: f.invoiceNumber ?? null,
    po_number: f.poNumber ?? null,
    country: f.country ?? null,
    currency: f.currency ?? null,
    total: f.total ?? null,
    payment_terms: f.paymentTerms ?? null,
    description: f.description ?? null,
    supplier: f.supplier ?? null,
    invoice_date: f.invoiceDate ?? null,
    category: f.category ?? null,
    category_justification: f.categoryJustification ?? null,
    low_confidence: f.lowConfidence ?? false,
    ocr_used: f.ocrUsed ?? false,
  };
}

/** Insere uma linha de invoice PDF (status pending; storage_path setado). */
export async function insertPdfInvoice(input: {
  runId: string;
  userId: string;
  storagePath: string;
  filename: string;
}): Promise<SpendInvoiceRow | null> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from(TABLE)
    .insert({
      run_id: input.runId,
      user_id: input.userId,
      storage_path: input.storagePath,
      filename: input.filename,
      source: 'pdf',
      status: 'pending',
    })
    .select('*')
    .single();
  if (error) {
    console.warn('[spend/db] insertPdfInvoice failed:', error.message);
    return null;
  }
  return data as SpendInvoiceRow;
}

/** Insere em lote as linhas vindas de planilha (status done; categoria pode
 *  estar null → o pipeline classifica). */
export async function insertSheetInvoices(input: {
  runId: string;
  userId: string;
  filename: string;
  rows: SpendInvoiceFields[];
}): Promise<number> {
  if (input.rows.length === 0) return 0;
  const sb = getServerSupabase();
  const payload = input.rows.map((f) => ({
    run_id: input.runId,
    user_id: input.userId,
    storage_path: null,
    filename: input.filename,
    source: 'sheet',
    status: 'done' as SpendInvoiceStatus,
    ...fieldsToColumns(f),
  }));
  const { error, count } = await sb.from(TABLE).insert(payload, { count: 'exact' });
  if (error) {
    console.warn('[spend/db] insertSheetInvoices failed:', error.message);
    return 0;
  }
  return count ?? payload.length;
}

export async function listInvoicesByRun(runId: string): Promise<SpendInvoiceRow[]> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from(TABLE)
    .select('*')
    .eq('run_id', runId)
    .order('created_at', { ascending: true });
  if (error) {
    console.warn('[spend/db] listInvoicesByRun failed:', error.message);
    return [];
  }
  return (data ?? []) as SpendInvoiceRow[];
}

export async function countInvoicesForRun(runId: string): Promise<number> {
  const sb = getServerSupabase();
  const { count, error } = await sb
    .from(TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('run_id', runId);
  if (error) return 0;
  return count ?? 0;
}

export type StatusCounts = {
  total: number;
  pending: number;
  extracting: number;
  done: number;
  needs_review: number;
  error: number;
};

export async function statusCountsForRun(runId: string): Promise<StatusCounts> {
  const sb = getServerSupabase();
  const { data, error } = await sb.from(TABLE).select('status').eq('run_id', runId);
  const counts: StatusCounts = {
    total: 0,
    pending: 0,
    extracting: 0,
    done: 0,
    needs_review: 0,
    error: 0,
  };
  if (error || !data) return counts;
  for (const r of data as { status: SpendInvoiceStatus }[]) {
    counts.total += 1;
    counts[r.status] += 1;
  }
  return counts;
}

/** Patch parcial de uma linha (sempre carimba updated_at). */
export async function updateInvoice(
  id: string,
  patch: Partial<Record<string, unknown>>,
): Promise<void> {
  const sb = getServerSupabase();
  const { error } = await sb
    .from(TABLE)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) console.warn('[spend/db] updateInvoice failed:', error.message);
}

/** Aplica os campos extraídos + status numa linha PDF. */
export async function applyExtractedFields(
  id: string,
  fields: SpendInvoiceFields,
  status: SpendInvoiceStatus,
): Promise<void> {
  await updateInvoice(id, { ...fieldsToColumns(fields), status });
}
