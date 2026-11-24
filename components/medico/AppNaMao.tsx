'use client';

import { useEffect, useState } from 'react';
import { Banknote, Check, FileSpreadsheet, MessageCircle, Pause, Play, Stethoscope } from 'lucide-react';

// Demonstração animada e interativa da Área Médica (sub-projeto 104): o app
// no celular, na mão do médico. Passa sozinha como um vídeo (4 cenas) e
// responde ao toque: clicar numa cena pula para ela, e dá para pausar.
// Tudo desenhado em código (sem arquivo de vídeo), com dados fictícios.

const DURACAO_MS = 5200;

const CENAS = [
  { id: 'cirurgia', titulo: 'Fez a cirurgia', texto: 'Avise no grupo de WhatsApp, como já faz hoje. O app lê e registra sozinho.', icone: MessageCircle },
  { id: 'conferencia', titulo: 'O hospital mandou o demonstrativo', texto: 'O app confere linha por linha com as suas cirurgias e mostra o que ficou de fora.', icone: Check },
  { id: 'cobranca', titulo: 'Ficou cirurgia sem pagar', texto: 'A planilha de pendências sai pronta, no modelo do hospital, e o app cobra de novo até entrar.', icone: FileSpreadsheet },
  { id: 'pagamento', titulo: 'O dinheiro caiu', texto: 'O banco avisa, a nota é marcada como paga e você vê o mês inteiro num gráfico.', icone: Banknote },
] as const;

export function AppNaMao() {
  const [cena, setCena] = useState(0);
  const [tocando, setTocando] = useState(true);
  // Reinicia a animação de progresso a cada troca de cena.
  const [volta, setVolta] = useState(0);

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) setTocando(false);
  }, []);

  useEffect(() => {
    if (!tocando) return;
    const t = setTimeout(() => {
      setCena((c) => (c + 1) % CENAS.length);
      setVolta((v) => v + 1);
    }, DURACAO_MS);
    return () => clearTimeout(t);
  }, [cena, tocando, volta]);

  function ir(i: number) {
    setCena(i);
    setVolta((v) => v + 1);
  }

  const atual = CENAS[cena]!;

  return (
    <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-center lg:gap-10">
      <style>{`
        @keyframes am-sobe { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        @keyframes am-barra { from { transform: scaleY(0); } to { transform: scaleY(1); } }
        @keyframes am-progresso { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes am-flutua { 0%, 100% { transform: translateY(0) rotate(-4deg); } 50% { transform: translateY(-8px) rotate(-3deg); } }
        .am-item { animation: am-sobe 0.5s ease-out both; }
        @media (prefers-reduced-motion: reduce) { .am-item, .am-mao { animation: none !important; } }
      `}</style>

      {/* O celular na mão */}
      <div className="am-mao relative shrink-0" style={{ animation: 'am-flutua 6s ease-in-out infinite' }}>
        <svg aria-hidden viewBox="0 0 320 560" className="absolute -left-10 top-10 h-[520px] w-[300px] text-foreground/10" fill="currentColor">
          {/* palma e dedos atrás do aparelho */}
          <rect x="60" y="250" width="230" height="300" rx="90" />
          <rect x="262" y="150" width="46" height="170" rx="23" />
          <rect x="262" y="330" width="46" height="110" rx="23" />
          <rect x="18" y="300" width="60" height="150" rx="30" transform="rotate(-18 48 375)" />
        </svg>
        <button
          type="button"
          onClick={() => ir((cena + 1) % CENAS.length)}
          aria-label="Avançar a demonstração"
          className="relative block h-[500px] w-[250px] rounded-[2.6rem] border-[10px] border-neutral-900 bg-background text-left shadow-2xl dark:border-neutral-700"
        >
          <span aria-hidden className="absolute left-1/2 top-2 h-5 w-24 -translate-x-1/2 rounded-full bg-neutral-900 dark:bg-neutral-700" />
          <div key={`${cena}-${volta}`} className="flex h-full flex-col overflow-hidden rounded-[1.9rem] px-4 pb-4 pt-10">
            <Tela cena={atual.id} />
          </div>
        </button>
      </div>

      {/* Capítulos: o que está passando, clicável */}
      <div className="w-full max-w-md">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand">Veja em 20 segundos</p>
          <button
            type="button"
            onClick={() => setTocando((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium hover:bg-muted"
          >
            {tocando ? <Pause className="h-3.5 w-3.5" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />}
            {tocando ? 'Pausar' : 'Continuar'}
          </button>
        </div>
        <ol className="space-y-2">
          {CENAS.map((c, i) => {
            const ativa = i === cena;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => ir(i)}
                  aria-current={ativa ? 'step' : undefined}
                  className={`relative w-full overflow-hidden rounded-2xl border px-4 py-3 text-left transition ${ativa ? 'border-brand/50 bg-brand/5' : 'border-border hover:bg-muted/60'}`}
                >
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <c.icone className={`h-4 w-4 ${ativa ? 'text-brand' : 'text-muted-foreground'}`} aria-hidden />
                    {c.titulo}
                  </span>
                  {ativa && <span className="mt-1 block text-sm text-muted-foreground">{c.texto}</span>}
                  {ativa && tocando && (
                    <span key={volta} aria-hidden className="absolute bottom-0 left-0 h-0.5 w-full origin-left bg-brand" style={{ animation: `am-progresso ${DURACAO_MS}ms linear both` }} />
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

const atraso = (i: number) => ({ animationDelay: `${i * 0.35}s` });

function Tela({ cena }: { cena: (typeof CENAS)[number]['id'] }) {
  if (cena === 'cirurgia') {
    return (
      <>
        <Cabecalho titulo="Grupo das cirurgias" />
        <div className="am-item ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-emerald-500/15 px-3 py-2 text-xs" style={atraso(0)}>
          Feita hoje no hospital: joelho do paciente das 8h, Bradesco, 2º auxiliar
        </div>
        <div className="am-item mt-2 mr-auto max-w-[85%] rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-xs" style={atraso(1)}>
          Ok doutor, anotado
        </div>
        <div className="am-item mt-auto rounded-2xl border border-brand/40 bg-brand/5 p-3" style={atraso(3)}>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-brand">
            <Stethoscope className="h-3.5 w-3.5" aria-hidden /> Cirurgia registrada
          </p>
          <p className="mt-1 text-xs font-medium">Reconstrução de ligamento</p>
          <p className="text-[11px] text-muted-foreground">Hoje · Bradesco · 2º auxiliar</p>
        </div>
      </>
    );
  }
  if (cena === 'conferencia') {
    const linhas = [
      ['09/07', 'Ligamento', true],
      ['16/07', 'Manguito rotador', true],
      ['16/07', 'Fratura de punho', true],
      ['30/07', 'Fratura de fêmur', false],
      ['30/07', 'Menisco', false],
    ] as const;
    return (
      <>
        <Cabecalho titulo="Demonstrativo de julho" />
        <ul className="space-y-1.5">
          {linhas.map(([data, nome, pago], i) => (
            <li key={i} className="am-item flex items-center gap-2 rounded-xl border border-border px-2.5 py-2 text-xs" style={atraso(i)}>
              <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${pago ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-red-500/20 text-red-700 dark:text-red-300'}`}>
                {pago ? '✓' : '!'}
              </span>
              <span className="min-w-0 flex-1 truncate">{nome}</span>
              <span className="text-[10px] text-muted-foreground">{data}</span>
            </li>
          ))}
        </ul>
        <p className="am-item mt-auto rounded-xl bg-red-500/10 px-3 py-2 text-xs font-medium text-red-800 dark:text-red-200" style={atraso(6)}>
          2 cirurgias suas ficaram de fora
        </p>
      </>
    );
  }
  if (cena === 'cobranca') {
    return (
      <>
        <Cabecalho titulo="Pendências a cobrar" />
        <div className="am-item rounded-2xl border border-border p-3" style={atraso(0)}>
          <p className="flex items-center gap-1.5 text-xs font-semibold">
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" aria-hidden /> Levantamento de pendências
          </p>
          <div className="mt-2 space-y-1">
            {[0, 1].map((i) => (
              <div key={i} className="grid grid-cols-[2.4rem_1fr_3rem] gap-1">
                {[0, 1, 2].map((k) => (
                  <span key={k} className="h-3 rounded bg-muted" />
                ))}
              </div>
            ))}
          </div>
        </div>
        <p className="am-item mt-3 text-xs" style={atraso(2)}>
          <span className="font-semibold">Enviada ao hospital</span>
          <span className="block text-muted-foreground">Cobrada 2 vezes, sem resposta há 31 dias</span>
        </p>
        <div className="am-item mt-auto rounded-full bg-brand px-4 py-2.5 text-center text-xs font-semibold text-white" style={atraso(4)}>
          Cobrar de novo
        </div>
      </>
    );
  }
  const barras = [38, 52, 44, 70, 58, 92];
  return (
    <>
      <Cabecalho titulo="Banco" />
      <p className="am-item text-[11px] text-muted-foreground" style={atraso(0)}>
        Entrou neste mês
      </p>
      <p className="am-item text-2xl font-semibold tracking-tight" style={atraso(0)}>
        R$ 38.400,00
      </p>
      <div className="am-item mt-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-200" style={atraso(1)}>
        <span className="font-semibold">+ R$ 7.900,00</span> agora · nota 1058 paga
      </div>
      <div className="mt-auto flex h-28 items-end gap-2" aria-hidden>
        {barras.map((h, i) => (
          <span
            key={i}
            className={`flex-1 origin-bottom rounded-t-md ${i === barras.length - 1 ? 'bg-brand' : 'bg-brand/30'}`}
            style={{ height: `${h}%`, animation: `am-barra 0.7s ease-out ${0.6 + i * 0.12}s both` }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[9px] text-muted-foreground" aria-hidden>
        {['jun', 'jul', 'ago', 'set', 'out', 'nov'].map((m) => (
          <span key={m} className="flex-1 text-center">
            {m}
          </span>
        ))}
      </div>
    </>
  );
}

function Cabecalho({ titulo }: { titulo: string }) {
  return <p className="mb-3 text-sm font-semibold">{titulo}</p>;
}
