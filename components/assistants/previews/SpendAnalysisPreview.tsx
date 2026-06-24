// Stylized SVG do output de Análise de Gastos: invoices viram base
// classificada → barras de gasto por categoria + KPIs. Sugere "da nota fiscal
// à estratégia".

const BRAND_CYAN = '#0ed1e0';

// Barras horizontais de gasto por categoria (larguras relativas).
const BARS = [200, 150, 120, 92, 64, 40];

export function SpendAnalysisPreview() {
  return (
    <svg
      viewBox="0 0 320 180"
      preserveAspectRatio="xMidYMid slice"
      className="w-full h-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="saBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0f0f0f" />
          <stop offset="100%" stopColor="#070707" />
        </linearGradient>
        <radialGradient id="saGlow" cx="0.3" cy="0.3" r="0.6">
          <stop offset="0%" stopColor={BRAND_CYAN} stopOpacity="0.15" />
          <stop offset="100%" stopColor={BRAND_CYAN} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="180" fill="url(#saBg)" />
      <rect width="320" height="180" fill="url(#saGlow)" />

      <text
        x="20"
        y="26"
        fontFamily="var(--font-outfit), system-ui, sans-serif"
        fontSize="6"
        fill="#ffffff"
        fillOpacity="0.4"
        letterSpacing="0.8"
      >
        DA NOTA FISCAL À ESTRATÉGIA
      </text>

      {/* Pilha de invoices (esquerda) */}
      <g transform="translate(20, 44)">
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(${i * 6}, ${i * 8})`}>
            <rect
              width="46"
              height="58"
              rx="3"
              fill="#141414"
              stroke={BRAND_CYAN}
              strokeOpacity={0.3 + i * 0.2}
            />
            <line x1="8" y1="14" x2="38" y2="14" stroke="#ffffff" strokeOpacity="0.2" />
            <line x1="8" y1="22" x2="32" y2="22" stroke="#ffffff" strokeOpacity="0.15" />
            <line x1="8" y1="30" x2="38" y2="30" stroke="#ffffff" strokeOpacity="0.15" />
            <line
              x1="8"
              y1="46"
              x2="26"
              y2="46"
              stroke={BRAND_CYAN}
              strokeOpacity="0.6"
              strokeWidth="2"
            />
          </g>
        ))}
      </g>

      {/* Seta */}
      <path
        d="M92 84 L108 84 M104 80 L108 84 L104 88"
        stroke={BRAND_CYAN}
        strokeOpacity="0.7"
        strokeWidth="1.5"
        fill="none"
      />

      {/* Barras horizontais por categoria (direita) */}
      <g transform="translate(116, 50)">
        {BARS.map((w, i) => (
          <rect
            key={i}
            x={0}
            y={i * 16}
            width={w * 0.86}
            height="9"
            rx="2"
            fill={BRAND_CYAN}
            fillOpacity={0.7 - i * 0.09}
          />
        ))}
      </g>

      {/* KPIs */}
      <g transform="translate(116, 156)">
        <text
          fontFamily="var(--font-outfit), system-ui, sans-serif"
          fontSize="11"
          fontWeight="700"
          fill={BRAND_CYAN}
        >
          R$ 4,2M
        </text>
        <text
          x="62"
          fontFamily="var(--font-outfit), system-ui, sans-serif"
          fontSize="7"
          fill="#ffffff"
          fillOpacity="0.5"
        >
          gasto · 312 NFs · 84% c/ PO
        </text>
      </g>
    </svg>
  );
}
