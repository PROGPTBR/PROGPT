// Stylized SVG do Gráfico Rápido: barras subindo a partir de dado colado,
// sugerindo "cole um dado qualquer, saia um gráfico pronto pra baixar".

const BRAND_CYAN = '#0ed1e0';
const BRAND_BLUE = '#0e8de1';

export function GraficoRapidoPreview() {
  const bars = [22, 40, 30, 52, 38];
  return (
    <svg
      viewBox="0 0 320 180"
      preserveAspectRatio="xMidYMid slice"
      className="w-full h-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="qcBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0f0f0f" />
          <stop offset="100%" stopColor="#070707" />
        </linearGradient>
        <radialGradient id="qcGlow" cx="0.5" cy="0.3" r="0.6">
          <stop offset="0%" stopColor={BRAND_CYAN} stopOpacity="0.15" />
          <stop offset="100%" stopColor={BRAND_CYAN} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="180" fill="url(#qcBg)" />
      <rect width="320" height="180" fill="url(#qcGlow)" />

      <text
        x="20"
        y="28"
        fontFamily="var(--font-outfit), system-ui, sans-serif"
        fontSize="6"
        fill="#ffffff"
        fillOpacity="0.4"
        letterSpacing="0.8"
      >
        COLE UM DADO · GERE UM GRÁFICO
      </text>

      {bars.map((h, i) => (
        <rect
          key={i}
          x={40 + i * 48}
          y={140 - h}
          width={28}
          height={h}
          rx={3}
          fill={i % 2 === 0 ? BRAND_CYAN : BRAND_BLUE}
          fillOpacity={0.85}
        />
      ))}
      <line x1="32" y1="142" x2="288" y2="142" stroke="#ffffff" strokeOpacity="0.2" strokeWidth="1.5" />
    </svg>
  );
}
