import { createCanvas, type Canvas, type SKRSContext2D } from '@napi-rs/canvas';

// Gráficos do painel de carteira em PNG (mesma paleta do Dashboard do produto).

export const AZUL = '#0e8de1';
export const CIANO = '#0ed1e0';
const CINZA = '#64748b';
const GRADE = '#e2e8f0';
const PALETA = ['#0e8de1', '#0ed1e0', '#6366f1', '#f59e0b', '#22c55e', '#ec4899'];

function base(w: number, h: number): [SKRSContext2D, Canvas] {
  const canvas: Canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  return [ctx, canvas];
}

const num = (n: number, casas = 0) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

export function barras(dados: { nome: string; qtd: number }[]): Buffer {
  const LARG = 1000;
  const ALT_LINHA = 46;
  const TOPO = 20;
  const ESQ = 300;
  const h = TOPO * 2 + dados.length * ALT_LINHA;
  const [ctx, canvas] = base(LARG, h);
  const max = Math.max(...dados.map((d) => d.qtd), 1);

  dados.forEach((d, i) => {
    const y = TOPO + i * ALT_LINHA;
    ctx.fillStyle = '#334155';
    ctx.font = '19px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(d.nome.length > 26 ? d.nome.slice(0, 25) + '…' : d.nome, ESQ - 16, y + ALT_LINHA / 2);

    const larg = ((LARG - ESQ - 90) * d.qtd) / max;
    const grad = ctx.createLinearGradient(ESQ, 0, ESQ + larg, 0);
    grad.addColorStop(0, AZUL);
    grad.addColorStop(1, CIANO);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(ESQ, y + 9, Math.max(larg, 3), ALT_LINHA - 20, 6);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 19px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(num(d.qtd), ESQ + larg + 12, y + ALT_LINHA / 2);
  });
  return canvas.toBuffer('image/png');
}

export function rosca(dados: { nome: string; qtd: number }[]): Buffer {
  const [ctx, canvas] = base(1000, 420);
  const total = dados.reduce((a, b) => a + b.qtd, 0) || 1;
  const cx = 230;
  const cy = 210;
  const rExt = 150;
  const rInt = 92;

  let ang = -Math.PI / 2;
  dados.forEach((d, i) => {
    const fatia = (d.qtd / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, rExt, ang, ang + fatia);
    ctx.arc(cx, cy, rInt, ang + fatia, ang, true);
    ctx.closePath();
    ctx.fillStyle = PALETA[i % PALETA.length]!;
    ctx.fill();
    ang += fatia;
  });

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 40px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(num(total), cx, cy - 10);
  ctx.fillStyle = CINZA;
  ctx.font = '18px sans-serif';
  ctx.fillText('SCs', cx, cy + 26);

  ctx.textAlign = 'left';
  dados.forEach((d, i) => {
    const y = 110 + i * 54;
    ctx.fillStyle = PALETA[i % PALETA.length]!;
    ctx.beginPath();
    ctx.roundRect(470, y - 11, 22, 22, 5);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 21px sans-serif';
    ctx.fillText(d.nome, 506, y);
    ctx.fillStyle = CINZA;
    ctx.font = '19px sans-serif';
    ctx.fillText(`${num(d.qtd)} SCs · ${num((d.qtd / total) * 100, 1)}%`, 506, y + 24);
  });
  return canvas.toBuffer('image/png');
}

export function linha(dados: { mes: string; qtd: number }[]): Buffer {
  const LARG = 1000;
  const ALT = 420;
  const [ctx, canvas] = base(LARG, ALT);
  const ESQ = 80;
  const DIR = 40;
  const TOPO = 30;
  const BASE = ALT - 70;
  const max = Math.max(...dados.map((d) => d.qtd), 1);

  ctx.strokeStyle = GRADE;
  ctx.lineWidth = 1;
  ctx.fillStyle = CINZA;
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 4; i++) {
    const y = TOPO + ((BASE - TOPO) * i) / 4;
    ctx.beginPath();
    ctx.moveTo(ESQ, y);
    ctx.lineTo(LARG - DIR, y);
    ctx.stroke();
    ctx.fillText(num((max * (4 - i)) / 4), ESQ - 12, y);
  }

  const px = (i: number) =>
    ESQ + ((LARG - ESQ - DIR) * i) / Math.max(dados.length - 1, 1);
  const py = (v: number) => BASE - ((BASE - TOPO) * v) / max;

  ctx.beginPath();
  dados.forEach((d, i) => (i ? ctx.lineTo(px(i), py(d.qtd)) : ctx.moveTo(px(i), py(d.qtd))));
  ctx.lineTo(px(dados.length - 1), BASE);
  ctx.lineTo(px(0), BASE);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, TOPO, 0, BASE);
  grad.addColorStop(0, 'rgba(14,141,225,0.30)');
  grad.addColorStop(1, 'rgba(14,141,225,0.02)');
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  dados.forEach((d, i) => (i ? ctx.lineTo(px(i), py(d.qtd)) : ctx.moveTo(px(i), py(d.qtd))));
  ctx.strokeStyle = AZUL;
  ctx.lineWidth = 3;
  ctx.stroke();

  dados.forEach((d, i) => {
    ctx.beginPath();
    ctx.arc(px(i), py(d.qtd), 6, 0, Math.PI * 2);
    ctx.fillStyle = AZUL;
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 17px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(num(d.qtd), px(i), py(d.qtd) - 12);
    ctx.fillStyle = CINZA;
    ctx.font = '16px sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(d.mes, px(i), BASE + 12);
  });
  return canvas.toBuffer('image/png');
}

export function velocimetro(pct: number, meta: number, legenda: string): Buffer {
  const [ctx, canvas] = base(1000, 400);
  const cx = 500;
  const cy = 300;
  const r = 200;
  const arco = Math.PI * r;
  const cor = pct >= meta ? '#22c55e' : pct >= meta * 0.8 ? '#f59e0b' : '#ef4444';

  ctx.lineCap = 'round';
  ctx.lineWidth = 38;
  ctx.strokeStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = cor;
  ctx.setLineDash([(Math.min(pct, 100) / 100) * arco, arco]);
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  const a = Math.PI * (1 + meta / 100);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx + (r - 26) * Math.cos(a), cy + (r - 26) * Math.sin(a));
  ctx.lineTo(cx + (r + 26) * Math.cos(a), cy + (r + 26) * Math.sin(a));
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 72px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`${num(pct, 1)}%`, cx, cy - 24);
  ctx.fillStyle = CINZA;
  ctx.font = '20px sans-serif';
  ctx.fillText(`meta ${num(meta)}%`, cx, cy + 10);
  ctx.font = '19px sans-serif';
  ctx.fillText(legenda, cx, cy + 56);
  return canvas.toBuffer('image/png');
}
