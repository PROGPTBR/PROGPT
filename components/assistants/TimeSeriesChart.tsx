'use client';

import { useEffect, useRef, useState } from 'react';

// Gráfico de linha interativo (SVG, sem dependência): eixos, gridlines e
// tooltip com crosshair ao passar o mouse. Cor da linha via currentColor
// (o pai define com text-brand). Largura medida via ResizeObserver para os
// rótulos não distorcerem (sem preserveAspectRatio:none).

type Pt = { data: string; valor: number };

const MUTED = 'hsl(var(--muted-foreground))';

export function TimeSeriesChart({ pontos, unidade }: { pontos: Pt[]; unidade: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(680);
  const [hover, setHover] = useState<number | null>(null);
  const h = 260;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cw = entries[0]?.contentRect.width;
      if (cw) setW(Math.max(320, Math.floor(cw)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (pontos.length < 2) {
    return <div className="text-sm text-muted-foreground py-10 text-center">Sem dados suficientes para o período.</div>;
  }

  const padL = 54;
  const padR = 14;
  const padT = 10;
  const padB = 24;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const values = pontos.map((p) => p.valor);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const yMin = lo - span * 0.06;
  const yMax = hi + span * 0.06;
  const yRange = yMax - yMin || 1;

  const x = (i: number) => padL + (i / (pontos.length - 1)) * plotW;
  const y = (v: number) => padT + (1 - (v - yMin) / yRange) * plotH;

  const line = pontos
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`)
    .join(' ');
  const baseY = (padT + plotH).toFixed(1);
  const area = `${line} L${x(pontos.length - 1).toFixed(1)},${baseY} L${x(0).toFixed(1)},${baseY} Z`;

  const yTicks = Array.from({ length: 5 }, (_, k) => yMin + (yRange * k) / 4);
  const lastI = pontos.length - 1;
  const xTickIdx = [0, Math.round(lastI / 3), Math.round((lastI * 2) / 3), lastI];

  const fmtY = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  const fmtVal = (v: number) =>
    unidade === 'R$'
      ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
      : `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}${unidade.includes('%') ? '%' : ''}`;

  function onMove(e: React.MouseEvent<SVGRectElement>) {
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * w; // rect.width ~= w, mas normaliza
    const ratio = (px - padL) / plotW;
    const idx = Math.round(ratio * lastI);
    setHover(Math.min(lastI, Math.max(0, idx)));
  }

  const hp = hover != null ? pontos[hover]! : null;
  const tooltipLeft = hover != null ? Math.min(w - 130, Math.max(4, x(hover) + 8)) : 0;

  return (
    <div ref={wrapRef} className="relative w-full text-brand select-none">
      <svg width={w} height={h} className="block max-w-full">
        {yTicks.map((t, k) => (
          <g key={`y${k}`}>
            <line x1={padL} y1={y(t)} x2={w - padR} y2={y(t)} stroke="currentColor" strokeOpacity={0.08} />
            <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill={MUTED}>
              {fmtY(t)}
            </text>
          </g>
        ))}
        {xTickIdx.map((i, k) => (
          <text
            key={`x${k}`}
            x={x(i)}
            y={h - 7}
            textAnchor={k === 0 ? 'start' : k === xTickIdx.length - 1 ? 'end' : 'middle'}
            fontSize={10}
            fill={MUTED}
          >
            {pontos[i]!.data}
          </text>
        ))}

        <path d={area} fill="currentColor" fillOpacity={0.1} />
        <path
          d={line}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {hp && hover != null && (
          <g>
            <line x1={x(hover)} y1={padT} x2={x(hover)} y2={padT + plotH} stroke="currentColor" strokeOpacity={0.35} />
            <circle cx={x(hover)} cy={y(hp.valor)} r={3.5} fill="currentColor" />
          </g>
        )}

        <rect
          x={padL}
          y={padT}
          width={plotW}
          height={plotH}
          fill="transparent"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        />
      </svg>

      {hp && (
        <div
          className="pointer-events-none absolute top-1 rounded-md border border-border bg-popover px-2 py-1 text-xs shadow-md text-popover-foreground"
          style={{ left: tooltipLeft }}
        >
          <div className="font-medium tabular-nums">{fmtVal(hp.valor)}</div>
          <div className="text-muted-foreground">{hp.data}</div>
        </div>
      )}
    </div>
  );
}
