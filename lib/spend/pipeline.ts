import { getServerSupabase } from '@/lib/db/supabase';
import { updateRunOutput, failRun } from '@/lib/assistants/runs';
import type { AssistantRunRow, SpendAnalysisParams } from '@/lib/assistants/types';
import { downloadFromSpendBucket } from '@/lib/db/spend-storage';
import { retrieve } from '@/lib/rag/retriever';
import { rerank } from '@/lib/rag/reranker';
import { getUserCompany } from '@/lib/db/user-company';
import { extractInvoiceFromPdf } from './invoice-extract';
import { classifyCategories } from './classify';
import { normalizeSupplier, dedupeInvoices } from './normalize';
import { buildFxResolver } from './fx';
import { buildCubeFromRows, isUsableRow as isUsable } from './from-rows';
import { buildCubeSummaryMd } from './summary';
import { buildSpendNarrativePrompt, generateSpendNarrative } from './narrative';
import { mapWithConcurrency } from './concurrency';
import {
  listInvoicesByRun,
  applyExtractedFields,
  updateInvoice,
  statusCountsForRun,
} from './db';

// Worker assíncrono do Spend Analysis (fire-and-forget, processo long-lived do
// Railway). Espelha lib/ingest/pipeline.ts, mas escreve em spend_invoices +
// assistant_runs. Heartbeat = updated_at das linhas de spend_invoices (cada
// update carimba); o status endpoint usa esse máximo p/ detectar staleness —
// assistant_runs não tem coluna de progresso (derivada das contagens).

const EXTRACT_CONCURRENCY = 5;
const NARRATIVE_RAG_QUERY =
  'strategic sourcing tail spend maverick spend cobertura de PO consolidação de fornecedores contrato guarda-chuva';

export async function runSpendPipeline(runId: string): Promise<void> {
  const sb = getServerSupabase();
  try {
    // ── Carrega o run + as notas ──
    const { data: runData } = await sb
      .from('assistant_runs')
      .select('*')
      .eq('id', runId)
      .maybeSingle();
    const run = runData as AssistantRunRow | null;
    if (!run) {
      console.warn(`[spend/pipeline] run ${runId} not found`);
      return;
    }
    const params = run.params as SpendAnalysisParams;
    const rows = await listInvoicesByRun(runId);
    if (rows.length === 0) {
      await failRun(runId, 'Nenhuma invoice enviada para análise.');
      return;
    }

    // ── 1. Extração dos PDFs pendentes (concorrência limitada) ──
    const pending = rows.filter((r) => r.source === 'pdf' && r.status === 'pending');
    await mapWithConcurrency(pending, EXTRACT_CONCURRENCY, async (row) => {
      if (!row.storage_path) {
        await updateInvoice(row.id, { status: 'error', error_message: 'sem arquivo' });
        Object.assign(row, { status: 'error' });
        return;
      }
      await updateInvoice(row.id, { status: 'extracting' });
      try {
        const buf = await downloadFromSpendBucket(row.storage_path);
        const fields = await extractInvoiceFromPdf({ buf, filename: row.filename });
        const status = fields.lowConfidence ? 'needs_review' : 'done';
        await applyExtractedFields(row.id, fields, status);
        Object.assign(row, {
          status,
          invoice_number: fields.invoiceNumber ?? null,
          po_number: fields.poNumber ?? null,
          country: fields.country ?? null,
          currency: fields.currency ?? null,
          total: fields.total ?? null,
          payment_terms: fields.paymentTerms ?? null,
          description: fields.description ?? null,
          supplier: fields.supplier ?? null,
          invoice_date: fields.invoiceDate ?? null,
          category: fields.category ?? null,
          category_justification: fields.categoryJustification ?? null,
          low_confidence: fields.lowConfidence ?? false,
          ocr_used: fields.ocrUsed ?? false,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await updateInvoice(row.id, { status: 'error', error_message: msg.slice(0, 300) });
        Object.assign(row, { status: 'error', error_message: msg });
      }
    });

    // ── 2. Classificação das notas usáveis sem categoria ──
    const toClassify = rows
      .filter((r) => isUsable(r.status) && !(r.category && r.category.trim()))
      .map((r) => ({ id: r.id, description: r.description, supplier: r.supplier }));
    if (toClassify.length > 0) {
      const cats = await classifyCategories(toClassify);
      for (const r of rows) {
        const c = cats.get(r.id);
        if (c) {
          await updateInvoice(r.id, {
            category: c.category,
            category_justification: c.justification,
          });
          Object.assign(r, { category: c.category, category_justification: c.justification });
        } else if (isUsable(r.status) && !(r.category && r.category.trim())) {
          await updateInvoice(r.id, { category: 'Outros' });
          Object.assign(r, { category: 'Outros' });
        }
      }
    }

    // ── 3. Normalização de fornecedor + dedup ──
    for (const r of rows) {
      if (!isUsable(r.status)) continue;
      const norm = normalizeSupplier(r.supplier);
      if (norm !== (r.supplier_normalized ?? '')) {
        await updateInvoice(r.id, { supplier_normalized: norm });
      }
      Object.assign(r, { supplier_normalized: norm });
    }
    const { duplicateIds, ambiguousIds } = dedupeInvoices(
      rows
        .filter((r) => isUsable(r.status))
        .map((r) => ({
          id: r.id,
          invoiceNumber: r.invoice_number,
          supplierNormalized: r.supplier_normalized ?? '',
        })),
    );
    for (const r of rows) {
      if (duplicateIds.has(r.id)) {
        await updateInvoice(r.id, {
          status: 'needs_review',
          error_message: 'invoice duplicada (mesmo nº + fornecedor)',
        });
        Object.assign(r, { status: 'needs_review' });
      } else if (ambiguousIds.has(r.id) && r.status === 'done') {
        await updateInvoice(r.id, { status: 'needs_review' });
        Object.assign(r, { status: 'needs_review' });
      }
    }

    // ── 4. Conversão cambial (FX) ──
    const usable = rows.filter((r) => isUsable(r.status));
    const fx = await buildFxResolver(
      params,
      usable.map((r) => ({ currency: r.currency, invoiceDate: r.invoice_date })),
    );
    for (const r of usable) {
      const { totalRef, fxRate } = fx({
        total: r.total,
        currency: r.currency,
        date: r.invoice_date,
      });
      const lowConf = r.low_confidence || (r.total != null && totalRef == null);
      await updateInvoice(r.id, {
        total_ref: totalRef,
        fx_rate: fxRate,
        low_confidence: lowConf,
      });
      Object.assign(r, { total_ref: totalRef, fx_rate: fxRate, low_confidence: lowConf });
    }

    // ── 5. Agregação (cube) — exclui duplicadas (mesma regra do export) ──
    const ref = (params.referenceCurrency ?? 'BRL').toUpperCase();
    const cube = buildCubeFromRows(rows, ref);

    // ── 6. Resumo determinístico (KPIs/tabelas) ──
    const counts = await statusCountsForRun(runId);
    const summaryMd = buildCubeSummaryMd(cube, params, counts);

    // ── 7. Narrativa LLM de strategic sourcing (fail-soft) ──
    let narrativeMd = '';
    try {
      const candidates = await retrieve(NARRATIVE_RAG_QUERY);
      const chunks = await rerank(NARRATIVE_RAG_QUERY, candidates, 6);
      const company = await getUserCompany(run.user_id);
      const topInvoices = rows
        .filter((r) => isUsable(r.status) && !duplicateIds.has(r.id) && r.total_ref != null)
        .sort((a, b) => (b.total_ref ?? 0) - (a.total_ref ?? 0))
        .slice(0, 15);
      const prompt = buildSpendNarrativePrompt({ cube, topInvoices, params, chunks, company });
      narrativeMd = await generateSpendNarrative(prompt, run.user_id);
    } catch (err) {
      console.warn('[spend/pipeline] narrative failed (fail-soft):', err);
    }

    const finalMd = narrativeMd ? `${summaryMd}\n\n---\n\n${narrativeMd}` : summaryMd;
    await updateRunOutput(runId, finalMd);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[spend/pipeline] run ${runId} failed:`, msg);
    await failRun(runId, msg);
  }
}
