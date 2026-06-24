import type { SpendCube } from './types';
import type { SpendAnalysisParams } from '@/lib/assistants/types';
import type { StatusCounts } from './db';

// Resumo determinístico (sem LLM) do spend cube em Markdown. É o output da
// fase 2; a fase 3 substitui por uma narrativa de strategic sourcing via LLM,
// reusando este mesmo cube.

function money(v: number, ccy: string): string {
  try {
    return v.toLocaleString('pt-BR', {
      style: 'currency',
      currency: ccy,
      maximumFractionDigits: 0,
    });
  } catch {
    return `${ccy} ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
  }
}

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function breakdownTable(
  rows: { key: string; totalRef: number; pct: number; count: number }[],
  ref: string,
  topN = 10,
): string {
  const head = '| # | Item | Gasto | % | Notas |\n|---|---|--:|--:|--:|';
  const body = rows
    .slice(0, topN)
    .map((r, i) => `| ${i + 1} | ${r.key} | ${money(r.totalRef, ref)} | ${pct(r.pct)} | ${r.count} |`)
    .join('\n');
  return rows.length === 0 ? '_(sem dados)_' : `${head}\n${body}`;
}

export function buildCubeSummaryMd(
  cube: SpendCube,
  params: SpendAnalysisParams,
  counts: StatusCounts,
): string {
  const ref = cube.referenceCurrency;
  const lines: string[] = [];

  lines.push(`# ${params.analysisName}`);
  if (params.period) lines.push(`_Período: ${params.period}_`);
  lines.push('');

  // ── Sumário executivo ──
  const topSupplier = cube.bySupplier[0];
  const concentracao =
    cube.tailSpend.suppliersBeyond80Pct > 0 && cube.bySupplier.length > 0
      ? `${cube.bySupplier.length - cube.tailSpend.suppliersBeyond80Pct} fornecedor(es) concentram ~80% do gasto; ${cube.tailSpend.suppliersBeyond80Pct} formam a cauda longa`
      : 'gasto distribuído entre poucos fornecedores';
  lines.push('## Sumário executivo');
  lines.push(
    `Gasto total de **${money(cube.totalRef, ref)}** em **${cube.invoiceCount}** notas. ${concentracao}.` +
      (topSupplier
        ? ` Maior fornecedor: **${topSupplier.key}** (${pct(topSupplier.pct)} do gasto).`
        : ''),
  );
  lines.push(
    `Cobertura de PO: **${pct(cube.poCoveragePct)}** das notas e **${pct(cube.poSpendPct)}** do gasto têm pedido de compra.`,
  );
  lines.push('');

  // ── KPIs ──
  lines.push('## Indicadores');
  lines.push('| Indicador | Valor |\n|---|--:|');
  lines.push(`| Gasto total (${ref}) | ${money(cube.totalRef, ref)} |`);
  lines.push(`| Nº de invoices | ${cube.invoiceCount} |`);
  lines.push(`| Nº de fornecedores | ${cube.bySupplier.length} |`);
  lines.push(`| Ticket médio | ${money(cube.ticketMedio, ref)} |`);
  lines.push(`| Invoices com PO | ${pct(cube.poCoveragePct)} |`);
  lines.push(`| Gasto com PO | ${pct(cube.poSpendPct)} |`);
  lines.push(
    `| Tail spend | ${money(cube.tailSpend.tailSpendRef, ref)} (${cube.tailSpend.suppliersBeyond80Pct} fornecedores) |`,
  );
  lines.push('');

  // ── Dimensões ──
  lines.push('## Gasto por categoria');
  lines.push(breakdownTable(cube.byCategory, ref));
  lines.push('');
  lines.push('## Top fornecedores');
  lines.push(breakdownTable(cube.bySupplier, ref));
  lines.push('');
  if (cube.byCountry.length > 1) {
    lines.push('## Gasto por país');
    lines.push(breakdownTable(cube.byCountry, ref));
    lines.push('');
  }

  // ── Ressalvas ──
  const ressalvas: string[] = [];
  if (cube.semCambio.length > 0) {
    const desc = cube.semCambio
      .map((s) => `${s.count} nota(s) em ${s.currency}`)
      .join(', ');
    ressalvas.push(
      `Notas sem conversão cambial (reportadas à parte, fora do total em ${ref}): ${desc}.`,
    );
  }
  if (counts.needs_review > 0) {
    ressalvas.push(
      `${counts.needs_review} nota(s) marcada(s) para revisão (baixa certeza, sem PO, duplicada ou sem nº de invoice).`,
    );
  }
  if (counts.error > 0) {
    ressalvas.push(`${counts.error} arquivo(s) não puderam ser lidos (erro de extração).`);
  }
  if (ressalvas.length > 0) {
    lines.push('## Ressalvas');
    for (const r of ressalvas) lines.push(`- ${r}`);
    lines.push('');
  }

  return lines.join('\n').trim();
}
