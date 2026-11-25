'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Stethoscope } from 'lucide-react';

import { ETAPA_LABEL } from '@/lib/medico/conciliacao';
import { ciclosMensais, destaques, mural, nomeDoMes, notasEmAndamento, topParaCobrar, type Destino } from '@/lib/medico/cockpit';
import type { EstadoMedico } from '@/lib/medico/types';

// Cockpit da Área Médica (sub-projeto 114): a tela de entrada, no formato de
// vitrine. Um destaque grande por vez no topo, trocando sozinho, e fileiras
// que deslizam de lado. Pouco texto: número grande, uma linha e um botão.
// O formato é o do mural do CRM da casa; cores e marca são da Área Médica.

const SEGUNDOS = 8;
const CSS = `
@keyframes ck-entra { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: none } }
@keyframes ck-barra { from { transform: scaleX(0) } to { transform: scaleX(1) } }
.ck-texto { animation: ck-entra .6s ease-out both; }
.ck-barra { transform-origin: left; animation: ck-barra linear both; }
.ck-linha { scrollbar-width: none; }
.ck-linha::-webkit-scrollbar { display: none; }
.ck-num { font-weight: 900; line-height: .8; letter-spacing: -.08em; color: transparent; -webkit-text-stroke: 3px rgba(255,255,255,.55); }
@media (prefers-reduced-motion: reduce) { .ck-texto, .ck-barra { animation: none !important; } }
`;

const TOM = {
  azul: 'from-medico-escuro via-medico to-medico-claro',
  vermelho: 'from-[#3b0a14] via-[#8f1d2c] to-[#e11d48]',
  verde: 'from-[#06281f] via-[#0f6b4f] to-[#10b981]',
} as const;

export function Cockpit({ estado, hoje, entrar }: { estado: Omit<EstadoMedico, 'integracoes'>; hoje: string; entrar: (destino: Destino) => void }) {
  const slides = useMemo(() => destaques(estado, hoje), [estado, hoje]);
  const hospitais = useMemo(() => mural(estado, hoje), [estado, hoje]);
  const top = useMemo(() => topParaCobrar(estado, hoje), [estado, hoje]);
  const notas = useMemo(() => notasEmAndamento(estado), [estado]);
  const meses = useMemo(() => ciclosMensais(estado.cirurgias, estado.demonstrativos, hoje, estado.hospitais, 6), [estado, hoje]);
  const [i, setI] = useState(0);
  const [pausa, setPausa] = useState(false);

  useEffect(() => {
    if (pausa || slides.length < 2) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const t = setTimeout(() => setI((x) => (x + 1) % slides.length), SEGUNDOS * 1000);
    return () => clearTimeout(t);
  }, [i, pausa, slides.length]);

  const k = slides.length ? i % slides.length : 0;
  const s = slides[k];
  const nome = estado.config.medico_nome.split(' ').slice(0, 2).join(' ');

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-[#061230] text-white">
      <style>{CSS}</style>

      {/* Banner: um destaque por vez, tela cheia */}
      {s && (
        <section
          className={`relative flex min-h-[78svh] w-full flex-col overflow-hidden bg-gradient-to-br ${TOM[s.tom]} transition-colors duration-700`}
          onMouseEnter={() => setPausa(true)}
          onMouseLeave={() => setPausa(false)}
        >
          <svg aria-hidden viewBox="0 0 1600 500" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] w-full opacity-25">
            <path d="M0 380 C 240 350, 360 180, 600 240 S 1000 420, 1200 210 S 1480 80, 1600 130 L1600 500 L0 500 Z" fill="white" fillOpacity="0.15" />
            <path d="M0 380 C 240 350, 360 180, 600 240 S 1000 420, 1200 210 S 1480 80, 1600 130" fill="none" stroke="white" strokeWidth="2" />
          </svg>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#061230] to-transparent" />

          <header className="relative flex items-center justify-between px-5 pt-5 sm:px-10 lg:px-14">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-white/15 ring-1 ring-white/25">
                <Stethoscope className="h-5 w-5" aria-hidden />
              </span>
              {nome || 'Área Médica'}
            </span>
            <button type="button" onClick={() => entrar('visao')} className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-medico-escuro hover:bg-white/90">
              Entrar <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </header>

          <div key={s.id} className="relative mt-auto px-5 pb-24 sm:px-10 sm:pb-28 lg:px-14">
            <p className="ck-texto text-[13px] font-bold uppercase tracking-[0.2em] text-white/80">{s.selo}</p>
            <h1 className="ck-texto mt-2 font-black leading-[.92] tracking-tight" style={{ fontSize: 'clamp(2.6rem, 8vw, 6.5rem)', animationDelay: '.08s' }}>
              {s.titulo}
            </h1>
            {s.apoio && (
              <p className="ck-texto mt-3 text-base text-white/85 sm:text-lg" style={{ animationDelay: '.16s' }}>
                {s.apoio}
              </p>
            )}
            <button
              type="button"
              onClick={() => entrar(s.destino)}
              className="ck-texto mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-bold text-neutral-900 hover:bg-white/90"
              style={{ animationDelay: '.24s' }}
            >
              {s.acao} <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </div>

          {slides.length > 1 && (
            <div className="absolute bottom-12 left-5 flex gap-1.5 sm:left-10 lg:left-14">
              {slides.map((x, j) => (
                <button key={x.id} type="button" onClick={() => setI(j)} aria-label={x.selo} aria-current={j === k} className="h-1 w-9 overflow-hidden rounded-full bg-white/25">
                  {j === k && <span className="ck-barra block h-full bg-white" style={{ animationDuration: `${SEGUNDOS}s`, animationPlayState: pausa ? 'paused' : 'running' }} />}
                  {j < k && <span className="block h-full bg-white/70" />}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Fileiras */}
      <div className="relative -mt-6 space-y-9 px-5 pb-16 sm:px-10 lg:px-14">
        {hospitais.length > 0 && (
          <Fileira titulo="Mural dos hospitais">
            {hospitais.map((h, n) => (
              <button
                key={h.id}
                type="button"
                onClick={() => entrar(h.paraCobrar > 0 ? 'pendencias' : 'demonstrativos')}
                className={`group relative h-[230px] w-[190px] shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br text-left transition hover:scale-[1.03] ${n === 0 ? 'from-medico-claro to-medico' : 'from-[#16306b] to-[#0c1c45]'}`}
              >
                <span aria-hidden className="absolute -right-3 -top-6 text-[9rem] font-black leading-none text-white/10">
                  {h.nome.replace(/^hospital\s+/i, '').slice(0, 1).toUpperCase()}
                </span>
                {h.paraCobrar > 0 && <span className="absolute left-3 top-3 rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold">{h.paraCobrar} para cobrar</span>}
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-12">
                  <span className="block truncate text-base font-black uppercase leading-tight">{h.nome}</span>
                  <span className="block text-sm font-semibold text-emerald-300">{h.aReceber.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  <span className="block text-[11px] text-white/60">{h.cirurgias} cirurgias</span>
                </span>
              </button>
            ))}
          </Fileira>
        )}

        {top.length > 0 && (
          <Fileira titulo="Para cobrar">
            {top.map((c, n) => (
              <button key={c.id} type="button" onClick={() => entrar('pendencias')} className="group relative flex h-[170px] shrink-0 items-end text-left transition hover:scale-[1.03]">
                <span aria-hidden className="ck-num select-none pr-1 text-[150px]">
                  {n + 1}
                </span>
                <span className="relative -ml-5 flex h-full w-[130px] flex-col justify-end overflow-hidden rounded-xl bg-gradient-to-br from-[#8f1d2c] to-[#3b0a14] p-3 shadow-[0_8px_24px_rgba(0,0,0,.5)]">
                  <span className="block truncate text-xs font-bold uppercase leading-tight">{c.titulo}</span>
                  <span className="block text-sm font-bold text-amber-300">{c.valor}</span>
                  <span className="block text-[10px] text-white/70">{c.detalhe}</span>
                </span>
              </button>
            ))}
          </Fileira>
        )}

        {notas.length > 0 && (
          <Fileira titulo="Notas em andamento">
            {notas.map((n) => (
              <button key={n.id} type="button" onClick={() => entrar('demonstrativos')} className="flex h-[150px] w-[230px] shrink-0 flex-col justify-between rounded-2xl bg-white/[0.07] p-4 text-left ring-1 ring-white/10 transition hover:scale-[1.03] hover:bg-white/[0.12]">
                <span>
                  <span className="block truncate text-sm font-bold uppercase">{n.quem}</span>
                  <span className="block text-2xl font-black">{n.valor}</span>
                </span>
                <span>
                  <span className="flex gap-1" aria-hidden>
                    {[1, 2, 3, 4, 5].map((p) => (
                      <span key={p} className={`h-1.5 flex-1 rounded-full ${p <= n.passo ? 'bg-white' : 'bg-white/20'}`} />
                    ))}
                  </span>
                  <span className="mt-1.5 block text-[11px] text-white/70">{ETAPA_LABEL[n.etapa]}</span>
                </span>
              </button>
            ))}
          </Fileira>
        )}

        {meses.length > 0 && (
          <Fileira titulo="Meses">
            {meses.map((m) => {
              const parte = (n: number) => `${(n / m.cirurgias) * 100}%`;
              return (
                <button key={m.mes} type="button" onClick={() => entrar('cirurgias')} className="flex h-[150px] w-[190px] shrink-0 flex-col justify-between rounded-2xl bg-white/[0.07] p-4 text-left ring-1 ring-white/10 transition hover:scale-[1.03] hover:bg-white/[0.12]">
                  <span>
                    <span className="block text-lg font-black uppercase">{nomeDoMes(m.mes)}</span>
                    <span className="block text-[11px] text-white/60">{m.cirurgias} cirurgias</span>
                  </span>
                  <span>
                    <span className="flex h-2 overflow-hidden rounded-full bg-white/15" aria-hidden>
                      <span className="bg-emerald-400" style={{ width: parte(m.pagas) }} />
                      <span className="bg-white" style={{ width: parte(m.noDemonstrativo - m.pagas) }} />
                      <span className="bg-red-500" style={{ width: parte(m.deFora) }} />
                    </span>
                    <span className="mt-1.5 block text-[11px] text-white/70">
                      {m.deFora > 0 ? `${m.deFora} de fora` : m.aguardando > 0 ? 'Aguardando demonstrativo' : m.pagas === m.cirurgias ? 'Tudo pago' : 'No demonstrativo'}
                    </span>
                  </span>
                </button>
              );
            })}
          </Fileira>
        )}
      </div>
    </div>
  );
}

function Fileira({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const rolar = (sentido: number) => ref.current?.scrollBy({ left: sentido * ref.current.clientWidth * 0.8, behavior: 'smooth' });
  // As setas só aparecem quando a fileira não cabe na tela.
  const [transborda, setTransborda] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setTransborda(el.scrollWidth > el.clientWidth + 4);
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [children]);
  return (
    <section className="group/fila relative">
      <h2 className="mb-3 text-lg font-bold sm:text-xl">{titulo}</h2>
      <div className="relative">
        <button type="button" onClick={() => rolar(-1)} aria-label="Voltar" className={`absolute inset-y-0 -left-2 z-10 hidden w-10 place-items-center rounded-l-xl bg-black/50 opacity-0 transition group-hover/fila:opacity-100 ${transborda ? 'sm:grid' : ''}`}>
          <ChevronLeft className="h-6 w-6" aria-hidden />
        </button>
        <div ref={ref} className="ck-linha -mx-5 flex gap-3 overflow-x-auto scroll-smooth px-5 py-2 sm:mx-0 sm:px-0">
          {children}
        </div>
        <button type="button" onClick={() => rolar(1)} aria-label="Avançar" className={`absolute inset-y-0 -right-2 z-10 hidden w-10 place-items-center rounded-r-xl bg-black/50 opacity-0 transition group-hover/fila:opacity-100 ${transborda ? 'sm:grid' : ''}`}>
          <ChevronRight className="h-6 w-6" aria-hidden />
        </button>
      </div>
    </section>
  );
}
