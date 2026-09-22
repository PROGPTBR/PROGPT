// Prévia do Fluxo Automatizado de Compras: a esteira de 8 etapas com o gate
// humano (AJUSTAR / SIGA) que é a marca do módulo.
export function FluxoPreview() {
  const etapas = [1, 2, 3, 4, 5, 6, 7, 8];

  return (
    <svg
      viewBox="0 0 320 150"
      className="h-full w-full"
      role="img"
      aria-label="Esteira de oito etapas com decisão do comprador a cada passo"
    >
      {/* trilhas S2C / P2P */}
      <rect x="8" y="10" width="148" height="14" rx="7" className="fill-amber-500/20" />
      <rect x="164" y="10" width="148" height="14" rx="7" className="fill-brand/20" />
      <text x="82" y="20" textAnchor="middle" className="fill-current text-[8px] opacity-70">
        S2C
      </text>
      <text x="238" y="20" textAnchor="middle" className="fill-current text-[8px] opacity-70">
        P2P
      </text>

      {/* etapas */}
      {etapas.map((n, i) => {
        const x = 8 + i * 38;
        const aprovada = n <= 3;
        const atual = n === 4;

        return (
          <g key={n}>
            <rect
              x={x}
              y={36}
              width={32}
              height={38}
              rx={6}
              className={
                aprovada
                  ? 'fill-emerald-500/25 stroke-emerald-500/50'
                  : atual
                    ? 'fill-brand/25 stroke-brand'
                    : 'fill-muted stroke-border'
              }
              strokeWidth="1"
            />
            <text
              x={x + 16}
              y={52}
              textAnchor="middle"
              className="fill-current text-[9px] font-semibold"
            >
              {n}
            </text>
            {aprovada && (
              <path
                d={`M${x + 11} 62 l3 3 l7 -7`}
                className="stroke-emerald-500"
                strokeWidth="1.8"
                fill="none"
                strokeLinecap="round"
              />
            )}
            {i < etapas.length - 1 && (
              <path
                d={`M${x + 33} 55 l4 0`}
                className="stroke-border"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            )}
          </g>
        );
      })}

      {/* gate de decisão */}
      <text x="160" y="96" textAnchor="middle" className="fill-current text-[8px] opacity-70">
        A IA executa · você decide
      </text>

      <rect x="96" y="104" width="56" height="20" rx="10" className="fill-orange-500" />
      <text x="124" y="117" textAnchor="middle" className="fill-white text-[9px] font-bold">
        AJUSTAR
      </text>

      <rect x="164" y="104" width="56" height="20" rx="10" className="fill-emerald-600" />
      <text x="192" y="117" textAnchor="middle" className="fill-white text-[9px] font-bold">
        SIGA
      </text>

      <text x="160" y="140" textAnchor="middle" className="fill-current text-[7px] opacity-50">
        Da solicitação à chegada do produto
      </text>
    </svg>
  );
}
