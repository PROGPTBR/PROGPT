import { createCanvas } from '@napi-rs/canvas';
import type { QuickChartSeries, QuickChartSpec } from './types';

// "Gráfico Rápido" (/assistants/graficos) — render genérico de barra/linha/
// pizza a partir de dado LIVRE do usuário. Ao contrário dos outros
// *-chart.ts (que sempre recebem a mesma shape de análise), este renderer
// não conhece o domínio do dado — só {labels, values} + o tipo escolhido.

type Ctx = ReturnType<ReturnType<typeof createCanvas>['getContext']>;

const PALETTE = [
  '#1f4e79', '#006874', '#2e7d32', '#b8860b', '#8e24aa',
  '#c62828', '#00838f', '#6d4c41', '#616161', '#3949ab',
  '#00695c', '#ad1457', '#4527a0', '#e65100', '#37474f',
  '#558b2f', '#0277bd', '#d84315', '#5d4037', '#455a64',
];

export type QuickChartSize = { width: number; height: number };
const DEFAULT_SIZE: QuickChartSize = { width: 1100, height: 620 };

function fmtNumber(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

function truncateLabel(label: string, max = 18): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

function drawTitle(ctx: Ctx, title: string): void {
  ctx.fillStyle = '#1c1b1f';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(title || 'Gráfico', 40, 18);
}

function renderBarOrLine(ctx: Ctx, series: QuickChartSeries, width: number, height: number, kind: 'bar' | 'line'): void {
  const m = { top: 70, right: 40, bottom: 110, left: 90 };
  const plotW = width - m.left - m.right;
  const plotH = height - m.top - m.bottom;
  const n = series.labels.length;
  if (n === 0) return;

  const minV = Math.min(0, ...series.values);
  const maxV = Math.max(0, ...series.values, minV + 0.0001);
  const range = maxV - minV || 1;
  const yFor = (v: number) => m.top + plotH - ((v - minV) / range) * plotH;
  const zeroY = yFor(0);

  // Axes
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(m.left, m.top);
  ctx.lineTo(m.left, m.top + plotH);
  ctx.lineTo(m.left + plotW, m.top + plotH);
  ctx.stroke();

  // Gridlines + Y labels (5 faixas)
  ctx.strokeStyle = '#eaeaea';
  ctx.fillStyle = '#666';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 5; i++) {
    const v = minV + (range / 5) * i;
    const y = yFor(v);
    ctx.beginPath();
    ctx.moveTo(m.left, y);
    ctx.lineTo(m.left + plotW, y);
    ctx.stroke();
    ctx.fillText(fmtNumber(v), m.left - 8, y);
  }

  const slotW = plotW / n;
  const xFor = (i: number) => m.left + slotW * (i + 0.5);

  if (kind === 'bar') {
    series.values.forEach((v, i) => {
      const x = m.left + i * slotW + slotW * 0.15;
      const w = slotW * 0.7;
      const y1 = yFor(v);
      const y2 = zeroY;
      const top = Math.min(y1, y2);
      const h = Math.abs(y2 - y1);
      ctx.fillStyle = PALETTE[i % PALETTE.length]!;
      ctx.fillRect(x, top, w, Math.max(h, 1));

      ctx.fillStyle = '#333';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = v >= 0 ? 'bottom' : 'top';
      ctx.fillText(fmtNumber(v), x + w / 2, v >= 0 ? top - 4 : top + h + 4);
    });
  } else {
    ctx.strokeStyle = '#006874';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    series.values.forEach((v, i) => {
      const x = xFor(i);
      const y = yFor(v);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    series.values.forEach((v, i) => {
      const x = xFor(i);
      const y = yFor(v);
      ctx.fillStyle = '#006874';
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Category labels (rotacionados se apertado)
  const rotate = n > 8;
  ctx.fillStyle = '#444';
  ctx.font = '11px sans-serif';
  series.labels.forEach((label, i) => {
    const x = kind === 'bar' ? m.left + i * slotW + slotW / 2 : xFor(i);
    ctx.save();
    ctx.translate(x, m.top + plotH + 8);
    if (rotate) {
      ctx.rotate(Math.PI / 4);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
    } else {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
    }
    ctx.fillText(truncateLabel(label), 0, 0);
    ctx.restore();
  });
}

function renderPie(ctx: Ctx, series: QuickChartSeries, width: number, height: number): void {
  const cx = width * 0.36;
  const cy = height / 2 + 15;
  const r = Math.min(width * 0.55, height - 140) * 0.42;
  const total = series.values.reduce((s, v) => s + v, 0) || 1;

  let angle = -Math.PI / 2;
  series.values.forEach((v, i) => {
    const slice = (v / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.fillStyle = PALETTE[i % PALETTE.length]!;
    ctx.arc(cx, cy, r, angle, angle + slice);
    ctx.closePath();
    ctx.fill();
    angle += slice;
  });

  const legendX = width * 0.66;
  let legendY = 90;
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  series.labels.forEach((label, i) => {
    if (legendY > height - 30) return; // evita estourar o canvas com legenda longa
    ctx.fillStyle = PALETTE[i % PALETTE.length]!;
    ctx.fillRect(legendX, legendY - 6, 12, 12);
    ctx.fillStyle = '#333';
    const pct = ((series.values[i]! / total) * 100).toFixed(1);
    ctx.fillText(`${truncateLabel(label, 28)} — ${pct}%`, legendX + 18, legendY);
    legendY += 20;
  });
}

export async function renderQuickChartPng(
  series: QuickChartSeries,
  spec: QuickChartSpec,
  size: QuickChartSize = DEFAULT_SIZE,
): Promise<Buffer> {
  const { width, height } = size;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  drawTitle(ctx, spec.title);

  if (spec.chartType === 'pie') renderPie(ctx, series, width, height);
  else renderBarOrLine(ctx, series, width, height, spec.chartType);

  return canvas.toBuffer('image/png');
}
