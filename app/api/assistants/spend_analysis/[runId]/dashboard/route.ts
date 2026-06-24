import { getCurrentUser } from '@/lib/auth';
import { getRunForOwner } from '@/lib/assistants/runs';
import { listInvoicesByRun } from '@/lib/spend/db';
import { survivingRows } from '@/lib/spend/from-rows';
import type { SpendAnalysisParams } from '@/lib/assistants/types';

// GET /api/assistants/spend_analysis/[runId]/dashboard — owner-gated. Devolve a
// config da análise + as notas que entram nos totais (usáveis, sem duplicatas),
// num formato compacto. O dashboard interativo recomputa os KPIs/painéis
// client-side ao filtrar (reusa lib/spend/cube no browser — é puro).

export type DashboardRow = {
  id: string;
  invoiceNumber: string | null;
  poNumber: string | null;
  supplier: string;
  supplierNormalized: string;
  category: string;
  country: string;
  currency: string;
  total: number | null;
  totalRef: number | null;
  paymentTerms: string | null;
  invoiceDate: string | null;
  status: string;
  lowConfidence: boolean;
};

export async function GET(
  _req: Request,
  { params }: { params: { runId: string } },
): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const run = await getRunForOwner(params.runId, user.id);
  if (!run || run.assistant_type !== 'spend_analysis') {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }
  if (run.status !== 'done') {
    return Response.json({ error: 'not_ready', status: run.status }, { status: 409 });
  }

  const sp = run.params as SpendAnalysisParams;
  const all = await listInvoicesByRun(params.runId);
  const rows: DashboardRow[] = survivingRows(all).map((r) => ({
    id: r.id,
    invoiceNumber: r.invoice_number,
    poNumber: r.po_number,
    supplier: r.supplier ?? '',
    supplierNormalized: r.supplier_normalized ?? '',
    category: r.category || 'Outros',
    country: r.country ?? '',
    currency: r.currency ?? '',
    total: r.total,
    totalRef: r.total_ref,
    paymentTerms: r.payment_terms,
    invoiceDate: r.invoice_date,
    status: r.status,
    lowConfidence: r.low_confidence,
  }));

  return Response.json({
    analysisName: sp.analysisName,
    period: sp.period ?? '',
    referenceCurrency: (sp.referenceCurrency ?? 'BRL').toUpperCase(),
    rows,
  });
}
