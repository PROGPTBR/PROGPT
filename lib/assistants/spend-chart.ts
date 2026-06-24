import { createCanvas } from '@napi-rs/canvas';
import type { SpendCube } from '@/lib/spend/types';

// Gráficos do Spend Analysis (@napi-rs/canvas, mesmo padrão de abc-chart):
//  - Pareto de fornecedores: barras (% individual) + linha cumulativa.
//  - Gasto por categoria: barras horizontais.

const BRAND = '#006874';
const BAR = '#1f4e79';

export type ChartSize = { width: number; height: number };
const DEFAULT: ChartSize = { width: 1100, height: 620 };

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

/** Pareto de fornecedores (top 15) — barras de share + linha cumulativa. */
export async function renderSpendParetoPng(
  cube: SpendCube,
  size: ChartSize = DEFAULT,
): Promise<Buffer> {
  const { width, height } = size;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const m = { top: 60, right: 60, bottom: 110, left: 80 };
  const plotW = width - m.left - m.right;
  const plotH = height - m.top - m.bottom;

  const top = cube.pareto.slice(0, 15);
  const total = cube.totalRef || 1;
  const n = top.length;

  // Eixos
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(m.left, m.top);
  ctx.lineTo(m.left, m.top + plotH);
  ctx.lineTo(m.left + plotW, m.top + plotH);
  ctx.stroke();

  // Gridlines Y (0..100%)
  ctx.font = '12px sans-serif';
  ctx.textBaseline = 'middle';
  for (let p = 0; p <= 1; p += 0.2) {
    const y = m.top + plotH - p * plotH;
    ctx.strokeStyle = '#eee';
    ctx.beginPath();
    ctx.moveTo(m.left, y);
    ctx.lineTo(m.left + plotW, y);
    ctx.stroke();
    ctx.fillStyle = '#666';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(p * 100)}%`, m.left - 8, y);
  }

  if (n > 0) {
    const slot = plotW / n;
    const barW = Math.min(slot * 0.6, 48);
    // Barras (share individual)
    top.forEach((s, i) => {
      const share = s.totalRef / total;
      const x = m.left + i * slot + (slot - barW) / 2;
      const h = share * plotH;
      ctx.fillStyle = BAR;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x, m.top + plotH - h, barW, h);
      ctx.globalAlpha = 1;
      // rótulo do fornecedor (rotacionado)
      ctx.save();
      ctx.translate(m.left + i * slot + slot / 2, m.top + plotH + 8);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#555';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(s.key.slice(0, 22), 0, 0);
      ctx.restore();
    });
    // Linha cumulativa
    ctx.strokeStyle = BRAND;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    top.forEach((s, i) => {
      const x = m.left + i * slot + slot / 2;
      const y = m.top + plotH - s.cumPct * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    top.forEach((s, i) => {
      const x = m.left + i * slot + slot / 2;
      const y = m.top + plotH - s.cumPct * plotH;
      ctx.fillStyle = BRAND;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Título
  ctx.fillStyle = '#1c1b1f';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(
    `Curva de Pareto — gasto por fornecedor (${cube.referenceCurrency} ${fmtBRL(cube.totalRef)})`,
    m.left,
    18,
  );

  return canvas.toBuffer('image/png');
}

/** Gasto por categoria — barras horizontais (top 10). */
export async function renderSpendByCategoryPng(
  cube: SpendCube,
  size: ChartSize = { width: 1000, height: 560 },
): Promise<Buffer> {
  const { width, height } = size;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const rows = cube.byCategory.slice(0, 10);
  const m = { top: 60, right: 120, bottom: 40, left: 240 };
  const plotW = width - m.left - m.right;
  const plotH = height - m.top - m.bottom;
  const max = rows.reduce((acc, r) => Math.max(acc, r.totalRef), 0) || 1;
  const rowH = rows.length > 0 ? plotH / rows.length : plotH;
  const barH = Math.min(rowH * 0.6, 36);

  ctx.fillStyle = '#1c1b1f';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('Gasto por categoria', m.left - 200, 18);

  rows.forEach((r, i) => {
    const y = m.top + i * rowH + (rowH - barH) / 2;
    const w = (r.totalRef / max) * plotW;
    ctx.fillStyle = BRAND;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(m.left, y, w, barH);
    ctx.globalAlpha = 1;
    // rótulo categoria
    ctx.fillStyle = '#333';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(r.key.slice(0, 32), m.left - 10, y + barH / 2);
    // valor
    ctx.textAlign = 'left';
    ctx.fillStyle = '#555';
    ctx.fillText(`${cube.referenceCurrency} ${fmtBRL(r.totalRef)}`, m.left + w + 8, y + barH / 2);
  });

  return canvas.toBuffer('image/png');
}
