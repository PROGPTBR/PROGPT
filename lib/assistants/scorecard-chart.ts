import { createCanvas } from '@napi-rs/canvas';
import type { ClassifiedSupplier, ScorecardBand } from './types';
import { SCORECARD_DEFAULT_THRESHOLDS, SCORECARD_BAND_LABELS } from './types';

// Sub-projeto (scorecard Task 3) — Horizontal bar ranking chart.
//
// One row per supplier, sorted by rank asc (classified array is pre-sorted).
// Width is fixed at 900 px; height scales with supplier count.
// Band colors mirror the Kraljic quadrant palette convention.

const BAND_COLORS: Record<ScorecardBand, string> = {
  estrategico: '#1f4e79',    // navy
  desenvolvimento: '#2e7d32', // green
  saida: '#e65100',           // orange
};

// Transparent fills for the threshold zone backgrounds.
const BAND_BG: Record<ScorecardBand, string> = {
  estrategico: 'rgba(31, 78, 121, 0.06)',
  desenvolvimento: 'rgba(46, 125, 50, 0.06)',
  saida: 'rgba(230, 81, 0, 0.06)',
};

const WIDTH = 900;
const LEFT_MARGIN = 220; // reserved for supplier name labels
const RIGHT_MARGIN = 20;
const TOP_MARGIN = 70;    // title + axis area
const BOTTOM_MARGIN = 50; // x-axis ticks + labels
const ROW_H = 42;
const MIN_HEIGHT = 300;

export async function renderScorecardChartPng(
  classified: ClassifiedSupplier[],
  thresholds: { strategic: number; development: number } = SCORECARD_DEFAULT_THRESHOLDS,
): Promise<Buffer> {
  const rowCount = Math.max(1, classified.length);
  const height = Math.max(MIN_HEIGHT, TOP_MARGIN + BOTTOM_MARGIN + rowCount * ROW_H);
  const canvas = createCanvas(WIDTH, height);
  const ctx = canvas.getContext('2d');

  // ── Background ───────────────────────────────────────────────────────────
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, WIDTH, height);

  // ── Plot geometry ────────────────────────────────────────────────────────
  const plotX = LEFT_MARGIN;
  const plotW = WIDTH - LEFT_MARGIN - RIGHT_MARGIN;
  const plotY = TOP_MARGIN;
  const plotH = height - TOP_MARGIN - BOTTOM_MARGIN;

  // Map a score (0-100) to an x coordinate within the plot area.
  const toX = (score: number) => plotX + (Math.max(0, Math.min(100, score)) / 100) * plotW;

  // ── Threshold zone backgrounds ───────────────────────────────────────────
  // saida zone: 0 .. development
  ctx.fillStyle = BAND_BG.saida;
  ctx.fillRect(plotX, plotY, toX(thresholds.development) - plotX, plotH);
  // desenvolvimento zone: development .. strategic
  ctx.fillStyle = BAND_BG.desenvolvimento;
  ctx.fillRect(
    toX(thresholds.development),
    plotY,
    toX(thresholds.strategic) - toX(thresholds.development),
    plotH,
  );
  // estrategico zone: strategic .. 100
  ctx.fillStyle = BAND_BG.estrategico;
  ctx.fillRect(toX(thresholds.strategic), plotY, toX(100) - toX(thresholds.strategic), plotH);

  // ── Plot border ──────────────────────────────────────────────────────────
  ctx.strokeStyle = '#bdbdbd';
  ctx.lineWidth = 1;
  ctx.strokeRect(plotX, plotY, plotW, plotH);

  // ── X-axis tick lines at 0 / 25 / 50 / 75 / 100 ────────────────────────
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  for (const tick of [0, 25, 50, 75, 100]) {
    const tx = toX(tick);
    ctx.beginPath();
    ctx.moveTo(tx, plotY);
    ctx.lineTo(tx, plotY + plotH);
    ctx.stroke();
  }

  // ── Threshold dashed vertical lines ─────────────────────────────────────
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 1.5;
  for (const [value, color] of [
    [thresholds.development, BAND_COLORS.desenvolvimento],
    [thresholds.strategic, BAND_COLORS.estrategico],
  ] as [number, string][]) {
    const tx = toX(value);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(tx, plotY);
    ctx.lineTo(tx, plotY + plotH);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // ── Supplier bars ────────────────────────────────────────────────────────
  const barH = Math.min(26, ROW_H - 10);
  const barOffsetY = (ROW_H - barH) / 2;

  for (let i = 0; i < classified.length; i++) {
    const s = classified[i]!;
    const rowY = plotY + i * ROW_H;
    const barY = rowY + barOffsetY;
    const barW = Math.max(2, (s.weightedScore / 100) * plotW);

    // Bar fill
    ctx.fillStyle = BAND_COLORS[s.band];
    ctx.globalAlpha = 0.85;
    ctx.fillRect(plotX, barY, barW, barH);
    ctx.globalAlpha = 1;

    // Bar border (same color, fully opaque)
    ctx.strokeStyle = BAND_COLORS[s.band];
    ctx.lineWidth = 1;
    ctx.strokeRect(plotX, barY, barW, barH);

    // Supplier name label (left of bar, right-aligned)
    const label = s.name.length > 26 ? s.name.slice(0, 26) + '…' : s.name;
    ctx.fillStyle = '#212121';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, plotX - 8, rowY + ROW_H / 2);

    // Optional segment label (smaller, below name, only if non-empty)
    if (s.segment) {
      const segLabel = s.segment.length > 26 ? s.segment.slice(0, 26) + '…' : s.segment;
      ctx.fillStyle = '#757575';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(segLabel, plotX - 8, rowY + ROW_H / 2 + 12);
    }

    // Score + band label at the end of the bar (or just inside if overflowing)
    const scoreLabel = `${s.weightedScore.toFixed(1)} · ${SCORECARD_BAND_LABELS[s.band]}`;
    ctx.font = '11px sans-serif';
    ctx.textBaseline = 'middle';
    const textW = ctx.measureText(scoreLabel).width;
    const labelX = plotX + barW + 6;
    const wouldOverflow = labelX + textW > WIDTH - 4;
    ctx.fillStyle = wouldOverflow ? '#ffffff' : '#424242';
    ctx.textAlign = 'left';
    const finalLabelX = wouldOverflow ? plotX + barW - textW - 6 : labelX;
    ctx.fillText(scoreLabel, finalLabelX, rowY + ROW_H / 2);
  }

  // ── X-axis tick labels ───────────────────────────────────────────────────
  ctx.fillStyle = '#616161';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const tick of [0, 25, 50, 75, 100]) {
    ctx.fillText(String(tick), toX(tick), plotY + plotH + 6);
  }

  // ── Threshold tick labels (development / strategic values) ───────────────
  for (const [value, color] of [
    [thresholds.development, BAND_COLORS.desenvolvimento],
    [thresholds.strategic, BAND_COLORS.estrategico],
  ] as [number, string][]) {
    ctx.fillStyle = color;
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(String(value), toX(value), plotY + plotH + 20);
  }

  // ── Chart title ──────────────────────────────────────────────────────────
  ctx.fillStyle = '#1a1a1a';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('Scorecard de Fornecedores', WIDTH / 2, 14);

  // ── X-axis label ─────────────────────────────────────────────────────────
  ctx.fillStyle = '#424242';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('Score Ponderado (0 – 100)', plotX + plotW / 2, plotY - 22);

  return canvas.toBuffer('image/png');
}
