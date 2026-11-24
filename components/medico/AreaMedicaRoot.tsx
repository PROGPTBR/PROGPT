'use client';

import { useCallback, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Banknote, CalendarCheck, FileText, Sparkles, Stethoscope, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { avisos, pendencias, resumo } from '@/lib/medico/conciliacao';
import type { EstadoMedico } from '@/lib/medico/types';
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
  { id: 'cadastros', rotulo: 'Cadastros' },
  { id: 'integracoes', rotulo: 'Integrações' },
] as const;
type Aba = (typeof ABAS)[number]['id'];

export function AreaMedicaRoot({ estadoInicial, hoje }: { estadoInicial: EstadoMedico; hoje: string }) {
  const [estado, setEstado] = useState(estadoInicial);
  const [aba, setAba] = useState<Aba>(estadoInicial.hospitais.length === 0 ? 'cadastros' : 'visao');
  const [carregandoExemplo, setCarregandoExemplo] = useState(false);

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
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-6 w-6 text-brand" aria-hidden />
            <h1 className="text-2xl font-semibold tracking-tight">Área Médica</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
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

      <nav className="flex gap-1 overflow-x-auto border-b border-border" aria-label="Seções da Área Médica">
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAba(a.id)}
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

      {aba === 'visao' && <VisaoGeral {...props} irPara={setAba} />}
      {aba === 'cirurgias' && <Cirurgias {...props} />}
      {aba === 'demonstrativos' && <Demonstrativos {...props} />}
      {aba === 'pendencias' && <Pendencias {...props} />}
      {aba === 'cadastros' && <Cadastros {...props} />}
      {aba === 'integracoes' && <Integracoes {...props} />}
    </div>
  );
}

function VisaoGeral({ estado, hoje, irPara }: PropsDaAba & { irPara: (a: Aba) => void }) {
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
    { rotulo: 'A receber', valor: brl(r.aReceber), detalhe: 'demonstrativos ainda não pagos', icone: Banknote },
    { rotulo: 'Recebido neste mês', valor: brl(r.recebidoNoMes), detalhe: 'pagamentos confirmados', icone: CalendarCheck },
    {
      rotulo: 'Cirurgias sem pagamento',
      valor: String(r.pendentes),
      detalhe: r.valorPendente > 0 ? `${brl(r.valorPendente)} em aberto` : 'feitas e fora dos demonstrativos',
      icone: AlertTriangle,
      alerta: r.pendentes > 0,
    },
    { rotulo: 'Pago a menos', valor: brl(r.pagoAMenos), detalhe: 'diferença entre demonstrativo e pagamento', icone: FileText, alerta: r.pagoAMenos > 0 },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
