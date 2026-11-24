'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, CalendarCheck, Eye, EyeOff, FileText, Home, Landmark, MoreHorizontal, Plus, Send, Sparkles, Stethoscope, Trash2, Zap } from 'lucide-react';
import { toast } from 'sonner';

import { avisos, pendencias, resumo } from '@/lib/medico/conciliacao';
import type { EstadoMedico } from '@/lib/medico/types';
import { Banco } from './Banco';
import { Cadastros } from './Cadastros';
import { Cirurgias } from './Cirurgias';
import { Demonstrativos } from './Demonstrativos';
import { Integracoes } from './Integracoes';
import { Pendencias } from './Pendencias';
import { Botao, brl, CARTAO, chamar, type PropsDaAba } from './ui';

// Área Médica (sub-projeto 100): o controle que o cirurgião fazia em planilha.
// Cirurgia feita → demonstrativo do hospital → nota do contador → nota enviada
// → pagamento. O que foi feito e não apareceu em demonstrativo vira cobrança.

const ABAS = [
  { id: 'visao', rotulo: 'Visão geral' },
  { id: 'cirurgias', rotulo: 'Cirurgias' },
  { id: 'demonstrativos', rotulo: 'Demonstrativos e notas' },
  { id: 'pendencias', rotulo: 'Pendências a cobrar' },
  { id: 'banco', rotulo: 'Banco' },
  { id: 'cadastros', rotulo: 'Cadastros' },
  { id: 'integracoes', rotulo: 'Integrações' },
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
const NO_MAIS: Aba[] = ['banco', 'cadastros', 'integracoes'];

/** Atalho da tela inicial: abre a aba já com a janela certa. */
export type Atalho = 'nova-cirurgia' | 'demonstrativo' | 'direto';

export function AreaMedicaRoot({ estadoInicial, hoje, abaInicial, aviso }: { estadoInicial: EstadoMedico; hoje: string; abaInicial?: string; aviso?: { ok: boolean; texto: string } }) {
  const [estado, setEstado] = useState(estadoInicial);
  const [aba, setAba] = useState<Aba>(
    ABAS.some((a) => a.id === abaInicial) ? (abaInicial as Aba) : estadoInicial.hospitais.length === 0 ? 'cadastros' : 'visao',
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
    <div className="space-y-5 pb-24 sm:pb-0">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-6 w-6 text-brand" aria-hidden />
            <h1 className="text-2xl font-semibold tracking-tight">Área Médica</h1>
          </div>
          <p className="mt-1 hidden text-sm text-muted-foreground sm:block">
            Das cirurgias feitas ao dinheiro na conta: demonstrativo do hospital, nota do contador, pagamento e o que ficou sem pagar.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {temExemplo ? (
            <Botao tipo="secundario" ocupado={carregandoExemplo} onClick={() => exemplo('DELETE')}>
              <Trash2 className="h-4 w-4" aria-hidden /> Apagar exemplo
            </Botao>
          ) : (
            <Botao tipo="secundario" ocupado={carregandoExemplo} onClick={() => exemplo('POST')}>
              <Sparkles className="h-4 w-4" aria-hidden /> Carregar exemplo
            </Botao>
          )}
        </div>
      </header>

      {temExemplo && (
        <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
          Você está vendo dados fictícios de exemplo. Eles não se misturam com os seus e somem em &quot;Apagar exemplo&quot;.
        </p>
      )}

      <nav className="hidden gap-1 overflow-x-auto border-b border-border sm:flex" aria-label="Seções da Área Médica">
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => irPara(a.id)}
            aria-current={aba === a.id ? 'page' : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition ${
              aba === a.id ? 'border-brand text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {a.rotulo}
            {(a.id === 'cirurgias' || a.id === 'demonstrativos') && novas[a.id] > 0 && (
              <span className="ml-1.5 rounded-full bg-brand/15 px-1.5 py-0.5 text-[11px] font-semibold text-brand" title="Chegou e espera conferência">{novas[a.id]}</span>
            )}
            {a.id === 'pendencias' && nPendentes > 0 && (
              <span className="ml-1.5 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-red-700 dark:text-red-300">{nPendentes}</span>
            )}
          </button>
        ))}
      </nav>

      {aba === 'visao' && <VisaoGeral {...props} irPara={irPara} />}
      {aba === 'cirurgias' && <Cirurgias key={abrir ?? 'lista'} {...props} abrir={abrir} />}
      {aba === 'demonstrativos' && <Demonstrativos key={abrir ?? 'lista'} {...props} abrir={abrir} />}
      {aba === 'pendencias' && <Pendencias {...props} />}
      {aba === 'banco' && <Banco {...props} />}
      {aba === 'cadastros' && <Cadastros {...props} />}
      {aba === 'integracoes' && <Integracoes {...props} />}

      {mais && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/40 sm:hidden" onClick={() => setMais(false)}>
          <div className="w-full rounded-t-3xl border-t border-border bg-background p-4 pb-24" onClick={(e) => e.stopPropagation()}>
            <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted" />
            {ABAS.filter((a) => NO_MAIS.includes(a.id)).map((a) => (
              <button key={a.id} type="button" onClick={() => irPara(a.id)} className="flex w-full items-center justify-between rounded-2xl px-3 py-3.5 text-left text-sm font-medium hover:bg-muted">
                {a.rotulo} <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden />
              </button>
            ))}
          </div>
        </div>
      )}

      <nav aria-label="Navegação do aplicativo" className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur sm:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <ul className="grid grid-cols-5">
          {BARRA.map((b) => {
            const ativa = b.id === 'mais' ? mais || NO_MAIS.includes(aba) : !mais && aba === b.id;
            return (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => (b.id === 'mais' ? setMais((v) => !v) : irPara(b.id))}
                  aria-current={ativa ? 'page' : undefined}
                  className={`relative flex w-full flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${ativa ? 'text-brand' : 'text-muted-foreground'}`}
                >
                  <b.icone className="h-5 w-5" aria-hidden />
                  {b.rotulo}
                  {b.id === 'pendencias' && nPendentes > 0 && <span className="absolute right-[26%] top-1.5 h-2 w-2 rounded-full bg-red-500" aria-hidden />}
                  {b.id === 'cirurgias' && novas.cirurgias > 0 && <span className="absolute right-[26%] top-1.5 h-2 w-2 rounded-full bg-brand" aria-hidden />}
                  {b.id === 'demonstrativos' && novas.demonstrativos > 0 && <span className="absolute right-[26%] top-1.5 h-2 w-2 rounded-full bg-brand" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

const CHAVE_OCULTAR = 'progpt_medico_ocultar_valores_v1';

function VisaoGeral({ estado, hoje, irPara }: PropsDaAba & { irPara: (a: Aba, atalho?: Atalho | null) => void }) {
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

  if (estado.hospitais.length === 0) {
    return (
      <div className={`${CARTAO} text-sm`}>
        <p className="font-medium">Comece cadastrando os hospitais onde você opera.</p>
        <p className="mt-1 text-muted-foreground">
          Depois registre as cirurgias (pode colar as mensagens do grupo de WhatsApp) e os demonstrativos que os hospitais mandam. Para ver tudo funcionando antes, use &quot;Carregar exemplo&quot;.
        </p>
        <div className="mt-3">
          <Botao onClick={() => irPara('cadastros')}>Cadastrar hospitais</Botao>
        </div>
      </div>
    );
  }

  const kpis = [
    { rotulo: 'Recebido neste mês', valor: dinheiro(r.recebidoNoMes), detalhe: 'pagamentos confirmados', icone: CalendarCheck },
    {
      rotulo: 'Cirurgias sem pagamento',
      valor: String(r.pendentes),
      detalhe: r.valorPendente > 0 ? `${dinheiro(r.valorPendente)} em aberto` : 'feitas e fora dos demonstrativos',
      icone: AlertTriangle,
      alerta: r.pendentes > 0,
    },
    { rotulo: 'Pago a menos', valor: dinheiro(r.pagoAMenos), detalhe: 'diferença entre demonstrativo e pagamento', icone: FileText, alerta: r.pagoAMenos > 0 },
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-brand p-5 text-white shadow-lg sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-white/80">Olá{estado.config.medico_nome ? `, ${estado.config.medico_nome.split(' ').slice(0, 2).join(' ')}` : ''}</p>
            <p className="mt-3 text-xs font-medium uppercase tracking-wider text-white/70">A receber</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">{dinheiro(r.aReceber)}</p>
            <p className="mt-1 text-sm text-white/80">em notas e demonstrativos ainda não pagos</p>
          </div>
          <button type="button" onClick={alternar} aria-label={oculto ? 'Mostrar valores' : 'Esconder valores'} aria-pressed={oculto} className="rounded-full bg-white/15 p-2.5 hover:bg-white/25">
            {oculto ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
          </button>
        </div>
        <ul className="mt-5 flex gap-4 overflow-x-auto pb-1">
          {(
            [
              ['Nova cirurgia', Plus, () => irPara('cirurgias', 'nova-cirurgia')],
              ['Lançar demonstrativo', FileText, () => irPara('demonstrativos', 'demonstrativo')],
              ['Paciente pagou na hora', Zap, () => irPara('demonstrativos', 'direto')],
              ['Cobrar hospital', Send, () => irPara('pendencias')],
              ['Banco', Landmark, () => irPara('banco')],
            ] as const
          ).map(([rotulo, Icone, acao]) => (
            <li key={rotulo} className="shrink-0">
              <button type="button" onClick={acao} className="flex w-[4.75rem] flex-col items-center gap-1.5 text-center text-[11px] font-medium leading-tight">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-white/15 transition hover:bg-white/25">
                  <Icone className="h-6 w-6" aria-hidden />
                </span>
                {rotulo}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        {kpis.map((k) => (
          <div key={k.rotulo} className={CARTAO}>
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              {k.rotulo}
              <k.icone className={`h-4 w-4 ${k.alerta ? 'text-red-600 dark:text-red-400' : ''}`} aria-hidden />
            </div>
            <div className={`mt-2 text-2xl font-semibold ${k.alerta ? 'text-red-700 dark:text-red-300' : ''}`}>{k.valor}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{k.detalhe}</div>
          </div>
        ))}
      </div>

      <section className={CARTAO}>
        <h2 className="text-base font-semibold">O que fazer agora</h2>
        {fila.length === 0 ? (
          <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">Tudo em dia: nenhuma nota parada e nenhuma cirurgia atrasada.</p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {fila.map((a, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => irPara(a.tipo === 'pendencia' ? 'pendencias' : 'demonstrativos')}
                  className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition hover:brightness-95 ${
                    a.gravidade === 'alta' ? 'bg-red-500/10 text-red-800 dark:text-red-200' : 'bg-amber-500/10 text-amber-900 dark:text-amber-200'
                  }`}
                >
                  <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1">{a.texto}</span>
                  <span className="whitespace-nowrap text-xs opacity-80">{a.dias === 0 ? 'hoje' : `há ${a.dias} ${a.dias === 1 ? 'dia' : 'dias'}`}</span>
                  <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
