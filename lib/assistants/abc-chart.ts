import { createCanvas } from '@napi-rs/canvas';
import type { AbcAnalysis } from './types';

// Sub-projeto 31 — Curva ABC (Pareto): linha de % cumulativo do spend
// com regiões A/B/C coloridas.
//
// X = posição do item (1..N, ordenado por spend desc)
// Y = % cumulativo do spend (0..100)
//
// Linhas de referência horizontais em 80% e 95%; barra vertical no
// limite de A→B e B→C (calculado no momento do desenho).

const CLASS_COLORS = {
  A: { fill: 'rgba(31, 78, 121, 0.10)', stroke: '#1f4e79' }, // navy
  B: { fill: 'rgba(46, 125, 50, 0.10)', stroke: '#2e7d32' }, // green
  C: { fill: 'rgba(97, 97, 97, 0.08)', stroke: '#616161' }, // grey
} as const;

const CURVE_COLOR = '#006874'; // brand teal

export type AbcChartSize = { width: number; height: number };
const DEFAULT_SIZE: AbcChartSize = { width: 1100, height: 620 };

export async function renderAbcChartPng(
  analysis: AbcAnalysis,
  size: AbcChartSize = DEFAULT_SIZE,
): Promise<Buffer> {
  const { width, height } = size;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const m = { top: 60, right: 40, bottom: 80, left: 90 };
  const plotW = width - m.left - m.right;
  const plotH = height - m.top - m.bottom;

  const n = analysis.items.length;
  const xs = (i: number) =>
    m.left + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2);
  const ys = (pctCum: number) => m.top + plotH - pctCum * plotH;

  // Class region backgrounds — find boundaries by item rank.
  const lastA = analysis.items
    .filter((it) => it.abcClass === 'A')
    .at(-1)?.rank ?? 0;
  const lastB = analysis.items
    .filter((it) => it.abcClass === 'B')
    .at(-1)?.rank ?? lastA;

  // Class A region (left)
  if (lastA > 0) {
    ctx.fillStyle = CLASS_COLORS.A.fill;
    ctx.fillRect(m.left, m.top, xs(lastA - 1) - m.left, plotH);
  }
  // Class B region
  if (lastB > lastA) {
    ctx.fillStyle = CLASS_COLORS.B.fill;
    ctx.fillRect(xs(lastA - 1), m.top, xs(lastB - 1) - xs(lastA - 1), plotH);
  }
  // Class C region (rest)
  if (n > lastB) {
    ctx.fillStyle = CLASS_COLORS.C.fill;
    ctx.fillRect(xs(lastB - 1), m.top, m.left + plotW - xs(lastB - 1), plotH);
  }

  // Axes
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(m.left, m.top);
  ctx.lineTo(m.left, m.top + plotH);
  ctx.lineTo(m.left + plotW, m.top + plotH);
  ctx.stroke();

  // Y gridlines + labels (0%, 20%, 40%, 60%, 80%, 100%)
  ctx.strokeStyle = '#eaeaea';
  ctx.fillStyle = '#666';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let pct = 0; pct <= 1; pct += 0.2) {
    const y = ys(pct);
    ctx.beginPath();
    ctx.moveTo(m.left, y);
    ctx.lineTo(m.left + plotW, y);
    ctx.stroke();
    ctx.fillText(`${Math.round(pct * 100)}%`, m.left - 8, y);
  }
  // Reference lines at 80% and 95% (dashed)
  ctx.strokeStyle = '#bbb';
  ctx.setLineDash([6, 6]);
  for (const pct of [0.8, 0.95]) {
    const y = ys(pct);
    ctx.beginPath();
    ctx.moveTo(m.left, y);
    ctx.lineTo(m.left + plotW, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // X axis ticks (start/end + class boundaries)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#666';
  const ticks = [1];
  if (lastA > 1) ticks.push(lastA);
  if (lastB > lastA) ticks.push(lastB);
  if (n > lastB) ticks.push(n);
  for (const t of ticks) {
    const x = xs(t - 1);
    ctx.beginPath();
    ctx.strokeStyle = '#444';
    ctx.moveTo(x, m.top + plotH);
    ctx.lineTo(x, m.top + plotH + 5);
    ctx.stroke();
    ctx.fillText(String(t), x, m.top + plotH + 9);
  }

  // Curve
  ctx.strokeStyle = CURVE_COLOR;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  analysis.items.forEach((it, i) => {
    const x = xs(i);
    const y = ys(it.cumulativeShare);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Class labels at the top of each region
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 16px sans-serif';
  if (lastA > 0) {
    ctx.fillStyle = CLASS_COLORS.A.stroke;
    ctx.fillText(
      `Classe A · ${analysis.byClass.A.count} itens`,
      (m.left + xs(Math.max(lastA - 1, 0))) / 2 + xs(0) / 2,
      m.top + 16,
    );
  }
  if (lastB > lastA) {
    ctx.fillStyle = CLASS_COLORS.B.stroke;
    ctx.fillText(
      `Classe B · ${analysis.byClass.B.count} itens`,
      (xs(lastA - 1) + xs(lastB - 1)) / 2,
      m.top + 16,
    );
  }
  if (n > lastB) {
    ctx.fillStyle = CLASS_COLORS.C.stroke;
    ctx.fillText(
      `Classe C · ${analysis.byClass.C.count} itens`,
      (xs(lastB - 1) + xs(n - 1)) / 2,
      m.top + 16,
    );
  }

  // Title + axis labels
  ctx.fillStyle = '#1c1b1f';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('Curva ABC — spend cumulativo por item', m.left, 18);

  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#555';
  ctx.textAlign = 'center';
  ctx.fillText(
    'Itens ordenados por spend (descendente)',
    m.left + plotW / 2,
    height - 28,
  );

  ctx.save();
  ctx.translate(22, m.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#555';
  ctx.fillText('% cumulativo do spend', 0, 0);
  ctx.restore();

  return canvas.toBuffer('image/png');
}
