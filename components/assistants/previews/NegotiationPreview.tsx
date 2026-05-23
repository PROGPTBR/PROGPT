// Stylized SVG do simulador de negociação pro spotlight card no
// /assistants. Conceitualmente: chat balloons (comprador vs fornecedor)
// + barra de score na base. Ilustração — não é screenshot.

const BRAND_CYAN = '#0ed1e0';

export function NegotiationPreview() {
  return (
    <svg
      viewBox="0 0 320 180"
      preserveAspectRatio="xMidYMid slice"
      className="w-full h-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="negBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0f0f0f" />
          <stop offset="100%" stopColor="#070707" />
        </linearGradient>
        <radialGradient id="negGlow" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0%" stopColor={BRAND_CYAN} stopOpacity="0.18" />
          <stop offset="100%" stopColor={BRAND_CYAN} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="180" fill="url(#negBg)" />
      <rect width="320" height="180" fill="url(#negGlow)" />

      {/* Sidebar com avatar + label */}
      <g>
        <circle cx="28" cy="36" r="10" fill="#1a1a1a" stroke={BRAND_CYAN} strokeOpacity="0.6" strokeWidth="1" />
        <text
          x="28"
          y="40"
          textAnchor="middle"
          fontFamily="var(--font-outfit), system-ui, sans-serif"
          fontSize="7"
          fontWeight="600"
          fill={BRAND_CYAN}
          fillOpacity="0.8"
        >
          F
        </text>
        <rect x="45" y="32" width="42" height="3.5" rx="1.5" fill="#ffffff" fillOpacity="0.25" />
        <rect x="45" y="38" width="28" height="2.5" rx="1" fill="#ffffff" fillOpacity="0.12" />
      </g>

      {/* Bolha 1 — Fornecedor (left, gray) */}
      <g>
        <rect x="20" y="58" width="170" height="22" rx="10" fill="#1a1a1a" stroke="#ffffff" strokeOpacity="0.1" strokeWidth="0.8" />
        <rect x="28" y="64" width="135" height="2.5" fill="#ffffff" fillOpacity="0.5" />
        <rect x="28" y="69" width="100" height="2.5" fill="#ffffff" fillOpacity="0.35" />
        <rect x="28" y="74" width="60" height="2.5" fill="#ffffff" fillOpacity="0.2" />
      </g>

      {/* Bolha 2 — Comprador (right, cyan) */}
      <g>
        <rect x="120" y="86" width="180" height="22" rx="10" fill={BRAND_CYAN} fillOpacity="0.85" />
        <rect x="128" y="92" width="145" height="2.5" fill="#000000" fillOpacity="0.6" />
        <rect x="128" y="97" width="115" height="2.5" fill="#000000" fillOpacity="0.45" />
        <rect x="128" y="102" width="80" height="2.5" fill="#000000" fillOpacity="0.3" />
      </g>

      {/* Bolha 3 — Fornecedor de novo (typing dots) */}
      <g>
        <rect x="20" y="114" width="80" height="22" rx="10" fill="#1a1a1a" stroke="#ffffff" strokeOpacity="0.1" strokeWidth="0.8" />
        <circle cx="35" cy="125" r="2" fill={BRAND_CYAN} fillOpacity="0.4" />
        <circle cx="45" cy="125" r="2" fill={BRAND_CYAN} fillOpacity="0.7" />
        <circle cx="55" cy="125" r="2" fill={BRAND_CYAN} fillOpacity="0.4" />
        <text
          x="68"
          y="128"
          fontFamily="var(--font-outfit), system-ui, sans-serif"
          fontSize="5.5"
          fill="#ffffff"
          fillOpacity="0.4"
        >
          digitando
        </text>
      </g>

      {/* Score bar at bottom */}
      <g>
        <text
          x="20"
          y="158"
          fontFamily="var(--font-outfit), system-ui, sans-serif"
          fontSize="5"
          fontWeight="600"
          fill={BRAND_CYAN}
          fillOpacity="0.8"
          letterSpacing="0.5"
        >
          SCORE
        </text>
        <text
          x="56"
          y="158"
          fontFamily="ui-monospace, monospace"
          fontSize="7"
          fontWeight="700"
          fill="#ffffff"
          fillOpacity="0.85"
        >
          78/100
        </text>
        <rect x="100" y="153" width="200" height="6" rx="3" fill="#ffffff" fillOpacity="0.08" />
        <rect x="100" y="153" width="156" height="6" rx="3" fill={BRAND_CYAN} fillOpacity="0.8" />
      </g>
    </svg>
  );
}
