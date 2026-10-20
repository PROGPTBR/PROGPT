// Card do hub do Mapa de Fornecedores da Operação: ruas estilizadas com
// pinos coloridos por categoria e rótulos, lembrando o mapa da tela.

const PINOS = [
  { x: 70, y: 52, cor: '#0ea5e9', nome: 'Broadcast' },
  { x: 168, y: 40, cor: '#f97316', nome: 'Nobreaks' },
  { x: 228, y: 88, cor: '#22c55e', nome: 'TI e cloud' },
  { x: 118, y: 108, cor: '#a855f7', nome: 'Gráfica' },
  { x: 205, y: 140, cor: '#ef4444', nome: 'Segurança' },
  { x: 58, y: 142, cor: '#eab308', nome: 'Facilities' },
];

export function MapaFornecedoresPreview() {
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" className="w-full h-full" aria-hidden="true">
      <rect width="320" height="180" fill="#0d1117" />
      <g stroke="#ffffff" strokeOpacity="0.09" strokeWidth="6" fill="none" strokeLinecap="round">
        <path d="M-10 70 C80 60 160 95 330 80" />
        <path d="M90 -10 C100 60 150 120 140 200" />
        <path d="M200 -10 C190 60 240 120 260 200" />
      </g>
      <g stroke="#ffffff" strokeOpacity="0.05" strokeWidth="2" fill="none">
        <path d="M-10 30 L330 45 M-10 120 L330 130 M-10 160 L330 150 M40 -10 L60 200 M300 -10 L280 200" />
      </g>
      <g fontFamily="var(--font-outfit), system-ui, sans-serif">
        {PINOS.map((p) => (
          <g key={p.nome} transform={`translate(${p.x}, ${p.y})`}>
            <circle r="6" fill={p.cor} stroke="#fff" strokeWidth="2" />
            <rect x="10" y="-8" width={p.nome.length * 5.6 + 12} height="16" rx="8" fill="#ffffff" fillOpacity="0.92" />
            <text x="16" y="4" fontSize="9" fill="#111">
              {p.nome}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}
