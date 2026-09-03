// Stylized SVG of the Equalizador de Propostas (Robô Comprador) output.
// Used in the spotlight card on /assistants. Three supplier rows compared
// by TCO, with the cheapest-and-compliant one highlighted as the winner
// and a flagged row echoing a policy/compliance alert — mirrors the real
// ranking + alertas fields from CompradorResultSchema.

const BRAND_CYAN = '#0ed1e0';
const AMBER = '#f59e0b';

type Row = {
  label: string;
  tco: string;
  barPct: number;
  status: 'winner' | 'warn' | 'neutral';
};

const ROWS: Row[] = [
  { label: 'Fornecedor A', tco: 'R$ 48.200', barPct: 0.62, status: 'winner' },
  { label: 'Fornecedor B', tco: 'R$ 51.900', barPct: 0.71, status: 'neutral' },
  { label: 'Fornecedor C', tco: 'R$ 44.500', barPct: 0.56, status: 'warn' },
];

const STATUS_COLOR: Record<Row['status'], string> = {
  winner: BRAND_CYAN,
  warn: AMBER,
  neutral: '#ffffff',
};

export function CompradorPreview() {
  const maxBar = 150;
  const rowH = 34;
  const startY = 30;
  const labelX = 8;
  const barX = 68;

  return (
    <svg
      viewBox="0 0 320 180"
      preserveAspectRatio="xMidYMid slice"
      className="w-full h-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="cpBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0f0f0f" />
          <stop offset="100%" stopColor="#070707" />
        </linearGradient>
        <radialGradient id="cpGlow" cx="0.25" cy="0.3" r="0.55">
          <stop offset="0%" stopColor={BRAND_CYAN} stopOpacity="0.12" />
          <stop offset="100%" stopColor={BRAND_CYAN} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="180" fill="url(#cpBg)" />
      <rect width="320" height="180" fill="url(#cpGlow)" />

      <text
        x={labelX}
        y="16"
        fontFamily="var(--font-outfit), system-ui, sans-serif"
        fontSize="6"
        fill="#ffffff"
        fillOpacity="0.4"
        letterSpacing="0.8"
      >
        EQUALIZAÇÃO DE PROPOSTAS · TCO
      </text>

      {ROWS.map((r, i) => {
        const y = startY + i * rowH;
        const barW = r.barPct * maxBar;
        const color = STATUS_COLOR[r.status];
        return (
          <g key={r.label}>
            <text
              x={labelX}
              y={y + 6}
              fontFamily="var(--font-outfit), system-ui, sans-serif"
              fontSize="7"
              fill="#ffffff"
              fillOpacity="0.75"
            >
              {r.label}
            </text>
            <rect
              x={barX}
              y={y + 10}
              width={maxBar}
              height={12}
              rx="2"
              fill="#ffffff"
              fillOpacity="0.04"
            />
            <rect
              x={barX}
              y={y + 10}
              width={barW}
              height={12}
              rx="2"
              fill={color}
              fillOpacity={r.status === 'winner' ? 0.85 : 0.55}
            />
            <text
              x={barX + maxBar + 6}
              y={y + 19}
              fontFamily="var(--font-outfit), system-ui, sans-serif"
              fontSize="7"
              fill={color}
              fillOpacity="0.9"
            >
              {r.tco}
            </text>

            {r.status === 'winner' && (
              <g transform={`translate(${labelX - 2}, ${y + 24})`}>
                <circle cx="4" cy="4" r="4" fill={BRAND_CYAN} fillOpacity="0.9" />
                <path
                  d="M2 4l1.4 1.6L6.2 2.4"
                  stroke="#050505"
                  strokeWidth="1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
                <text
                  x="10"
                  y="7"
                  fontFamily="var(--font-outfit), system-ui, sans-serif"
                  fontSize="5.5"
                  fill={BRAND_CYAN}
                  fillOpacity="0.85"
                >
                  melhor TCO
                </text>
              </g>
            )}
            {r.status === 'warn' && (
              <g transform={`translate(${labelX - 2}, ${y + 24})`}>
                <path d="M4 0l4 7H0z" fill={AMBER} fillOpacity="0.9" />
                <text
                  x="10"
                  y="7"
                  fontFamily="var(--font-outfit), system-ui, sans-serif"
                  fontSize="5.5"
                  fill={AMBER}
                  fillOpacity="0.85"
                >
                  sem certificação
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
