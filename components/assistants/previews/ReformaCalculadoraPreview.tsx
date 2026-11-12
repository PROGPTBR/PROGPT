// Card do hub da Calculadora da Reforma: um item com CBS e IBS do motor
// oficial subindo de 2026 a 2033 e o selo de cálculo oficial.

const BRAND_CYAN = '#0ed1e0';

const ANOS = [
  { ano: '2026', v: 0.04 },
  { ano: '2027', v: 0.33 },
  { ano: '2029', v: 0.4 },
  { ano: '2031', v: 0.53 },
  { ano: '2033', v: 1 },
];

export function ReformaCalculadoraPreview() {
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" className="w-full h-full" aria-hidden="true">
      <defs>
        <linearGradient id="reformaBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0f0f0f" />
          <stop offset="100%" stopColor="#070707" />
        </linearGradient>
      </defs>
      <rect width="320" height="180" fill="url(#reformaBg)" />
      <g fontFamily="var(--font-outfit), system-ui, sans-serif">
        <text x="24" y="28" fontSize="7" fill="#ffffff" fillOpacity="0.45" letterSpacing="0.8">
          CBS + IBS POR ITEM · MOTOR OFICIAL
        </text>
        <rect x="200" y="17" width="96" height="16" rx="8" fill={BRAND_CYAN} fillOpacity="0.15" />
        <text x="248" y="28" fontSize="7" fill={BRAND_CYAN} textAnchor="middle">
          Receita Federal
        </text>
        {ANOS.map((a, i) => {
          const x = 40 + i * 52;
          const h = 100 * a.v;
          return (
            <g key={a.ano}>
              <rect x={x} y={152 - h} width="28" height={h} rx="4" fill={BRAND_CYAN} fillOpacity={i === ANOS.length - 1 ? 1 : 0.35 + i * 0.12} />
              <text x={x + 14} y="166" fontSize="8" fill="#ffffff" fillOpacity="0.6" textAnchor="middle">
                {a.ano}
              </text>
            </g>
          );
        })}
        <text x="24" y="52" fontSize="9" fill="#ffffff" fillOpacity="0.85">
          Cimento CP II · redução 0%
        </text>
        <text x="24" y="64" fontSize="8" fill="#ffffff" fillOpacity="0.5">
          26,5% em 2033 · volta como crédito
        </text>
      </g>
    </svg>
  );
}
