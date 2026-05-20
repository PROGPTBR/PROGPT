// Stylized SVG of a Category Profile document. Used in the spotlight
// card on /assistants. A structured doc with section headers + a "key
// fields" badge hints at "15 estruturados + reuso pelos próximos".

const BRAND_CYAN = '#0ed1e0';

export function ProfileDocPreview() {
  return (
    <svg
      viewBox="0 0 320 180"
      preserveAspectRatio="xMidYMid slice"
      className="w-full h-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="profileBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0f0f0f" />
          <stop offset="100%" stopColor="#070707" />
        </linearGradient>
        <radialGradient id="profileGlow" cx="0.3" cy="0.3" r="0.6">
          <stop offset="0%" stopColor={BRAND_CYAN} stopOpacity="0.15" />
          <stop offset="100%" stopColor={BRAND_CYAN} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="180" fill="url(#profileBg)" />
      <rect width="320" height="180" fill="url(#profileGlow)" />

      {/* Document silhouette */}
      <rect
        x="50"
        y="20"
        width="160"
        height="140"
        rx="4"
        fill="#ffffff"
        fillOpacity="0.04"
        stroke="#ffffff"
        strokeOpacity="0.08"
        strokeWidth="1"
      />

      {/* Title bar */}
      <rect x="60" y="32" width="100" height="6" rx="1" fill={BRAND_CYAN} fillOpacity="0.7" />

      {/* Section 1 lines */}
      <rect x="60" y="52" width="40" height="3" rx="1" fill="#ffffff" fillOpacity="0.3" />
      <rect x="60" y="60" width="130" height="2" rx="1" fill="#ffffff" fillOpacity="0.15" />
      <rect x="60" y="66" width="120" height="2" rx="1" fill="#ffffff" fillOpacity="0.15" />
      <rect x="60" y="72" width="100" height="2" rx="1" fill="#ffffff" fillOpacity="0.15" />

      {/* Section 2 lines */}
      <rect x="60" y="86" width="50" height="3" rx="1" fill="#ffffff" fillOpacity="0.3" />
      <rect x="60" y="94" width="125" height="2" rx="1" fill="#ffffff" fillOpacity="0.15" />
      <rect x="60" y="100" width="110" height="2" rx="1" fill="#ffffff" fillOpacity="0.15" />

      {/* Bullets */}
      <circle cx="64" cy="114" r="1.5" fill={BRAND_CYAN} fillOpacity="0.6" />
      <rect x="70" y="113" width="80" height="2" rx="1" fill="#ffffff" fillOpacity="0.2" />
      <circle cx="64" cy="122" r="1.5" fill={BRAND_CYAN} fillOpacity="0.6" />
      <rect x="70" y="121" width="95" height="2" rx="1" fill="#ffffff" fillOpacity="0.2" />
      <circle cx="64" cy="130" r="1.5" fill={BRAND_CYAN} fillOpacity="0.6" />
      <rect x="70" y="129" width="70" height="2" rx="1" fill="#ffffff" fillOpacity="0.2" />

      {/* Footer line */}
      <rect x="60" y="146" width="60" height="2" rx="1" fill="#ffffff" fillOpacity="0.1" />

      {/* "15 estruturados" badge */}
      <g transform="translate(225, 60)">
        <rect width="75" height="58" rx="6" fill={BRAND_CYAN} fillOpacity="0.08" stroke={BRAND_CYAN} strokeOpacity="0.3" strokeWidth="0.8" />
        <text x="37.5" y="22" textAnchor="middle" fontFamily="var(--font-outfit), system-ui, sans-serif" fontSize="20" fontWeight="600" fill={BRAND_CYAN} fillOpacity="0.9">
          15
        </text>
        <text x="37.5" y="35" textAnchor="middle" fontFamily="var(--font-outfit), system-ui, sans-serif" fontSize="6" fill="#ffffff" fillOpacity="0.5" letterSpacing="0.8">
          CAMPOS
        </text>
        <text x="37.5" y="46" textAnchor="middle" fontFamily="var(--font-outfit), system-ui, sans-serif" fontSize="6" fill="#ffffff" fillOpacity="0.5" letterSpacing="0.8">
          ESTRUTURADOS
        </text>
      </g>

      {/* Footer caption */}
      <text x="160" y="172" textAnchor="middle" fontFamily="var(--font-outfit), system-ui, sans-serif" fontSize="6" fill="#ffffff" fillOpacity="0.4" letterSpacing="1">
        PERFIL DA CATEGORIA · STRATEGIC SOURCING STEP 1
      </text>
    </svg>
  );
}
