'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, Eye, EyeOff, FileText, Home, Landmark, LogOut, MoreHorizontal, Paperclip, Plug, Plus, Send, Settings2, Sparkles, Stethoscope, UserPlus, Zap } from 'lucide-react';
import { toast } from 'sonner';

import { supabaseBrowser } from '@/lib/db/supabase-browser';
import { avisos, pendencias, resumo } from '@/lib/medico/conciliacao';
import type { EstadoMedico } from '@/lib/medico/types';
import { Agenda } from './Agenda';
import { Banco } from './Banco';
import { Cadastros } from './Cadastros';
import { Cirurgias } from './Cirurgias';
import { Demonstrativos } from './Demonstrativos';
import { Documentos } from './Documentos';
import { Indicar } from './Indicar';
import { Integracoes } from './Integracoes';
import { Pendencias } from './Pendencias';
import { Botao, brl, chamar, Info, type PropsDaAba } from './ui';

// Área Médica (sub-projeto 100): o controle que o cirurgião fazia em planilha.
// Cirurgia feita → demonstrativo do hospital → nota do contador → nota enviada
// → pagamento. O que foi feito e não apareceu em demonstrativo vira cobrança.

const ABAS = [
  { id: 'visao', rotulo: 'Visão geral', icone: Home },
  { id: 'cirurgias', rotulo: 'Cirurgias', icone: Stethoscope },
  { id: 'demonstrativos', rotulo: 'Demonstrativos e notas', icone: FileText },
  { id: 'pendencias', rotulo: 'Pendências a cobrar', icone: Send },
  { id: 'agenda', rotulo: 'Agenda', icone: CalendarDays },
  { id: 'documentos', rotulo: 'Documentos', icone: Paperclip },
  { id: 'banco', rotulo: 'Banco', icone: Landmark },
  { id: 'cadastros', rotulo: 'Cadastros', icone: Settings2 },
  { id: 'integracoes', rotulo: 'Integrações', icone: Plug },
  { id: 'indicar', rotulo: 'Indicar um colega', icone: UserPlus },
] as const;
type Aba = (typeof ABAS)[number]['id'];

// No celular a Área Médica vira aplicativo: barra fixa embaixo com o que o
// médico usa todo dia; o resto fica em "Mais".
const BARRA: { id: Aba | 'mais'; rotulo: string; icone: typeof Home }[] = [
  { id: 'visao', rotulo: 'Início', icone: Home },
  { id: 'cirurgias', rotulo: 'Cirurgias', icone: Stethoscope },
  { id: 'demonstrativos', rotulo: 'Notas', icone: FileText },
  { id: 'pendencias', rotulo: 'Cobrar', icone: Send },
  { id: 'mais', rotulo: 'Mais', icone: MoreHorizontal },
];
const NO_MAIS: Aba[] = ['agenda', 'documentos', 'banco', 'cadastros', 'integracoes', 'indicar'];

/** Atalho da tela inicial: abre a aba já com a janela certa. */
export type Atalho = 'nova-cirurgia' | 'demonstrativo' | 'direto';

export function AreaMedicaRoot({
  estadoInicial,
  hoje,
  abaInicial,
  aviso,
  linkDoSistema = false,
}: {
  estadoInicial: EstadoMedico;
  hoje: string;
  abaInicial?: string;
  aviso?: { ok: boolean; texto: string };
  /** Conta da equipe: mostra o caminho de volta para o sistema de compras. */
  linkDoSistema?: boolean;
}) {
  const [estado, setEstado] = useState(estadoInicial);
  const [aba, setAba] = useState<Aba>(
    ABAS.some((a) => a.id === abaInicial) ? (abaInicial as Aba) : 'visao',
  );
  // Volta do login do BTG: mostra uma vez o resultado da ligação.
  useEffect(() => {
    if (!aviso) return;
    if (aviso.ok) toast.success(aviso.texto);
    else toast.error(aviso.texto);
    window.history.replaceState(null, '', '/area-medica');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [carregandoExemplo, setCarregandoExemplo] = useState(false);
  const [abrir, setAbrir] = useState<Atalho | null>(null);
  const [mais, setMais] = useState(false);
  const irPara = useCallback((a: Aba, atalho: Atalho | null = null) => {
    setAbrir(atalho);
    setAba(a);
    setMais(false);
    window.scrollTo?.({ top: 0 });
  }, []);

  const recarregar = useCallback(async () => {
    const r = await chamar<EstadoMedico>('GET', '');
    if (r.ok) setEstado(r.dados);
  }, []);

  const enviar = useCallback<PropsDaAba['enviar']>(
    async (metodo, caminho, corpo, sucesso) => {
      const r = await chamar(metodo, caminho, corpo);
      if (!r.ok) {
        toast.error(r.mensagem);
        return null;
      }
      if (sucesso) toast.success(sucesso);
      await recarregar();
      return r.dados as never;
    },
    [recarregar],
  );

  async function sair() {
    await supabaseBrowser().auth.signOut().catch(() => undefined);
    window.location.href = '/medicos';
  }

  const temExemplo = estado.hospitais.some((h) => h.exemplo);
  const props: PropsDaAba = { estado, hoje, enviar, recarregar };
  const nPendentes = useMemo(() => pendencias(estado.cirurgias, estado.hospitais, hoje).length, [estado, hoje]);
  const novas = { cirurgias: estado.entradas.filter((e) => e.canal === 'whatsapp').length, demonstrativos: estado.entradas.filter((e) => e.canal === 'email').length };

  async function exemplo(metodo: 'POST' | 'DELETE') {
    setCarregandoExemplo(true);
    await enviar(metodo, '/exemplo', undefined, metodo === 'POST' ? 'Exemplo carregado.' : 'Exemplo apagado.');
    setCarregandoExemplo(false);
    if (metodo === 'POST') setAba('visao');
  }

  return (
    <div className="lg:pl-64">
      {/* Computador: menu lateral fixo, de cima a baixo */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-medico-escuro text-white lg:flex">
        <div className="flex h-16 items-center gap-2.5 px-6 text-base font-semibold">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10 ring-1 ring-white/20">
            <Stethoscope className="h-5 w-5" aria-hidden />
          </span>
          Área Médica
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Menu da Área Médica">
          {ABAS.map((a) => {
            const ativa = aba === a.id;
            const aviso = a.id === 'pendencias' ? nPendentes : a.id === 'cirurgias' ? novas.cirurgias : a.id === 'demonstrativos' ? novas.demonstrativos : 0;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => irPara(a.id)}
                aria-current={ativa ? 'page' : undefined}
                className={`flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left text-sm font-medium transition ${ativa ? 'bg-white text-medico-escuro' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}
              >
                <a.icone className="h-5 w-5 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{a.rotulo}</span>
                {aviso > 0 && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${a.id === 'pendencias' ? 'bg-red-500 text-white' : 'bg-medico-claro text-white'}`}>{aviso}</span>}
              </button>
            );
          })}
        </nav>
        <div className="space-y-0.5 border-t border-white/10 p-3">
          {linkDoSistema && (
            <a href="/chat" className="flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium text-white/75 hover:bg-white/10 hover:text-white">
              <ArrowRight className="h-5 w-5 rotate-180" aria-hidden /> Sistema de compras
            </a>
          )}
          <button type="button" onClick={sair} className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left text-sm font-medium text-white/75 hover:bg-white/10 hover:text-white">
            <LogOut className="h-5 w-5" aria-hidden /> Sair
          </button>
        </div>
      </aside>

    <div className="space-y-5 pb-28 sm:pb-8 lg:space-y-0 lg:pb-0">
      <h1 className="sr-only">Área Médica</h1>

      <nav className="hidden gap-1 overflow-x-auto border-b border-neutral-200 px-4 [scrollbar-width:none] sm:flex lg:hidden [&::-webkit-scrollbar]:hidden" aria-label="Seções da Área Médica">
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => irPara(a.id)}
            aria-current={aba === a.id ? 'page' : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition ${
              aba === a.id ? 'border-medico text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {a.rotulo}
            {(a.id === 'cirurgias' || a.id === 'demonstrativos') && novas[a.id] > 0 && (
              <span className="ml-1.5 rounded-full bg-medico/15 px-1.5 py-0.5 text-[11px] font-semibold text-medico" title="Chegou e espera conferência">{novas[a.id]}</span>
            )}
            {a.id === 'pendencias' && nPendentes > 0 && (
              <span className="ml-1.5 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-red-700 dark:text-red-300">{nPendentes}</span>
            )}
          </button>
        ))}
      </nav>

      {aba === 'visao' && <VisaoGeral {...props} irPara={irPara} carregarExemplo={() => exemplo('POST')} carregando={carregandoExemplo} />}
      <div className={aba === 'visao' ? 'hidden' : 'px-4 sm:px-6 lg:px-10 lg:py-9'}>
      {aba === 'cirurgias' && <Cirurgias key={abrir ?? 'lista'} {...props} abrir={abrir} />}
      {aba === 'demonstrativos' && <Demonstrativos key={abrir ?? 'lista'} {...props} abrir={abrir} />}
      {aba === 'pendencias' && <Pendencias {...props} />}
      {aba === 'agenda' && <Agenda {...props} />}
      {aba === 'indicar' && <Indicar {...props} />}
      {aba === 'documentos' && <Documentos {...props} />}
      {aba === 'banco' && <Banco {...props} />}
      {aba === 'cadastros' && <Cadastros {...props} />}
      {aba === 'integracoes' && <Integracoes {...props} />}
      </div>

      {temExemplo && (
        <p className="mx-4 flex items-center justify-between gap-3 rounded-2xl bg-amber-100 px-3.5 py-2 text-xs text-amber-900 sm:mx-6 lg:mx-10 lg:mb-6 lg:w-fit lg:gap-6">
          Dados de exemplo
          <button type="button" disabled={carregandoExemplo} onClick={() => exemplo('DELETE')} className="font-semibold underline underline-offset-2">
            Apagar
          </button>
        </p>
      )}

      {mais && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/40 sm:hidden" onClick={() => setMais(false)}>
          <div className="w-full rounded-t-3xl border-t border-border bg-background p-4 pb-28" onClick={(e) => e.stopPropagation()}>
            <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted" />
            {ABAS.filter((a) => NO_MAIS.includes(a.id)).map((a) => (
              <button key={a.id} type="button" onClick={() => irPara(a.id)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3.5 text-left text-sm font-medium hover:bg-neutral-100">
                <a.icone className="h-5 w-5 text-medico" aria-hidden />
                <span className="flex-1">{a.rotulo}</span>
                <ArrowRight className="h-4 w-4 text-neutral-400" aria-hidden />
              </button>
            ))}
            {linkDoSistema && (
              <a href="/chat" className="flex w-full items-center gap-3 rounded-2xl px-3 py-3.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100">
                <ArrowRight className="h-5 w-5 rotate-180" aria-hidden /> Sistema de compras
              </a>
            )}
          </div>
        </div>
      )}

      <nav aria-label="Navegação do aplicativo" className="fixed inset-x-0 bottom-0 z-50 border-t border-neutral-200 bg-white sm:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <ul className="grid grid-cols-5">
          {BARRA.map((b) => {
            const ativa = b.id === 'mais' ? mais || NO_MAIS.includes(aba) : !mais && aba === b.id;
            const novo = (b.id === 'pendencias' && nPendentes > 0) || (b.id === 'cirurgias' && novas.cirurgias > 0) || (b.id === 'demonstrativos' && novas.demonstrativos > 0);
            return (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => (b.id === 'mais' ? setMais((v) => !v) : irPara(b.id))}
                  aria-current={ativa ? 'page' : undefined}
                  className={`flex w-full flex-col items-center gap-1 pb-2 pt-2.5 text-[10px] font-medium ${ativa ? 'text-medico' : 'text-neutral-500'}`}
                >
                  <span className={`relative grid h-9 w-12 place-items-center rounded-full transition ${ativa ? 'bg-medico/10' : ''}`}>
                    <b.icone className="h-[22px] w-[22px]" strokeWidth={ativa ? 2.4 : 1.8} aria-hidden />
                    {novo && <span className={`absolute right-2 top-1 h-2 w-2 rounded-full ring-2 ring-white ${b.id === 'pendencias' ? 'bg-red-500' : 'bg-medico-claro'}`} aria-hidden />}
                  </span>
                  {b.rotulo}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
    </div>
  );
}

const CHAVE_OCULTAR = 'progpt_medico_ocultar_valores_v1';

function VisaoGeral({
  estado,
  hoje,
  irPara,
  carregarExemplo,
  carregando,
}: PropsDaAba & { irPara: (a: Aba, atalho?: Atalho | null) => void; carregarExemplo: () => void; carregando: boolean }) {
  // Como em aplicativo de banco: dá para esconder os valores (consultório, sala de espera).
  const [oculto, setOculto] = useState(false);
  useEffect(() => {
    try {
      setOculto(window.localStorage.getItem(CHAVE_OCULTAR) === '1');
    } catch {
      /* sem armazenamento: começa mostrando */
    }
  }, []);
  const alternar = () =>
    setOculto((v) => {
      try {
        window.localStorage.setItem(CHAVE_OCULTAR, v ? '0' : '1');
      } catch {
        /* ignora */
      }
      return !v;
    });
  const dinheiro = (v: number) => (oculto ? 'R$ ••••' : brl(v));
  const r = useMemo(() => resumo(estado.demonstrativos, estado.cirurgias, hoje), [estado, hoje]);
  const fila = useMemo(() => avisos(estado.demonstrativos, estado.cirurgias, estado.hospitais, hoje), [estado, hoje]);

  const semHospital = estado.hospitais.length === 0;
  const atalhos = [
    ['Nova cirurgia', Plus, () => irPara('cirurgias', 'nova-cirurgia')],
    ['Demonstrativo', FileText, () => irPara('demonstrativos', 'demonstrativo')],
    ['Pagou na hora', Zap, () => irPara('demonstrativos', 'direto')],
    ['Cobrar', Send, () => irPara('pendencias')],
    ['Agenda', CalendarDays, () => irPara('agenda')],
    ['Anexar', Paperclip, () => irPara('documentos')],
    ['Banco', Landmark, () => irPara('banco')],
    ['Indicar', UserPlus, () => irPara('indicar')],
  ] as const;
  const linhas = [
    { rotulo: 'Recebido neste mês', valor: dinheiro(r.recebidoNoMes), info: 'Soma dos pagamentos confirmados neste mês.', ir: 'demonstrativos' as Aba, alerta: false },
    { rotulo: 'Cirurgias sem pagamento', valor: String(r.pendentes), info: 'Cirurgias feitas que ainda não apareceram em nenhum demonstrativo do hospital.', ir: 'pendencias' as Aba, alerta: r.pendentes > 0 },
    { rotulo: 'Pago a menos', valor: dinheiro(r.pagoAMenos), info: 'Diferença entre o que o demonstrativo dizia e o que caiu na conta.', ir: 'demonstrativos' as Aba, alerta: r.pagoAMenos > 0 },
  ];

  const filaJsx = fila.length > 0 ? (
    <ul className="space-y-2 px-4 sm:px-6 lg:px-0" aria-label="O que fazer agora">
              {fila.map((a, i) => (
                <li key={i}>
                  <button type="button" onClick={() => irPara(a.tipo === 'pendencia' ? 'pendencias' : 'demonstrativos')} className="flex w-full items-center gap-3 rounded-2xl bg-neutral-100 px-4 py-3.5 text-left text-sm hover:bg-neutral-200">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${a.gravidade === 'alta' ? 'bg-red-500' : 'bg-amber-400'}`} aria-hidden />
                    <span className="min-w-0 flex-1 font-medium text-neutral-900">{a.texto}</span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
  ) : null;

  return (
    <div className="!-mt-5 flex flex-col lg:!mt-0 lg:grid lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:items-start lg:gap-6 lg:p-10">
      <div className="contents lg:block">
      {/* Cabeçalho azul: de borda a borda no celular, cartão largo no computador */}
      <section className="relative order-1 overflow-hidden bg-gradient-to-br from-medico-escuro via-medico to-medico-claro px-5 pb-7 pt-6 text-white sm:px-8 sm:pb-9 lg:rounded-[2rem] lg:p-10 lg:shadow-[0_18px_50px_rgba(10,31,77,0.22)]">
        <svg aria-hidden viewBox="0 0 400 160" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full opacity-20">
          <path d="M0 120 C 60 110, 90 60, 150 78 S 250 130, 300 70 S 370 30, 400 44" fill="none" stroke="white" strokeWidth="2" />
        </svg>
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-white/80">Olá{estado.config.medico_nome ? `, ${estado.config.medico_nome.split(' ').slice(0, 2).join(' ')}` : ''}</p>
            <p className="mt-5 flex items-center gap-1 text-sm text-white/80">
              A receber <Info claro>Soma das notas e dos demonstrativos que ainda não foram pagos.</Info>
            </p>
            <p className="text-4xl font-semibold tracking-tight lg:text-6xl">{dinheiro(r.aReceber)}</p>
          </div>
          <button type="button" onClick={alternar} aria-label={oculto ? 'Mostrar valores' : 'Esconder valores'} aria-pressed={oculto} className="rounded-full p-2 hover:bg-white/15">
            {oculto ? <EyeOff className="h-6 w-6" aria-hidden /> : <Eye className="h-6 w-6" aria-hidden />}
          </button>
        </div>
      </section>

      {semHospital ? (
        <div className="order-2 px-5 py-8 text-center sm:px-8 lg:mt-6 lg:rounded-[2rem] lg:bg-white lg:py-12 lg:ring-1 lg:ring-black/[0.05]">
          <p className="text-lg font-semibold">Comece pelos hospitais onde você opera</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Botao onClick={() => irPara('cadastros')}>Cadastrar hospital</Botao>
            <Botao tipo="secundario" ocupado={carregando} onClick={carregarExemplo}>
              <Sparkles className="h-4 w-4" aria-hidden /> Ver com exemplo
            </Botao>
          </div>
        </div>
      ) : (
        <>
          {/* Atalhos: rolam de lado, de borda a borda, sem barra */}
          <ul className="order-2 flex gap-1 overflow-x-auto px-3 py-5 [scrollbar-width:none] sm:px-6 lg:mt-6 lg:flex-wrap lg:justify-between lg:gap-y-5 lg:rounded-[2rem] lg:bg-white lg:px-6 lg:py-7 lg:ring-1 lg:ring-black/[0.05] [&::-webkit-scrollbar]:hidden">
            {atalhos.map(([rotulo, Icone, acao]) => (
              <li key={rotulo} className="shrink-0">
                <button type="button" onClick={acao} className="group flex w-[4.75rem] flex-col items-center gap-2 text-center text-xs font-medium text-neutral-800 lg:w-24 lg:text-sm">
                  <span className="grid h-16 w-16 place-items-center rounded-full bg-neutral-100 text-medico transition group-hover:bg-neutral-200 group-active:scale-95">
                    <Icone className="h-6 w-6" aria-hidden />
                  </span>
                  {rotulo}
                </button>
              </li>
            ))}
          </ul>

          {/* Números: linhas simples */}
          <ul className="order-4 mt-4 divide-y divide-neutral-200 border-y border-neutral-200 lg:mt-6 lg:grid lg:grid-cols-3 lg:gap-4 lg:divide-y-0 lg:border-0">
            {linhas.map((l) => (
              <li key={l.rotulo} className="flex items-center gap-2 px-5 py-4 sm:px-8 lg:flex-col lg:items-start lg:gap-4 lg:rounded-[2rem] lg:bg-white lg:p-6 lg:ring-1 lg:ring-black/[0.05]">
                <span className="flex min-w-0 flex-1 items-center gap-1 text-sm text-neutral-600">
                  {l.rotulo} <Info>{l.info}</Info>
                </span>
                <button type="button" onClick={() => irPara(l.ir)} className="flex items-center gap-2">
                  <span className={`text-base font-semibold lg:text-3xl ${l.alerta ? 'text-red-600' : 'text-neutral-900'}`}>{l.valor}</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-neutral-300" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      </div>

      {/* O que fazer agora: logo abaixo dos atalhos no celular, coluna própria no computador */}
      <aside className="order-3 lg:sticky lg:top-10 lg:rounded-[2rem] lg:bg-white lg:p-6 lg:ring-1 lg:ring-black/[0.05]">
        <h2 className="mb-4 hidden text-lg font-semibold lg:block">O que fazer agora</h2>
        {!semHospital && fila.length === 0 && <p className="hidden text-sm text-emerald-700 lg:block">Tudo em dia.</p>}
        {!semHospital && filaJsx}
      </aside>
    </div>
  );
}
