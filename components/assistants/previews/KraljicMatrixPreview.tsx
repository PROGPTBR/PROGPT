// Stylized SVG of the Kraljic 2×2 matrix output. Used in the spotlight
// card on /assistants. Not a real screenshot — an illustration that
// communicates "this assistant produces a quadrant chart with bubbles".

const BRAND_CYAN = '#0ed1e0';

// Fixed bubble positions/sizes so the layout is stable across renders.
// Coordinates are in the SVG viewBox space (320×180).
const BUBBLES: Array<{ cx: number; cy: number; r: number; opacity: number }> = [
  // Bottom-left quadrant — Não Crítico (smaller bubbles)
  { cx: 50, cy: 135, r: 8, opacity: 0.5 },
  { cx: 90, cy: 150, r: 6, opacity: 0.4 },
  { cx: 120, cy: 125, r: 10, opacity: 0.6 },
  // Bottom-right quadrant — Alavancável (medium bubbles)
  { cx: 200, cy: 140, r: 14, opacity: 0.7 },
  { cx: 250, cy: 125, r: 18, opacity: 0.55 },
  // Top-left quadrant — Gargalo (medium, hi-up)
  { cx: 70, cy: 55, r: 12, opacity: 0.6 },
  { cx: 110, cy: 70, r: 9, opacity: 0.45 },
  // Top-right quadrant — Estratégico (largest, most opaque)
  { cx: 220, cy: 50, r: 20, opacity: 0.9 },
  { cx: 260, cy: 75, r: 15, opacity: 0.75 },
];

export function KraljicMatrixPreview() {
  return (
    <svg
      viewBox="0 0 320 180"
      preserveAspectRatio="xMidYMid slice"
      className="w-full h-full"
      aria-hidden="true"
    >
      {/* Background subtle gradient */}
      <defs>
        <linearGradient id="krBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0f0f0f" />
          <stop offset="100%" stopColor="#070707" />
        </linearGradient>
        <radialGradient id="krGlow" cx="0.7" cy="0.3" r="0.6">
          <stop offset="0%" stopColor={BRAND_CYAN} stopOpacity="0.18" />
          <stop offset="100%" stopColor={BRAND_CYAN} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="180" fill="url(#krBg)" />
      <rect width="320" height="180" fill="url(#krGlow)" />

      {/* Axis frame */}
      <g stroke="#ffffff" strokeOpacity="0.08" strokeWidth="1">
        <line x1="20" y1="160" x2="300" y2="160" />
        <line x1="20" y1="20" x2="20" y2="160" />
      </g>

      {/* Quadrant divider (dashed, cyan) */}
      <g stroke={BRAND_CYAN} strokeOpacity="0.3" strokeWidth="1" strokeDasharray="3 3">
        <line x1="160" y1="20" x2="160" y2="160" />
        <line x1="20" y1="90" x2="300" y2="90" />
      </g>

      {/* Quadrant labels (top-left to bottom-right reading order) */}
      <g
        fontFamily="var(--font-outfit), system-ui, sans-serif"
        fontSize="7"
        fill="#ffffff"
        fillOpacity="0.35"
        letterSpacing="0.5"
      >
        <text x="28" y="32">GARGALO</text>
        <text x="244" y="32">ESTRATÉGICO</text>
        <text x="28" y="155">NÃO CRÍTICO</text>
        <text x="244" y="155">ALAVANCÁVEL</text>
      </g>

      {/* Axis tick labels */}
      <g
        fontFamily="var(--font-outfit), system-ui, sans-serif"
        fontSize="6"
        fill="#ffffff"
        fillOpacity="0.45"
        letterSpacing="0.5"
      >
        <text
          x="160"
          y="174"
          textAnchor="middle"
        >
          COMPLEXIDADE DO MERCADO →
        </text>
        <text
          x="14"
          y="90"
          textAnchor="middle"
          transform="rotate(-90 14 90)"
        >
          ↑ IMPACTO NO NEGÓCIO
        </text>
      </g>

      {/* Bubbles — each fills with brand cyan at varying opacity to
          suggest a real spend-weighted Kraljic chart */}
      <g>
        {BUBBLES.map((b, i) => (
          <circle
            key={i}
            cx={b.cx}
            cy={b.cy}
            r={b.r}
            fill={BRAND_CYAN}
            fillOpacity={b.opacity}
            stroke={BRAND_CYAN}
            strokeOpacity={Math.min(b.opacity + 0.2, 1)}
            strokeWidth="1"
          />
        ))}
      </g>
    </svg>
  );
}
