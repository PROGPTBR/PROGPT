// Stylized SVG do simulador logístico: rota interestadual (origem → destino)
// com um selo DIFAL, sugerindo "custo logístico + diferencial de alíquota".

const BRAND_CYAN = '#0ed1e0';
const BRAND_BLUE = '#0e8de1';

export function SimuladorLogisticoPreview() {
  return (
    <svg
      viewBox="0 0 320 180"
      preserveAspectRatio="xMidYMid slice"
      className="w-full h-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="logBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0f0f0f" />
          <stop offset="100%" stopColor="#070707" />
        </linearGradient>
        <radialGradient id="logGlow" cx="0.5" cy="0.3" r="0.6">
          <stop offset="0%" stopColor={BRAND_CYAN} stopOpacity="0.15" />
          <stop offset="100%" stopColor={BRAND_CYAN} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="180" fill="url(#logBg)" />
      <rect width="320" height="180" fill="url(#logGlow)" />

      <text
        x="20"
        y="28"
        fontFamily="var(--font-outfit), system-ui, sans-serif"
        fontSize="6"
        fill="#ffffff"
        fillOpacity="0.4"
        letterSpacing="0.8"
      >
        ROTA INTERESTADUAL · DIFAL (ICMS)
      </text>

      {/* rota origem → destino */}
      <path
        d="M40,120 C110,60 210,150 280,80"
        fill="none"
        stroke={BRAND_BLUE}
        strokeOpacity="0.5"
        strokeWidth="2"
        strokeDasharray="5 5"
      />
      {/* origem */}
      <circle cx="40" cy="120" r="7" fill={BRAND_CYAN} fillOpacity="0.9" />
      <text x="30" y="145" fontFamily="var(--font-outfit), system-ui, sans-serif" fontSize="8" fontWeight="600" fill="#ffffff" fillOpacity="0.75">
        SP
      </text>
      {/* destino */}
      <circle cx="280" cy="80" r="7" fill={BRAND_BLUE} fillOpacity="0.95" />
      <text x="270" y="105" fontFamily="var(--font-outfit), system-ui, sans-serif" fontSize="8" fontWeight="600" fill="#ffffff" fillOpacity="0.75">
        BA
      </text>

      {/* selo DIFAL */}
      <g transform="translate(120, 92)">
        <rect width="80" height="34" rx="6" fill="#ffffff" fillOpacity="0.05" stroke={BRAND_CYAN} strokeOpacity="0.35" />
        <text x="40" y="15" textAnchor="middle" fontFamily="var(--font-outfit), system-ui, sans-serif" fontSize="7" fill="#ffffff" fillOpacity="0.55" letterSpacing="0.6">
          DIFAL
        </text>
        <text x="40" y="28" textAnchor="middle" fontFamily="var(--font-outfit), system-ui, sans-serif" fontSize="12" fontWeight="700" fill={BRAND_CYAN}>
          R$ 1.240
        </text>
      </g>
    </svg>
  );
}
