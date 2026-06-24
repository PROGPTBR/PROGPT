// Sparkline SVG sem dependência. Normaliza os valores ao viewBox e desenha
// linha + área. Cor via `currentColor` (o pai define com text-*). Theme-aware.

export function Sparkline({
  values,
  className,
}: {
  values: number[];
  className?: string;
}) {
  if (values.length < 2) return null;
  const W = 100;
  const H = 30;
  const pad = 2;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (W - 2 * pad);
    const y = pad + (1 - (v - min) / range) * (H - 2 * pad);
    return [x, y] as const;
  });

  const line = pts
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  const area = `${line} L${last[0].toFixed(1)},${H} L${first[0].toFixed(1)},${H} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
    >
      <path d={area} fill="currentColor" fillOpacity={0.12} stroke="none" />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
