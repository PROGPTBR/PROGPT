// Stylized SVG of the Financial Health output. Used in the spotlight
// card on /assistants. A gauge-style score (0-100) sitting above 4
// pillar bars hints at "deterministic scoring + LLM narrative".

const BRAND_CYAN = '#0ed1e0';

const PILLARS: Array<{ label: string; height: number }> = [
  { label: 'LIQ', height: 60 },
  { label: 'DÍV', height: 75 },
  { label: 'MAR', height: 50 },
  { label: 'ROE', height: 70 },
];

export function FinancialScorePreview() {
  return (
    <svg
      viewBox="0 0 320 180"
      preserveAspectRatio="xMidYMid slice"
      className="w-full h-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="finBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0f0f0f" />
          <stop offset="100%" stopColor="#070707" />
        </linearGradient>
        <radialGradient id="finGlow" cx="0.3" cy="0.3" r="0.6">
          <stop offset="0%" stopColor={BRAND_CYAN} stopOpacity="0.15" />
          <stop offset="100%" stopColor={BRAND_CYAN} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="180" fill="url(#finBg)" />
      <rect width="320" height="180" fill="url(#finGlow)" />

      {/* Score gauge (left half) */}
      <g transform="translate(60, 90)">
        {/* arc background */}
        <path
          d="M -45,0 A 45,45 0 0 1 45,0"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.08"
          strokeWidth="6"
          strokeLinecap="round"
        />
        {/* arc filled — 72/100 of half-circle */}
        <path
          d="M -45,0 A 45,45 0 0 1 19,-40.7"
          fill="none"
          stroke={BRAND_CYAN}
          strokeOpacity="0.85"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <text
          x="0"
          y="-2"
          textAnchor="middle"
          fontFamily="var(--font-outfit), system-ui, sans-serif"
          fontSize="26"
          fontWeight="600"
          fill="#ffffff"
          fillOpacity="0.9"
        >
          72
        </text>
        <text
          x="0"
          y="14"
          textAnchor="middle"
          fontFamily="var(--font-outfit), system-ui, sans-serif"
          fontSize="7"
          fill="#ffffff"
          fillOpacity="0.4"
          letterSpacing="0.8"
        >
          SCORE / 100
        </text>
        <text
          x="0"
          y="40"
          textAnchor="middle"
          fontFamily="var(--font-outfit), system-ui, sans-serif"
          fontSize="6"
          fill={BRAND_CYAN}
          fillOpacity="0.8"
          letterSpacing="1"
        >
          BOM · BUY
        </text>
      </g>

      {/* 4 pillar bars (right half) */}
      <g transform="translate(165, 30)">
        <text
          x="0"
          y="0"
          fontFamily="var(--font-outfit), system-ui, sans-serif"
          fontSize="6"
          fill="#ffffff"
          fillOpacity="0.4"
          letterSpacing="0.8"
        >
          4 PILARES PONDERADOS
        </text>
        {PILLARS.map((p, i) => {
          const x = i * 28;
          const yBase = 110;
          const h = p.height;
          return (
            <g key={p.label}>
              {/* bar background */}
              <rect
                x={x}
                y={yBase - 90}
                width="18"
                height="90"
                rx="2"
                fill="#ffffff"
                fillOpacity="0.05"
              />
              {/* bar fill */}
              <rect
                x={x}
                y={yBase - h}
                width="18"
                height={h}
                rx="2"
                fill={BRAND_CYAN}
                fillOpacity={0.5 + (h / 100) * 0.4}
              />
              <text
                x={x + 9}
                y={yBase + 10}
                textAnchor="middle"
                fontFamily="var(--font-outfit), system-ui, sans-serif"
                fontSize="6"
                fill="#ffffff"
                fillOpacity="0.6"
                letterSpacing="0.5"
              >
                {p.label}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
