// Stylized SVG for the Diagnóstico de Aquisição spotlight card: a
// CAPEX/OPEX fork collapsing into a SOURCE/CONTRACT/BUY badge — hints at
// "classification in, strategic recommendation out".

const BRAND_CYAN = '#0ed1e0';

export function DiagnosticoAquisicaoPreview() {
  return (
    <svg
      viewBox="0 0 320 180"
      preserveAspectRatio="xMidYMid slice"
      className="w-full h-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="diagBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0f0f0f" />
          <stop offset="100%" stopColor="#070707" />
        </linearGradient>
      </defs>
      <rect width="320" height="180" fill="url(#diagBg)" />

      {/* CAPEX / OPEX pills */}
      <g fontFamily="var(--font-outfit), system-ui, sans-serif">
        <rect x="30" y="30" width="70" height="26" rx="13" fill="#ffffff" fillOpacity="0.08" />
        <text x="65" y="47" textAnchor="middle" fontSize="11" fill="#ffffff" fillOpacity="0.7">
          CAPEX
        </text>
        <rect x="30" y="70" width="70" height="26" rx="13" fill="#ffffff" fillOpacity="0.08" />
        <text x="65" y="87" textAnchor="middle" fontSize="11" fill="#ffffff" fillOpacity="0.7">
          OPEX
        </text>

        {/* connecting lines converging to the badge */}
        <path
          d="M100,43 C140,43 140,90 175,90"
          fill="none"
          stroke={BRAND_CYAN}
          strokeOpacity="0.4"
          strokeWidth="2"
        />
        <path
          d="M100,83 C140,83 140,90 175,90"
          fill="none"
          stroke={BRAND_CYAN}
          strokeOpacity="0.4"
          strokeWidth="2"
        />

        {/* KPI chips */}
        <text x="30" y="120" fontSize="6" fill="#ffffff" fillOpacity="0.4" letterSpacing="0.8">
          KPIS RECOMENDADOS
        </text>
        {['TCO', 'ROI', 'OTIF'].map((k, i) => (
          <g key={k} transform={`translate(${30 + i * 45}, 128)`}>
            <rect width="38" height="18" rx="4" fill={BRAND_CYAN} fillOpacity="0.15" />
            <text x="19" y="12" textAnchor="middle" fontSize="8" fill={BRAND_CYAN}>
              {k}
            </text>
          </g>
        ))}

        {/* SOURCE/CONTRACT/BUY badge */}
        <g transform="translate(230, 90)">
          <circle r="46" fill="#ffffff" fillOpacity="0.05" />
          <text
            x="0"
            y="-6"
            textAnchor="middle"
            fontSize="8"
            fill="#ffffff"
            fillOpacity="0.4"
            letterSpacing="0.8"
          >
            RECOMENDAÇÃO
          </text>
          <text
            x="0"
            y="14"
            textAnchor="middle"
            fontSize="17"
            fontWeight="700"
            fill={BRAND_CYAN}
            letterSpacing="1"
          >
            SOURCE
          </text>
        </g>
      </g>
    </svg>
  );
}
