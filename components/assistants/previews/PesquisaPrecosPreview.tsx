// Stylized SVG do output de Pesquisa de Preços: barras de preço com uma linha
// de mediana e a faixa p25–p75 sombreada. Sugere "preço de referência a partir
// de compras públicas".

const BRAND_CYAN = '#0ed1e0';

// Alturas relativas das barras (amostras de preço).
const BARS = [42, 58, 50, 70, 54, 64, 48, 60, 56, 52];

export function PesquisaPrecosPreview() {
  return (
    <svg
      viewBox="0 0 320 180"
      preserveAspectRatio="xMidYMid slice"
      className="w-full h-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ppBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0f0f0f" />
          <stop offset="100%" stopColor="#070707" />
        </linearGradient>
        <radialGradient id="ppGlow" cx="0.3" cy="0.3" r="0.6">
          <stop offset="0%" stopColor={BRAND_CYAN} stopOpacity="0.15" />
          <stop offset="100%" stopColor={BRAND_CYAN} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="180" fill="url(#ppBg)" />
      <rect width="320" height="180" fill="url(#ppGlow)" />

      <text
        x="28"
        y="30"
        fontFamily="var(--font-outfit), system-ui, sans-serif"
        fontSize="6"
        fill="#ffffff"
        fillOpacity="0.4"
        letterSpacing="0.8"
      >
        PREÇO DE REFERÊNCIA · COMPRAS PÚBLICAS
      </text>

      {/* Faixa p25–p75 sombreada */}
      <rect x="28" y="78" width="232" height="34" fill={BRAND_CYAN} fillOpacity="0.08" />

      {/* Barras */}
      <g transform="translate(28, 132)">
        {BARS.map((h, i) => (
          <rect
            key={i}
            x={i * 23}
            y={-h}
            width="14"
            height={h}
            rx="2"
            fill={BRAND_CYAN}
            fillOpacity={0.25 + (i % 3) * 0.12}
          />
        ))}
      </g>

      {/* Linha da mediana */}
      <line
        x1="28"
        y1="95"
        x2="260"
        y2="95"
        stroke={BRAND_CYAN}
        strokeOpacity="0.9"
        strokeWidth="2"
        strokeDasharray="5 4"
      />
      <text
        x="264"
        y="92"
        fontFamily="var(--font-outfit), system-ui, sans-serif"
        fontSize="8"
        fontWeight="600"
        fill={BRAND_CYAN}
        fillOpacity="0.95"
      >
        R$
      </text>
      <text
        x="264"
        y="104"
        fontFamily="var(--font-outfit), system-ui, sans-serif"
        fontSize="6"
        fill="#ffffff"
        fillOpacity="0.5"
      >
        mediana
      </text>
    </svg>
  );
}
