// Stylized SVG do simulador tributário: duas colunas comparando a carga do
// Simples Nacional com a da Reforma (IBS/CBS), sugerindo "compare os regimes".

const BRAND_CYAN = '#0ed1e0';
const BRAND_BLUE = '#0e8de1';

const BARS = [
  { label: 'SN', value: '8,2%', h: 58, fill: 'rgba(255,255,255,0.16)', stroke: 'rgba(255,255,255,0.3)' },
  { label: 'REFORMA', value: '11,4%', h: 92, fill: BRAND_CYAN, stroke: BRAND_CYAN },
];

export function SimuladorTributarioPreview() {
  return (
    <svg
      viewBox="0 0 320 180"
      preserveAspectRatio="xMidYMid slice"
      className="w-full h-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="simBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0f0f0f" />
          <stop offset="100%" stopColor="#070707" />
        </linearGradient>
        <radialGradient id="simGlow" cx="0.7" cy="0.25" r="0.6">
          <stop offset="0%" stopColor={BRAND_BLUE} stopOpacity="0.16" />
          <stop offset="100%" stopColor={BRAND_BLUE} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="180" fill="url(#simBg)" />
      <rect width="320" height="180" fill="url(#simGlow)" />

      <text
        x="20"
        y="28"
        fontFamily="var(--font-outfit), system-ui, sans-serif"
        fontSize="6"
        fill="#ffffff"
        fillOpacity="0.4"
        letterSpacing="0.8"
      >
        SIMPLES NACIONAL × REFORMA TRIBUTÁRIA
      </text>

      {/* eixo base */}
      <line x1="40" y1="150" x2="280" y2="150" stroke="#ffffff" strokeOpacity="0.12" strokeWidth="1" />

      {BARS.map((b, i) => {
        const w = 78;
        const x = 60 + i * 120;
        const y = 150 - b.h;
        return (
          <g key={b.label}>
            <rect x={x} y={y} width={w} height={b.h} rx="4" fill={b.fill} fillOpacity="0.9" stroke={b.stroke} strokeOpacity="0.4" />
            <text x={x + w / 2} y={y - 8} textAnchor="middle" fontFamily="var(--font-outfit), system-ui, sans-serif" fontSize="13" fontWeight="600" fill="#ffffff" fillOpacity="0.92">
              {b.value}
            </text>
            <text x={x + w / 2} y="165" textAnchor="middle" fontFamily="var(--font-outfit), system-ui, sans-serif" fontSize="7" fill="#ffffff" fillOpacity="0.55" letterSpacing="0.6">
              {b.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
