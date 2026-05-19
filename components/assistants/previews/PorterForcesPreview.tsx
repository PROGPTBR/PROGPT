// Stylized SVG of the 5-Forces output. Used in the spotlight card on
// /assistants. Not a real screenshot — an illustration that reads as
// "this assistant produces a 5-forces analysis with intensity per
// force".
//
// Layout: central node "categoria" with 5 surrounding force boxes
// (rivalry center, two suppliers/buyers on sides, new entrants top,
// substitutes bottom). Each box has a small intensity bar (filled
// brand-cyan) hinting at the classification output.

const BRAND_CYAN = '#0ed1e0';

type Force = {
  label: string;
  x: number;
  y: number;
  intensity: number; // 0..1
};

const FORCES: Force[] = [
  { label: 'NOVOS ENTRANTES', x: 160, y: 24, intensity: 0.4 },
  { label: 'PODER COMPRADOR', x: 38, y: 92, intensity: 0.7 },
  { label: 'PODER FORNECEDOR', x: 282, y: 92, intensity: 0.85 },
  { label: 'SUBSTITUTOS', x: 160, y: 156, intensity: 0.3 },
];

export function PorterForcesPreview() {
  return (
    <svg
      viewBox="0 0 320 180"
      preserveAspectRatio="xMidYMid slice"
      className="w-full h-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ptBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0f0f0f" />
          <stop offset="100%" stopColor="#070707" />
        </linearGradient>
        <radialGradient id="ptGlow" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0%" stopColor={BRAND_CYAN} stopOpacity="0.15" />
          <stop offset="100%" stopColor={BRAND_CYAN} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="180" fill="url(#ptBg)" />
      <rect width="320" height="180" fill="url(#ptGlow)" />

      {/* Center node — Rivalidade */}
      <g>
        <rect
          x="120"
          y="76"
          width="80"
          height="28"
          rx="4"
          fill="#1a1a1a"
          stroke={BRAND_CYAN}
          strokeOpacity="0.7"
          strokeWidth="1.5"
        />
        <text
          x="160"
          y="89"
          textAnchor="middle"
          fontFamily="var(--font-outfit), system-ui, sans-serif"
          fontSize="6"
          fill="#ffffff"
          fillOpacity="0.4"
          letterSpacing="0.5"
        >
          RIVALIDADE
        </text>
        <rect x="128" y="93" width="64" height="3" fill="#ffffff" fillOpacity="0.1" />
        <rect x="128" y="93" width="38" height="3" fill={BRAND_CYAN} fillOpacity="0.85" />
      </g>

      {/* Outer force boxes connected by dashed cyan lines */}
      <g
        stroke={BRAND_CYAN}
        strokeOpacity="0.25"
        strokeWidth="1"
        strokeDasharray="2 2"
        fill="none"
      >
        <line x1="160" y1="76" x2="160" y2="40" />
        <line x1="120" y1="90" x2="78" y2="92" />
        <line x1="200" y1="90" x2="242" y2="92" />
        <line x1="160" y1="104" x2="160" y2="140" />
      </g>

      {FORCES.map((f) => (
        <g key={f.label}>
          <rect
            x={f.x - 38}
            y={f.y - 12}
            width="76"
            height="24"
            rx="3"
            fill="#141414"
            stroke="#ffffff"
            strokeOpacity="0.1"
            strokeWidth="0.8"
          />
          <text
            x={f.x}
            y={f.y - 2}
            textAnchor="middle"
            fontFamily="var(--font-outfit), system-ui, sans-serif"
            fontSize="5"
            fill="#ffffff"
            fillOpacity="0.45"
            letterSpacing="0.4"
          >
            {f.label}
          </text>
          {/* Intensity bar */}
          <rect
            x={f.x - 30}
            y={f.y + 4}
            width="60"
            height="2.5"
            fill="#ffffff"
            fillOpacity="0.08"
          />
          <rect
            x={f.x - 30}
            y={f.y + 4}
            width={60 * f.intensity}
            height="2.5"
            fill={BRAND_CYAN}
            fillOpacity={0.5 + f.intensity * 0.4}
          />
        </g>
      ))}
    </svg>
  );
}
