// Stylized SVG preview da busca de fornecedores — usado no spotlight card
// do hub `/assistants`. Não é screenshot real: ilustra uma lista de cards
// de empresas com CNPJ, razão social, badges de CNAE e UF.

const BRAND_CYAN = '#0ed1e0';

type CardData = {
  y: number;
  name: string;
  cnae: string;
  uf: string;
  porte: string;
  porteWidth: number;
};

const CARDS: CardData[] = [
  { y: 28, name: 'Indústria Plástica BR', cnae: '2222-6/00', uf: 'BA', porte: 'EPP', porteWidth: 18 },
  { y: 76, name: 'Embalagens do Nordeste', cnae: '2222-6/00', uf: 'PE', porte: 'DEMAIS', porteWidth: 30 },
  { y: 124, name: 'Plásticos Pernambuco', cnae: '2229-3/02', uf: 'PE', porte: 'ME', porteWidth: 14 },
];

export function SuppliersPreview() {
  return (
    <svg
      viewBox="0 0 320 180"
      preserveAspectRatio="xMidYMid slice"
      className="w-full h-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="suppBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0f0f0f" />
          <stop offset="100%" stopColor="#070707" />
        </linearGradient>
        <radialGradient id="suppGlow" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0%" stopColor={BRAND_CYAN} stopOpacity="0.15" />
          <stop offset="100%" stopColor={BRAND_CYAN} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="180" fill="url(#suppBg)" />
      <rect width="320" height="180" fill="url(#suppGlow)" />

      {/* Search bar hint at top */}
      <g>
        <rect
          x="16"
          y="8"
          width="288"
          height="12"
          rx="6"
          fill="#1a1a1a"
          stroke={BRAND_CYAN}
          strokeOpacity="0.4"
          strokeWidth="0.8"
        />
        <circle cx="24" cy="14" r="2" fill={BRAND_CYAN} fillOpacity="0.7" />
        <rect x="32" y="12.5" width="80" height="3" fill="#ffffff" fillOpacity="0.25" />
        <rect x="118" y="12.5" width="60" height="3" fill="#ffffff" fillOpacity="0.15" />
      </g>

      {/* Supplier cards */}
      {CARDS.map((c) => (
        <g key={c.name}>
          <rect
            x="16"
            y={c.y}
            width="288"
            height="40"
            rx="4"
            fill="#141414"
            stroke="#ffffff"
            strokeOpacity="0.08"
            strokeWidth="0.8"
          />
          {/* CNPJ accent dot */}
          <circle cx="26" cy={c.y + 14} r="2" fill={BRAND_CYAN} fillOpacity="0.5" />
          {/* Razão social */}
          <text
            x="34"
            y={c.y + 16}
            fontFamily="var(--font-outfit), system-ui, sans-serif"
            fontSize="6"
            fontWeight="600"
            fill="#ffffff"
            fillOpacity="0.85"
          >
            {c.name}
          </text>
          {/* CNAE + UF row */}
          <rect
            x="34"
            y={c.y + 22}
            width="36"
            height="8"
            rx="2"
            fill={BRAND_CYAN}
            fillOpacity="0.12"
            stroke={BRAND_CYAN}
            strokeOpacity="0.3"
            strokeWidth="0.5"
          />
          <text
            x="52"
            y={c.y + 27.5}
            textAnchor="middle"
            fontFamily="ui-monospace, monospace"
            fontSize="4.5"
            fill={BRAND_CYAN}
            fillOpacity="0.8"
          >
            {c.cnae}
          </text>
          <rect
            x="74"
            y={c.y + 22}
            width="14"
            height="8"
            rx="2"
            fill="#ffffff"
            fillOpacity="0.05"
          />
          <text
            x="81"
            y={c.y + 27.5}
            textAnchor="middle"
            fontFamily="var(--font-outfit), system-ui, sans-serif"
            fontSize="4.5"
            fontWeight="600"
            fill="#ffffff"
            fillOpacity="0.6"
          >
            {c.uf}
          </text>
          {/* Porte badge right side */}
          <rect
            x={300 - c.porteWidth}
            y={c.y + 8}
            width={c.porteWidth}
            height="8"
            rx="4"
            fill={BRAND_CYAN}
            fillOpacity="0.18"
            stroke={BRAND_CYAN}
            strokeOpacity="0.4"
            strokeWidth="0.5"
          />
          <text
            x={300 - c.porteWidth / 2}
            y={c.y + 13.5}
            textAnchor="middle"
            fontFamily="var(--font-outfit), system-ui, sans-serif"
            fontSize="3.8"
            fontWeight="600"
            fill={BRAND_CYAN}
            fillOpacity="0.9"
            letterSpacing="0.3"
          >
            {c.porte}
          </text>
        </g>
      ))}
    </svg>
  );
}
