// Stylized SVG of the ABC (Pareto) curve output. Used in the spotlight
// card on /assistants. Cumulative-share curve with A/B/C regions hints
// at "ordered items + Pareto thresholds 80/95%".

const BRAND_CYAN = '#0ed1e0';

export function AbcCurvePreview() {
  return (
    <svg
      viewBox="0 0 320 180"
      preserveAspectRatio="xMidYMid slice"
      className="w-full h-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="abcBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0f0f0f" />
          <stop offset="100%" stopColor="#070707" />
        </linearGradient>
        <radialGradient id="abcGlow" cx="0.3" cy="0.3" r="0.6">
          <stop offset="0%" stopColor={BRAND_CYAN} stopOpacity="0.15" />
          <stop offset="100%" stopColor={BRAND_CYAN} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="180" fill="url(#abcBg)" />
      <rect width="320" height="180" fill="url(#abcGlow)" />

      {/* Plot area: x [40..300], y [30..150]; class boundaries at x=120 (A:20%), x=220 (B:60%) */}

      {/* Class A region tint */}
      <rect x="40" y="30" width="80" height="120" fill="#3b82f6" fillOpacity="0.10" />
      {/* Class B region tint */}
      <rect x="120" y="30" width="100" height="120" fill="#22c55e" fillOpacity="0.08" />
      {/* Class C region tint */}
      <rect x="220" y="30" width="80" height="120" fill="#9ca3af" fillOpacity="0.05" />

      {/* Class labels */}
      <text x="80" y="46" textAnchor="middle" fontFamily="var(--font-outfit), system-ui, sans-serif" fontSize="9" fontWeight="600" fill="#60a5fa" letterSpacing="1">A</text>
      <text x="170" y="46" textAnchor="middle" fontFamily="var(--font-outfit), system-ui, sans-serif" fontSize="9" fontWeight="600" fill="#4ade80" letterSpacing="1">B</text>
      <text x="260" y="46" textAnchor="middle" fontFamily="var(--font-outfit), system-ui, sans-serif" fontSize="9" fontWeight="600" fill="#9ca3af" letterSpacing="1">C</text>

      {/* Axes */}
      <line x1="40" y1="150" x2="300" y2="150" stroke="#ffffff" strokeOpacity="0.15" strokeWidth="1" />
      <line x1="40" y1="30" x2="40" y2="150" stroke="#ffffff" strokeOpacity="0.15" strokeWidth="1" />

      {/* 80% reference line (y = 30 + (1-0.8)*120 = 54) */}
      <line x1="40" y1="54" x2="300" y2="54" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="0.8" strokeDasharray="2,3" />
      <text x="46" y="51" fontFamily="var(--font-outfit), system-ui, sans-serif" fontSize="6" fill="#ffffff" fillOpacity="0.4">80%</text>

      {/* 95% reference (y = 30 + (1-0.95)*120 = 36) */}
      <line x1="40" y1="36" x2="300" y2="36" stroke="#ffffff" strokeOpacity="0.12" strokeWidth="0.8" strokeDasharray="2,3" />

      {/* Pareto curve — concave-up rising fast then plateauing */}
      <path
        d="M 40,150 C 80,120 100,80 120,54 C 160,40 200,38 220,36 C 250,33 280,32 300,30"
        fill="none"
        stroke={BRAND_CYAN}
        strokeOpacity="0.9"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Dots at class boundaries */}
      <circle cx="120" cy="54" r="3" fill={BRAND_CYAN} />
      <circle cx="220" cy="36" r="3" fill={BRAND_CYAN} />

      {/* Axis labels */}
      <text x="170" y="170" textAnchor="middle" fontFamily="var(--font-outfit), system-ui, sans-serif" fontSize="6" fill="#ffffff" fillOpacity="0.5" letterSpacing="0.8">ITENS RANQUEADOS</text>
      <text x="20" y="90" textAnchor="middle" fontFamily="var(--font-outfit), system-ui, sans-serif" fontSize="6" fill="#ffffff" fillOpacity="0.5" letterSpacing="0.8" transform="rotate(-90 20 90)">% CUMULATIVO</text>
    </svg>
  );
}
