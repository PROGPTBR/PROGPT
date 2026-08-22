import { createCanvas } from '@napi-rs/canvas';
import type { NegotiationStrategyResult } from '@/lib/assistants/types';

// Backlog do diretor (2026-08-19, ver docs/product/backlog-diretor-2026-08-19.md,
// Batch H) — matriz SWOT 2×2 do relatório de negociação.
//
// Mesmo padrão de kraljic-chart.ts / scorecard-chart.ts: desenho à mão com
// @napi-rs/canvas (sem chartjs). Layout SWOT canônico:
//
//            AJUDA                ATRAPALHA
//   INTERNO  Forças               Fraquezas
//   EXTERNO  Oportunidades        Ameaças
//
// A mesma função serve a rota /chart e o .docx, então a imagem na tela e a
// do documento baixado são byte-idênticas.

type Swot = NegotiationStrategyResult['swot'];

const QUADRANTS = [
  { key: 'strengths', title: 'Forças', color: '#2e7d32', bg: 'rgba(46, 125, 50, 0.07)' },
  { key: 'weaknesses', title: 'Fraquezas', color: '#c62828', bg: 'rgba(198, 40, 40, 0.07)' },
  { key: 'opportunities', title: 'Oportunidades', color: '#1f4e79', bg: 'rgba(31, 78, 121, 0.07)' },
  { key: 'threats', title: 'Ameaças', color: '#e65100', bg: 'rgba(230, 81, 0, 0.07)' },
] as const satisfies readonly { key: keyof Swot; title: string; color: string; bg: string }[];

// Quantos bullets cabem por quadrante sem virar sopa de letrinhas. O schema
// pede 3-6, mas o LLM às vezes entrega mais; o excedente vira "+N".
const MAX_BULLETS = 6;
const MAX_BULLET_LINES = 2;

export type SwotChartSize = { width: number; height: number };
const DEFAULT_SIZE: SwotChartSize = { width: 1100, height: 760 };

/** Quebra `text` em no máximo `maxLines` linhas que cabem em `maxWidth`. */
function wrapText(
  ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && current) lines.push(current);
  // Estourou o limite de linhas: reticências na última.
  if (lines.length === maxLines) {
    const last = lines[maxLines - 1]!;
    const consumed = lines.join(' ');
    if (consumed.length < text.length) {
      let truncated = last;
      while (
        truncated.length > 0 &&
        ctx.measureText(`${truncated}…`).width > maxWidth
      ) {
        truncated = truncated.slice(0, -1);
      }
      lines[maxLines - 1] = `${truncated}…`;
    }
  }
  return lines;
}

export async function renderSwotChartPng(
  swot: Swot,
  size: SwotChartSize = DEFAULT_SIZE,
): Promise<Buffer> {
  const { width, height } = size;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Faixas de rótulo: 70px no topo (Ajuda/Atrapalha) e 40px à esquerda
  // (Interno/Externo), girado 90°.
  const m = { top: 76, right: 32, bottom: 32, left: 48 };
  const plotW = width - m.left - m.right;
  const plotH = height - m.top - m.bottom;
  const cellW = plotW / 2;
  const cellH = plotH / 2;

  // Título
  ctx.fillStyle = '#111111';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('Matriz SWOT', width / 2, 16);

  // Eixos semânticos
  ctx.font = 'bold 14px sans-serif';
  ctx.fillStyle = '#555555';
  ctx.fillText('AJUDA A ALCANÇAR O OBJETIVO', m.left + cellW / 2, m.top - 24);
  ctx.fillText('ATRAPALHA O OBJETIVO', m.left + cellW * 1.5, m.top - 24);

  ctx.save();
  ctx.translate(m.left - 16, m.top + cellH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ORIGEM INTERNA', 0, 0);
  ctx.restore();

  ctx.save();
  ctx.translate(m.left - 16, m.top + cellH * 1.5);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ORIGEM EXTERNA', 0, 0);
  ctx.restore();

  QUADRANTS.forEach((q, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x0 = m.left + col * cellW;
    const y0 = m.top + row * cellH;

    ctx.fillStyle = q.bg;
    ctx.fillRect(x0, y0, cellW, cellH);
    ctx.strokeStyle = q.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x0, y0, cellW, cellH);

    // Cabeçalho do quadrante
    ctx.fillStyle = q.color;
    ctx.font = 'bold 19px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(q.title.toUpperCase(), x0 + 18, y0 + 16);

    const bullets = (swot[q.key] ?? []).filter((b) => b.trim().length > 0);
    const maxTextW = cellW - 54;
    const bottomLimit = y0 + cellH - 18;
    const startY = y0 + 52;

    ctx.font = '15px sans-serif';

    // Quebra primeiro, decide depois: o marcador "+N" precisa de espaço
    // RESERVADO, senão o corte fica silencioso — o leitor não teria como
    // saber que a matriz mostra menos do que o relatório traz.
    const wrapped = bullets
      .slice(0, MAX_BULLETS)
      .map((b) => wrapText(ctx, b.trim(), maxTextW, MAX_BULLET_LINES));

    const fits = (upTo: number, reserveFooter: boolean): boolean => {
      let y = startY;
      for (let k = 0; k < upTo; k++) y += wrapped[k]!.length * 21 + 8;
      return y + (reserveFooter ? 20 : 0) <= bottomLimit;
    };

    let drawn = wrapped.length;
    if (!fits(drawn, bullets.length > wrapped.length)) {
      drawn = 0;
      // Cabe tudo o que sobrar? Se não, reserva a linha do "+N".
      while (drawn < wrapped.length && fits(drawn + 1, true)) drawn++;
    }

    let cursorY = startY;
    for (let k = 0; k < drawn; k++) {
      const lines = wrapped[k]!;
      ctx.fillStyle = q.color;
      ctx.font = '15px sans-serif';
      ctx.fillText('•', x0 + 20, cursorY);
      ctx.fillStyle = '#222222';
      lines.forEach((line, li) => {
        ctx.fillText(line, x0 + 36, cursorY + li * 21);
      });
      cursorY += lines.length * 21 + 8;
    }

    const hidden = bullets.length - drawn;
    if (hidden > 0) {
      ctx.fillStyle = '#777777';
      ctx.font = 'italic 14px sans-serif';
      ctx.fillText(
        `+${hidden} ${hidden === 1 ? 'item' : 'itens'} no relatório`,
        x0 + 36,
        cursorY,
      );
    }

    if (bullets.length === 0) {
      ctx.fillStyle = '#999999';
      ctx.font = 'italic 15px sans-serif';
      ctx.fillText('—', x0 + 20, y0 + 52);
    }
  });

  return canvas.toBuffer('image/png');
}
