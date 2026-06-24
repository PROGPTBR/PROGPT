// Stylized SVG do dashboard de indicadores: três mini-cards com número + linha,
// sugerindo "painel ao vivo de Selic/IPCA/câmbio".

const BRAND_CYAN = '#0ed1e0';

const CARDS = [
  { label: 'SELIC', value: '14,25%', d: 'M0,18 L14,16 L28,16 L42,14 L56,14' },
  { label: 'IPCA', value: '4,72%', d: 'M0,16 L14,12 L28,15 L42,10 L56,11' },
  { label: 'DÓLAR', value: 'R$ 5,17', d: 'M0,14 L14,15 L28,12 L42,16 L56,13' },
];

export function IndicadoresPreview() {
  return (
    <svg
      viewBox="0 0 320 180"
      preserveAspectRatio="xMidYMid slice"
      className="w-full h-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="indBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0f0f0f" />
          <stop offset="100%" stopColor="#070707" />
        </linearGradient>
        <radialGradient id="indGlow" cx="0.3" cy="0.3" r="0.6">
          <stop offset="0%" stopColor={BRAND_CYAN} stopOpacity="0.15" />
          <stop offset="100%" stopColor={BRAND_CYAN} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="180" fill="url(#indBg)" />
      <rect width="320" height="180" fill="url(#indGlow)" />

      <text
        x="20"
        y="28"
        fontFamily="var(--font-outfit), system-ui, sans-serif"
        fontSize="6"
        fill="#ffffff"
        fillOpacity="0.4"
        letterSpacing="0.8"
      >
        INDICADORES ECONÔMICOS · BACEN
      </text>

      {CARDS.map((c, i) => {
        const x = 20 + i * 96;
        return (
          <g key={c.label} transform={`translate(${x}, 44)`}>
            <rect width="84" height="110" rx="6" fill="#ffffff" fillOpacity="0.04" stroke={BRAND_CYAN} strokeOpacity="0.18" />
            <text x="10" y="22" fontFamily="var(--font-outfit), system-ui, sans-serif" fontSize="6.5" fill="#ffffff" fillOpacity="0.5" letterSpacing="0.6">
              {c.label}
            </text>
            <text x="10" y="44" fontFamily="var(--font-outfit), system-ui, sans-serif" fontSize="15" fontWeight="600" fill="#ffffff" fillOpacity="0.92">
              {c.value}
            </text>
            <g transform="translate(10, 58)">
              <path d={`${c.d} L56,28 L0,28 Z`} fill={BRAND_CYAN} fillOpacity="0.12" />
              <path d={c.d} fill="none" stroke={BRAND_CYAN} strokeOpacity="0.9" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          </g>
        );
      })}
    </svg>
  );
}
