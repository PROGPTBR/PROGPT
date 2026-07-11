// Stylized SVG do Painel unificado: KPIs + barras + linha, sugerindo um
// dashboard moderno "estilo BI" que agrega todos os dados do cliente.

const BRAND_CYAN = '#0ed1e0';
const GREEN = '#34d399';

const KPIS = [
  { label: 'CONVERSAS', value: '128' },
  { label: 'EXECUÇÕES', value: '46' },
  { label: 'GASTO', value: 'R$ 1,2M' },
];

const BARS = [72, 54, 40, 28, 18];

export function DashboardPreview() {
  return (
    <svg
      viewBox="0 0 320 180"
      preserveAspectRatio="xMidYMid slice"
      className="w-full h-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="dashBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0f0f0f" />
          <stop offset="100%" stopColor="#070707" />
        </linearGradient>
        <radialGradient id="dashGlow" cx="0.7" cy="0.2" r="0.7">
          <stop offset="0%" stopColor={BRAND_CYAN} stopOpacity="0.18" />
          <stop offset="100%" stopColor={BRAND_CYAN} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="180" fill="url(#dashBg)" />
      <rect width="320" height="180" fill="url(#dashGlow)" />

      <text
        x="20"
        y="26"
        fontFamily="var(--font-outfit), system-ui, sans-serif"
        fontSize="6"
        fill="#ffffff"
        fillOpacity="0.4"
        letterSpacing="0.8"
      >
        PAINEL UNIFICADO · TODOS OS SEUS DADOS
      </text>

      {/* KPI cards */}
      {KPIS.map((k, i) => {
        const x = 20 + i * 68;
        return (
          <g key={k.label} transform={`translate(${x}, 36)`}>
            <rect width="60" height="34" rx="5" fill="#ffffff" fillOpacity="0.04" stroke={BRAND_CYAN} strokeOpacity="0.18" />
            <text x="8" y="14" fontFamily="var(--font-outfit), system-ui, sans-serif" fontSize="5" fill="#ffffff" fillOpacity="0.5" letterSpacing="0.5">
              {k.label}
            </text>
            <text x="8" y="27" fontFamily="var(--font-outfit), system-ui, sans-serif" fontSize="11" fontWeight="600" fill="#ffffff" fillOpacity="0.92">
              {k.value}
            </text>
          </g>
        );
      })}

      {/* Bar list (esquerda) */}
      <g transform="translate(20, 86)">
        <rect width="140" height="78" rx="6" fill="#ffffff" fillOpacity="0.03" stroke={BRAND_CYAN} strokeOpacity="0.12" />
        {BARS.map((b, i) => (
          <g key={i} transform={`translate(12, ${12 + i * 12})`}>
            <rect width="116" height="5" rx="2.5" fill="#ffffff" fillOpacity="0.06" />
            <rect width={b * 1.5} height="5" rx="2.5" fill={BRAND_CYAN} fillOpacity="0.75" />
          </g>
        ))}
      </g>

      {/* Line chart (direita) */}
      <g transform="translate(172, 86)">
        <rect width="128" height="78" rx="6" fill="#ffffff" fillOpacity="0.03" stroke={BRAND_CYAN} strokeOpacity="0.12" />
        <path
          d="M12,58 L34,44 L56,50 L78,30 L100,36 L116,18 L116,66 L12,66 Z"
          fill={BRAND_CYAN}
          fillOpacity="0.1"
        />
        <path
          d="M12,58 L34,44 L56,50 L78,30 L100,36 L116,18"
          fill="none"
          stroke={BRAND_CYAN}
          strokeOpacity="0.9"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12,62 L34,58 L56,54 L78,50 L100,44 L116,40"
          fill="none"
          stroke={GREEN}
          strokeOpacity="0.85"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
