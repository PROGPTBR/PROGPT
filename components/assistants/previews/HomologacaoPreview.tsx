// Stylized SVG do output de Homologação: um escudo com check + uma lista de
// achados de compliance e um badge de risco. Sugere "consulta fiscal por CNPJ
// → relatório de homologação".

const BRAND_CYAN = '#0ed1e0';

const FINDINGS: Array<{ label: string; ok: boolean }> = [
  { label: 'Situação cadastral', ok: true },
  { label: 'Regime tributário', ok: true },
  { label: 'Certidões', ok: true },
  { label: 'Quadro societário', ok: true },
];

export function HomologacaoPreview() {
  return (
    <svg
      viewBox="0 0 320 180"
      preserveAspectRatio="xMidYMid slice"
      className="w-full h-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="homBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0f0f0f" />
          <stop offset="100%" stopColor="#070707" />
        </linearGradient>
        <radialGradient id="homGlow" cx="0.3" cy="0.3" r="0.6">
          <stop offset="0%" stopColor={BRAND_CYAN} stopOpacity="0.15" />
          <stop offset="100%" stopColor={BRAND_CYAN} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="180" fill="url(#homBg)" />
      <rect width="320" height="180" fill="url(#homGlow)" />

      {/* Escudo com check (esquerda) */}
      <g transform="translate(60, 92)">
        <path
          d="M 0,-46 L 38,-32 L 38,6 C 38,30 20,44 0,52 C -20,44 -38,30 -38,6 L -38,-32 Z"
          fill={BRAND_CYAN}
          fillOpacity="0.12"
          stroke={BRAND_CYAN}
          strokeOpacity="0.7"
          strokeWidth="2"
        />
        <path
          d="M -16,2 L -4,16 L 18,-14"
          fill="none"
          stroke={BRAND_CYAN}
          strokeOpacity="0.95"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text
          x="0"
          y="76"
          textAnchor="middle"
          fontFamily="var(--font-outfit), system-ui, sans-serif"
          fontSize="7"
          fill="#ffffff"
          fillOpacity="0.45"
          letterSpacing="0.8"
        >
          RISCO BAIXO · 90
        </text>
      </g>

      {/* Lista de achados (direita) */}
      <g transform="translate(140, 38)">
        <text
          x="0"
          y="0"
          fontFamily="var(--font-outfit), system-ui, sans-serif"
          fontSize="6"
          fill="#ffffff"
          fillOpacity="0.4"
          letterSpacing="0.8"
        >
          COMPLIANCE · RECEITA
        </text>
        {FINDINGS.map((f, i) => {
          const y = 18 + i * 26;
          return (
            <g key={f.label} transform={`translate(0, ${y})`}>
              <circle cx="6" cy="-3" r="6" fill={BRAND_CYAN} fillOpacity="0.18" />
              <path
                d="M 3,-3 L 5,-1 L 9,-6"
                fill="none"
                stroke={BRAND_CYAN}
                strokeOpacity="0.9"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect
                x="20"
                y="-8"
                width="120"
                height="10"
                rx="2"
                fill="#ffffff"
                fillOpacity="0.06"
              />
              <text
                x="24"
                y="0"
                fontFamily="var(--font-outfit), system-ui, sans-serif"
                fontSize="7"
                fill="#ffffff"
                fillOpacity="0.7"
              >
                {f.label}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
