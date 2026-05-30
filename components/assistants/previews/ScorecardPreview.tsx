// Stylized SVG of the Supplier Scorecard output. Used in the spotlight
// card on /assistants. Horizontal ranked bars with band color hints
// (estratégico / desenvolvimento / saída) match the real chart output.

const BRAND_CYAN = '#0ed1e0';

const SUPPLIERS: Array<{ label: string; score: number; band: 'e' | 'd' | 's' }> = [
  { label: 'Forn A', score: 88, band: 'e' },
  { label: 'Forn B', score: 76, band: 'e' },
  { label: 'Forn C', score: 55, band: 'd' },
  { label: 'Forn D', score: 42, band: 'd' },
  { label: 'Forn E', score: 28, band: 's' },
];

const BAND_COLORS: Record<'e' | 'd' | 's', string> = {
  e: BRAND_CYAN,
  d: '#f59e0b',
  s: '#ef4444',
};

const BAND_OPACITY: Record<'e' | 'd' | 's', number> = {
  e: 0.85,
  d: 0.70,
  s: 0.65,
};

export function ScorecardPreview() {
  const maxBar = 200; // max bar width in SVG units
  const rowH = 26;
  const startY = 28;
  const labelX = 8;
  const barX = 62;

  return (
    <svg
      viewBox="0 0 320 180"
      preserveAspectRatio="xMidYMid slice"
      className="w-full h-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="scBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0f0f0f" />
          <stop offset="100%" stopColor="#070707" />
        </linearGradient>
        <radialGradient id="scGlow" cx="0.25" cy="0.3" r="0.55">
          <stop offset="0%" stopColor={BRAND_CYAN} stopOpacity="0.12" />
          <stop offset="100%" stopColor={BRAND_CYAN} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="180" fill="url(#scBg)" />
      <rect width="320" height="180" fill="url(#scGlow)" />

      {/* Title label */}
      <text
        x={labelX}
        y="16"
        fontFamily="var(--font-outfit), system-ui, sans-serif"
        fontSize="6"
        fill="#ffffff"
        fillOpacity="0.4"
        letterSpacing="0.8"
      >
        RANKING DE FORNECEDORES · SCORE 0–100
      </text>

      {/* Threshold lines */}
      {/* Strategic ≥ 70 */}
      <line
        x1={barX + maxBar * 0.7}
        y1={startY - 4}
        x2={barX + maxBar * 0.7}
        y2={startY + SUPPLIERS.length * rowH}
        stroke={BRAND_CYAN}
        strokeOpacity="0.25"
        strokeWidth="0.8"
        strokeDasharray="2,3"
      />
      <text
        x={barX + maxBar * 0.7 + 2}
        y={startY - 6}
        fontFamily="var(--font-outfit), system-ui, sans-serif"
        fontSize="5"
        fill={BRAND_CYAN}
        fillOpacity="0.5"
      >
        70
      </text>
      {/* Development ≥ 40 */}
      <line
        x1={barX + maxBar * 0.4}
        y1={startY - 4}
        x2={barX + maxBar * 0.4}
        y2={startY + SUPPLIERS.length * rowH}
        stroke="#f59e0b"
        strokeOpacity="0.25"
        strokeWidth="0.8"
        strokeDasharray="2,3"
      />
      <text
        x={barX + maxBar * 0.4 + 2}
        y={startY - 6}
        fontFamily="var(--font-outfit), system-ui, sans-serif"
        fontSize="5"
        fill="#f59e0b"
        fillOpacity="0.5"
      >
        40
      </text>

      {SUPPLIERS.map((s, i) => {
        const y = startY + i * rowH;
        const barW = (s.score / 100) * maxBar;
        const color = BAND_COLORS[s.band];
        const opacity = BAND_OPACITY[s.band];
        return (
          <g key={s.label}>
            {/* Row label */}
            <text
              x={labelX}
              y={y + 12}
              fontFamily="var(--font-outfit), system-ui, sans-serif"
              fontSize="7"
              fill="#ffffff"
              fillOpacity="0.75"
            >
              {s.label}
            </text>
            {/* Bar background */}
            <rect
              x={barX}
              y={y + 2}
              width={maxBar}
              height={14}
              rx="2"
              fill="#ffffff"
              fillOpacity="0.04"
            />
            {/* Bar fill */}
            <rect
              x={barX}
              y={y + 2}
              width={barW}
              height={14}
              rx="2"
              fill={color}
              fillOpacity={opacity}
            />
            {/* Score label */}
            <text
              x={barX + barW + 4}
              y={y + 13}
              fontFamily="var(--font-outfit), system-ui, sans-serif"
              fontSize="7"
              fill={color}
              fillOpacity="0.9"
            >
              {s.score}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      <g transform={`translate(${labelX}, ${startY + SUPPLIERS.length * rowH + 8})`}>
        <rect width="6" height="6" rx="1" fill={BRAND_CYAN} fillOpacity="0.8" />
        <text x="9" y="6" fontFamily="var(--font-outfit), system-ui, sans-serif" fontSize="6" fill="#ffffff" fillOpacity="0.5">Estratégico</text>
        <rect x="62" width="6" height="6" rx="1" fill="#f59e0b" fillOpacity="0.75" />
        <text x="71" y="6" fontFamily="var(--font-outfit), system-ui, sans-serif" fontSize="6" fill="#ffffff" fillOpacity="0.5">Desenvolvimento</text>
        <rect x="148" width="6" height="6" rx="1" fill="#ef4444" fillOpacity="0.7" />
        <text x="157" y="6" fontFamily="var(--font-outfit), system-ui, sans-serif" fontSize="6" fill="#ffffff" fillOpacity="0.5">Saída</text>
      </g>
    </svg>
  );
}
