// Card do hub da Análise Tributária de Propostas: três propostas com o
// custo líquido em barras, "hoje" e "2033", e a virada de vencedor na reforma.

const BRAND_CYAN = '#0ed1e0';

const PROPOSTAS = [
  { nome: 'Fornecedor A', hoje: 0.62, reforma: 0.78 },
  { nome: 'Fornecedor B', hoje: 0.7, reforma: 0.55 },
  { nome: 'Fornecedor C', hoje: 0.8, reforma: 0.74 },
];

export function TributarioPropostasPreview() {
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" className="w-full h-full" aria-hidden="true">
      <defs>
        <linearGradient id="tribBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0f0f0f" />
          <stop offset="100%" stopColor="#070707" />
        </linearGradient>
      </defs>
      <rect width="320" height="180" fill="url(#tribBg)" />
      <g fontFamily="var(--font-outfit), system-ui, sans-serif">
        <text x="24" y="28" fontSize="7" fill="#ffffff" fillOpacity="0.45" letterSpacing="0.8">
          CUSTO LÍQUIDO DE IMPOSTOS
        </text>
        <g transform="translate(118, 40)">
          <rect width="8" height="8" rx="2" fill="#ffffff" fillOpacity="0.35" />
          <text x="12" y="7" fontSize="7" fill="#ffffff" fillOpacity="0.6">Hoje</text>
          <rect x="44" width="8" height="8" rx="2" fill={BRAND_CYAN} />
          <text x="56" y="7" fontSize="7" fill="#ffffff" fillOpacity="0.6">2033 (IBS + CBS)</text>
        </g>
        {PROPOSTAS.map((p, i) => {
          const y = 62 + i * 36;
          const vence = i === 1;
          return (
            <g key={p.nome}>
              <text x="24" y={y + 12} fontSize="9" fill="#ffffff" fillOpacity={vence ? 0.95 : 0.65}>
                {p.nome}
              </text>
              <rect x="118" y={y} width={170 * p.hoje} height="9" rx="3" fill="#ffffff" fillOpacity="0.3" />
              <rect x="118" y={y + 12} width={170 * p.reforma} height="9" rx="3" fill={BRAND_CYAN} fillOpacity={vence ? 1 : 0.45} />
              {vence && (
                <text x={124 + 170 * p.reforma} y={y + 20} fontSize="7" fill={BRAND_CYAN}>
                  melhor
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
