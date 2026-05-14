import { createCanvas } from '@napi-rs/canvas';
import type { ClassifiedKraljicItem, KraljicQuadrant } from './types';

// Sub-projeto 27 — Bubble chart of the Kraljic matrix.
//
// Hand-drawn 2×2 with @napi-rs/canvas (no chartjs — see plan file for
// the dep-conflict rationale). X axis = supplyComplexity, Y = business
// impact, bubble radius scales with spendShare, quadrant colors match
// the four Kraljic quadrants.

const QUADRANT_COLORS: Record<KraljicQuadrant, string> = {
  estrategico: '#1f4e79', // navy
  alavancavel: '#2e7d32', // green
  gargalo: '#e65100', // orange
  'nao-critico': '#616161', // grey
};

const QUADRANT_BG: Record<KraljicQuadrant, string> = {
  estrategico: 'rgba(31, 78, 121, 0.06)',
  alavancavel: 'rgba(46, 125, 50, 0.06)',
  gargalo: 'rgba(230, 81, 0, 0.06)',
  'nao-critico': 'rgba(97, 97, 97, 0.06)',
};

export type ChartSize = { width: number; height: number };
const DEFAULT_SIZE: ChartSize = { width: 1100, height: 760 };

export async function renderKraljicChartPng(
  classified: ClassifiedKraljicItem[],
  size: ChartSize = DEFAULT_SIZE,
): Promise<Buffer> {
  const { width, height } = size;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Plot area margins
  const m = { top: 60, right: 40, bottom: 90, left: 90 };
  const plotW = width - m.left - m.right;
  const plotH = height - m.top - m.bottom;

  // Domain: axes go 1..4 with the quadrant cut at 2.5
  const xMin = 1;
  const xMax = 4;
  const yMin = 1;
  const yMax = 4;
  const x = (v: number) => m.left + ((v - xMin) / (xMax - xMin)) * plotW;
  const y = (v: number) => m.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  // Quadrant background fills (split at 2.5)
  const cx = x(2.5);
  const cy = y(2.5);

  // Top-left = Alavancável (high impact / low complex)
  ctx.fillStyle = QUADRANT_BG.alavancavel;
  ctx.fillRect(m.left, m.top, cx - m.left, cy - m.top);
  // Top-right = Estratégico
  ctx.fillStyle = QUADRANT_BG.estrategico;
  ctx.fillRect(cx, m.top, m.left + plotW - cx, cy - m.top);
  // Bottom-left = Não Crítico
  ctx.fillStyle = QUADRANT_BG['nao-critico'];
  ctx.fillRect(m.left, cy, cx - m.left, m.top + plotH - cy);
  // Bottom-right = Gargalo
  ctx.fillStyle = QUADRANT_BG.gargalo;
  ctx.fillRect(cx, cy, m.left + plotW - cx, m.top + plotH - cy);

  // Quadrant labels (top corners, faded)
  ctx.fillStyle = QUADRANT_COLORS.alavancavel;
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.globalAlpha = 0.6;
  ctx.fillText('Alavancável', m.left + 12, m.top + 10);
  ctx.fillStyle = QUADRANT_COLORS.estrategico;
  ctx.textAlign = 'right';
  ctx.fillText('Estratégico', m.left + plotW - 12, m.top + 10);
  ctx.fillStyle = QUADRANT_COLORS['nao-critico'];
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('Não Crítico', m.left + 12, m.top + plotH - 10);
  ctx.fillStyle = QUADRANT_COLORS.gargalo;
  ctx.textAlign = 'right';
  ctx.fillText('Gargalo', m.left + plotW - 12, m.top + plotH - 10);
  ctx.globalAlpha = 1;

  // Plot frame
  ctx.strokeStyle = '#bdbdbd';
  ctx.lineWidth = 1;
  ctx.strokeRect(m.left, m.top, plotW, plotH);

  // Quadrant divider lines at 2.5
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = '#9e9e9e';
  ctx.beginPath();
  ctx.moveTo(cx, m.top);
  ctx.lineTo(cx, m.top + plotH);
  ctx.moveTo(m.left, cy);
  ctx.lineTo(m.left + plotW, cy);
  ctx.stroke();
  ctx.setLineDash([]);

  // Axis ticks (1..4)
  ctx.fillStyle = '#424242';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let v = xMin; v <= xMax; v++) {
    ctx.fillText(String(v), x(v), m.top + plotH + 6);
  }
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let v = yMin; v <= yMax; v++) {
    ctx.fillText(String(v), m.left - 8, y(v));
  }

  // Axis titles
  ctx.fillStyle = '#212121';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('Complexidade do Mercado Fornecedor →', m.left + plotW / 2, m.top + plotH + 36);
  ctx.save();
  ctx.translate(m.left - 56, m.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText('Impacto no Negócio →', 0, 0);
  ctx.restore();

  // Chart title
  ctx.fillStyle = '#1a1a1a';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('Matriz de Kraljic', width / 2, 18);

  // Bubble radius scaling — min 8 px, max 36 px, sqrt scale on share
  const minR = 8;
  const maxR = 36;
  const shares = classified.map((c) => c.spendShare);
  const maxShare = Math.max(0.001, ...shares);
  const bubbleRadius = (share: number) =>
    minR + (maxR - minR) * Math.sqrt(Math.max(0, share) / maxShare);

  // Draw bubbles
  for (const item of classified) {
    const px = x(Math.max(xMin, Math.min(xMax, item.supplyComplexity)));
    const py = y(Math.max(yMin, Math.min(yMax, item.businessImpact)));
    const r = bubbleRadius(item.spendShare);
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = QUADRANT_COLORS[item.quadrant];
    ctx.globalAlpha = 0.65;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = QUADRANT_COLORS[item.quadrant];
    ctx.stroke();
  }

  // Labels — drawn after all bubbles so they sit on top. Truncate to 22 chars.
  ctx.fillStyle = '#1a1a1a';
  ctx.font = '11px sans-serif';
  ctx.textBaseline = 'middle';
  for (const item of classified) {
    const px = x(Math.max(xMin, Math.min(xMax, item.supplyComplexity)));
    const py = y(Math.max(yMin, Math.min(yMax, item.businessImpact)));
    const r = bubbleRadius(item.spendShare);
    const label = item.name.length > 22 ? item.name.slice(0, 22) + '…' : item.name;
    // Place label to the right of the bubble; flip to left if overflowing.
    const wouldOverflow = px + r + 4 + ctx.measureText(label).width > m.left + plotW;
    ctx.textAlign = wouldOverflow ? 'right' : 'left';
    const labelX = wouldOverflow ? px - r - 4 : px + r + 4;
    ctx.fillText(label, labelX, py);
  }

  return canvas.toBuffer('image/png');
}
