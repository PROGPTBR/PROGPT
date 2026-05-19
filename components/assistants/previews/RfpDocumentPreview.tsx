// Stylized SVG of an RFP/RFQ document output. Used in the spotlight
// card on /assistants. Not a real screenshot — an illustration that
// reads as "this assistant produces a polished document with cover,
// body sections, and a quotation table".

const BRAND_CYAN = '#0ed1e0';

// Body lines — varying widths to suggest paragraphs of prose.
const BODY_LINES: Array<{ y: number; w: number; opacity: number }> = [
  { y: 78, w: 110, opacity: 0.7 },
  { y: 86, w: 90, opacity: 0.55 },
  { y: 94, w: 100, opacity: 0.6 },
  { y: 102, w: 70, opacity: 0.45 },
];

// Quotation table rows at the bottom of the page.
const TABLE_ROWS = [120, 128, 136];

export function RfpDocumentPreview() {
  return (
    <svg
      viewBox="0 0 320 180"
      preserveAspectRatio="xMidYMid slice"
      className="w-full h-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="rfpBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0f0f0f" />
          <stop offset="100%" stopColor="#070707" />
        </linearGradient>
        <radialGradient id="rfpGlow" cx="0.3" cy="0.2" r="0.6">
          <stop offset="0%" stopColor={BRAND_CYAN} stopOpacity="0.15" />
          <stop offset="100%" stopColor={BRAND_CYAN} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="180" fill="url(#rfpBg)" />
      <rect width="320" height="180" fill="url(#rfpGlow)" />

      {/* Page silhouette (A4-ish, centered) */}
      <g>
        {/* Page shadow */}
        <rect
          x="98"
          y="22"
          width="124"
          height="138"
          rx="4"
          fill="#000000"
          fillOpacity="0.4"
        />
        {/* Page surface */}
        <rect
          x="96"
          y="20"
          width="124"
          height="138"
          rx="4"
          fill="#1a1a1a"
          stroke="#ffffff"
          strokeOpacity="0.08"
          strokeWidth="1"
        />

        {/* Top accent stripe — brand cyan */}
        <rect
          x="96"
          y="20"
          width="124"
          height="3"
          fill={BRAND_CYAN}
          fillOpacity="0.9"
        />

        {/* Logo placeholder square */}
        <rect
          x="104"
          y="32"
          width="14"
          height="14"
          rx="1"
          fill="#ffffff"
          fillOpacity="0.12"
        />
        {/* Tiny accent dot in logo (mimics 2B Supply logo's cyan) */}
        <circle cx="111" cy="39" r="2" fill={BRAND_CYAN} fillOpacity="0.7" />

        {/* Cover title — wide bold-ish bar */}
        <rect
          x="124"
          y="34"
          width="80"
          height="4"
          rx="0.5"
          fill="#ffffff"
          fillOpacity="0.6"
        />
        <rect
          x="124"
          y="41"
          width="50"
          height="2.5"
          rx="0.5"
          fill="#ffffff"
          fillOpacity="0.35"
        />

        {/* Section divider */}
        <line
          x1="104"
          y1="60"
          x2="212"
          y2="60"
          stroke="#ffffff"
          strokeOpacity="0.1"
          strokeWidth="0.5"
        />

        {/* Section heading */}
        <rect
          x="104"
          y="66"
          width="40"
          height="3"
          rx="0.5"
          fill={BRAND_CYAN}
          fillOpacity="0.7"
        />

        {/* Body paragraph lines */}
        {BODY_LINES.map((l, i) => (
          <rect
            key={`body-${i}`}
            x="104"
            y={l.y}
            width={l.w}
            height="1.5"
            rx="0.5"
            fill="#ffffff"
            fillOpacity={l.opacity}
          />
        ))}

        {/* Cotação table header bar */}
        <rect
          x="104"
          y="114"
          width="108"
          height="3"
          rx="0.5"
          fill="#ffffff"
          fillOpacity="0.18"
        />
        {/* Cotação table rows (vertical dividers + horizontal lines) */}
        {TABLE_ROWS.map((y) => (
          <g key={`row-${y}`}>
            <line
              x1="104"
              y1={y}
              x2="212"
              y2={y}
              stroke="#ffffff"
              strokeOpacity="0.08"
              strokeWidth="0.5"
            />
          </g>
        ))}
        {/* Column dividers */}
        {[132, 158, 184].map((x) => (
          <line
            key={`col-${x}`}
            x1={x}
            y1="117"
            x2={x}
            y2="146"
            stroke="#ffffff"
            strokeOpacity="0.06"
            strokeWidth="0.5"
          />
        ))}

        {/* Footer page number */}
        <text
          x="158"
          y="153"
          textAnchor="middle"
          fontFamily="var(--font-outfit), system-ui, sans-serif"
          fontSize="4"
          fill="#ffffff"
          fillOpacity="0.4"
          letterSpacing="0.8"
        >
          RFP/RFQ
        </text>
      </g>
    </svg>
  );
}
