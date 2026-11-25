'use client';

import { useMemo, useState } from 'react';
import { BellRing, ChevronLeft, ChevronRight, Plus } from 'lucide-react';

import { cirurgiasDoDia, mesVizinho, semanasDoMes } from '@/lib/medico/agenda';
import { FUNCOES } from '@/lib/medico/types';
import { Botao, CAMPO, CARTAO, dataBr, Janela, ROTULO, Selo, type PropsDaAba } from './ui';

// Agenda (sub-projeto 109): o calendário das cirurgias. O que está marcado
// para amanhã chega na véspera pelo WhatsApp; depois de operar, a cirurgia
// segue sozinha para a conferência do demonstrativo e a cobrança.

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DIAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export function Agenda({ estado, hoje, enviar }: PropsDaAba) {
  const [mes, setMes] = useState(hoje.slice(0, 7));
  const [dia, setDia] = useState(hoje);
  const [agendar, setAgendar] = useState(false);
  const semanas = useMemo(() => semanasDoMes(mes), [mes]);
  const porDia = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of estado.cirurgias) m.set(c.data, (m.get(c.data) ?? 0) + 1);
    return m;
  }, [estado.cirurgias]);
  const doDia = cirurgiasDoDia(estado.cirurgias, dia);
  const nomeHospital = (id: string) => estado.hospitais.find((h) => h.id === id)?.nome ?? '';
  const [ano, m] = mes.split('-').map(Number) as [number, number];
  const semNumero = !estado.config.whatsapp_numero;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,26rem)_1fr]">
      <section className={CARTAO}>
        <div className="mb-3 flex items-center justify-between">
          <button type="button" onClick={() => setMes(mesVizinho(mes, -1))} aria-label="Mês anterior" className="rounded-full p-2 hover:bg-muted">
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <h2 className="text-base font-semibold">
            {MESES[m - 1]} de {ano}
          </h2>
          <button type="button" onClick={() => setMes(mesVizinho(mes, 1))} aria-label="Próximo mês" className="rounded-full p-2 hover:bg-muted">
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="grid grid-cols-7 text-center text-[11px] font-medium text-muted-foreground" aria-hidden>
          {DIAS.map((d, i) => (
            <span key={i} className="py-1">
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {semanas.flat().map((d, i) => {
            if (!d) return <span key={i} />;
            const n = porDia.get(d) ?? 0;
            const escolhido = d === dia;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDia(d)}
                aria-pressed={escolhido}
                aria-label={`${dataBr(d)}${n > 0 ? `, ${n} ${n === 1 ? 'cirurgia' : 'cirurgias'}` : ''}`}
                className="group flex flex-col items-center py-0.5"
              >
                <span
                  className={`grid h-10 w-10 place-items-center rounded-full text-sm transition ${
                    escolhido ? 'bg-medico font-semibold text-white' : d === hoje ? 'font-semibold text-medico ring-1 ring-medico/40' : 'group-hover:bg-muted'
                  }`}
                >
                  {Number(d.slice(8))}
                </span>
                <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${n > 0 ? (d >= hoje ? 'bg-medico-claro' : 'bg-muted-foreground/40') : ''}`} aria-hidden />
              </button>
            );
          })}
        </div>
        <p className={`mt-4 flex items-start gap-2 rounded-xl px-3 py-2 text-xs ${semNumero ? 'bg-amber-500/10 text-amber-900' : 'bg-medico/5 text-muted-foreground'}`}>
          <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-medico" aria-hidden />
          {semNumero
            ? 'Cadastre o seu WhatsApp em Integrações para receber, na véspera, o lembrete das cirurgias do dia seguinte.'
            : 'Na véspera, à noite, você recebe pelo WhatsApp a agenda do dia seguinte: hora, hospital e procedimento, sem nome de paciente.'}
        </p>
      </section>

      <section className={CARTAO}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">
            {dia === hoje ? 'Hoje' : dataBr(dia)} <span className="font-normal text-muted-foreground">· {doDia.length === 0 ? 'nada marcado' : `${doDia.length} ${doDia.length === 1 ? 'cirurgia' : 'cirurgias'}`}</span>
          </h2>
          <Botao desabilitado={estado.hospitais.length === 0} onClick={() => setAgendar(true)}>
            <Plus className="h-4 w-4" aria-hidden /> Marcar cirurgia
          </Botao>
        </div>
        {estado.hospitais.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Cadastre um hospital em Cadastros para marcar cirurgias.</p>}
        <ul className="mt-3 space-y-2">
          {doDia.map((c) => (
            <li key={c.id} className="flex items-center gap-3 rounded-2xl border border-border p-3">
              <span className="grid h-12 w-14 shrink-0 place-items-center rounded-xl bg-medico/10 text-sm font-semibold text-medico">{c.hora || '--:--'}</span>
              <span className="min-w-0 flex-1 text-sm">
                <span className="block truncate font-medium">{c.procedimento || 'Cirurgia'}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {nomeHospital(c.hospital_id)} · {c.paciente}
                  {c.funcao && ` · ${c.funcao}`}
                </span>
              </span>
              <Selo cor={c.data > hoje ? 'azul' : c.demonstrativo_id ? 'verde' : 'amarelo'}>{c.data > hoje ? 'Marcada' : c.demonstrativo_id ? 'No demonstrativo' : 'Feita'}</Selo>
            </li>
          ))}
        </ul>
      </section>

      {agendar && <MarcarCirurgia estado={estado} dia={dia} enviar={enviar} onFechar={() => setAgendar(false)} />}
    </div>
  );
}

function MarcarCirurgia({ estado, dia, enviar, onFechar }: Pick<PropsDaAba, 'estado' | 'enviar'> & { dia: string; onFechar: () => void }) {
  const [f, setF] = useState({ hospital_id: estado.hospitais[0]?.id ?? '', data: dia, hora: '08:00', paciente: '', procedimento: '', convenio: '', funcao: '' });
  const [salvando, setSalvando] = useState(false);
  const campo = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function salvar() {
    setSalvando(true);
    const ok = await enviar('POST', '/cirurgias', { cirurgias: [{ ...f, valor: null, origem: 'manual' }] }, 'Cirurgia marcada.');
    setSalvando(false);
    if (ok) onFechar();
  }

  return (
    <Janela titulo="Marcar cirurgia" onFechar={onFechar}>
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <label>
          <span className={ROTULO}>Data</span>
          <input type="date" value={f.data} onChange={campo('data')} className={CAMPO} />
        </label>
        <label>
          <span className={ROTULO}>Hora</span>
          <input type="time" value={f.hora} onChange={campo('hora')} className={CAMPO} />
        </label>
        <label className="sm:col-span-2">
          <span className={ROTULO}>Hospital</span>
          <select value={f.hospital_id} onChange={campo('hospital_id')} className={CAMPO}>
            {estado.hospitais.map((h) => (
              <option key={h.id} value={h.id}>
                {h.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="sm:col-span-2">
          <span className={ROTULO}>Paciente (nome como está no hospital)</span>
          <input value={f.paciente} onChange={campo('paciente')} className={CAMPO} />
        </label>
        <label className="sm:col-span-2">
          <span className={ROTULO}>Procedimento</span>
          <input value={f.procedimento} onChange={campo('procedimento')} className={CAMPO} />
        </label>
        <label>
          <span className={ROTULO}>Convênio e plano</span>
          <input value={f.convenio} onChange={campo('convenio')} className={CAMPO} />
        </label>
        <label>
          <span className={ROTULO}>Sua função</span>
          <select value={f.funcao} onChange={campo('funcao')} className={CAMPO}>
            <option value="">Não informar</option>
            {FUNCOES.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <div className="flex justify-end sm:col-span-2">
          <Botao ocupado={salvando} desabilitado={!f.hospital_id || !f.data || !f.paciente.trim()} onClick={salvar}>
            Marcar
          </Botao>
        </div>
      </div>
    </Janela>
  );
}

/** Calendário compacto para a tela inicial: clicou no dia, abre as cirurgias dele. */
export function MiniCalendario({ estado, hoje, abrirAgenda }: Pick<PropsDaAba, 'estado' | 'hoje'> & { abrirAgenda: () => void }) {
  const [mes, setMes] = useState(hoje.slice(0, 7));
  const [dia, setDia] = useState(hoje);
  const semanas = useMemo(() => semanasDoMes(mes), [mes]);
  const porDia = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of estado.cirurgias) m.set(c.data, (m.get(c.data) ?? 0) + 1);
    return m;
  }, [estado.cirurgias]);
  const doDia = cirurgiasDoDia(estado.cirurgias, dia);
  const nomeHospital = (id: string) => estado.hospitais.find((h) => h.id === id)?.nome ?? '';
  const [ano, m] = mes.split('-').map(Number) as [number, number];

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {MESES[m - 1]} <span className="font-normal text-neutral-400">{ano}</span>
        </h2>
        <span className="flex">
          <button type="button" onClick={() => setMes(mesVizinho(mes, -1))} aria-label="Mês anterior" className="rounded-full p-1.5 hover:bg-neutral-100">
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <button type="button" onClick={() => setMes(mesVizinho(mes, 1))} aria-label="Próximo mês" className="rounded-full p-1.5 hover:bg-neutral-100">
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        </span>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] font-medium text-neutral-400" aria-hidden>
        {DIAS.map((d, i) => (
          <span key={i} className="py-1">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {semanas.flat().map((d, i) => {
          if (!d) return <span key={i} />;
          const n = porDia.get(d) ?? 0;
          const escolhido = d === dia;
          return (
            <button key={d} type="button" onClick={() => setDia(d)} aria-pressed={escolhido} aria-label={`${dataBr(d)}${n > 0 ? `, ${n} ${n === 1 ? 'cirurgia' : 'cirurgias'}` : ''}`} className="group flex flex-col items-center py-0.5">
              <span className={`grid h-9 w-9 place-items-center rounded-full text-sm transition ${escolhido ? 'bg-medico font-semibold text-white' : d === hoje ? 'font-semibold text-medico ring-1 ring-medico/40' : 'group-hover:bg-neutral-100'}`}>
                {Number(d.slice(8))}
              </span>
              <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${n > 0 ? (d >= hoje ? 'bg-medico-claro' : 'bg-neutral-300') : ''}`} aria-hidden />
            </button>
          );
        })}
      </div>
      <div className="mt-3 border-t border-neutral-200 pt-3">
        <p className="text-sm font-medium">
          {dia === hoje ? 'Hoje' : dataBr(dia)} <span className="font-normal text-neutral-500">· {doDia.length === 0 ? 'nada marcado' : `${doDia.length} ${doDia.length === 1 ? 'cirurgia' : 'cirurgias'}`}</span>
        </p>
        <ul className="mt-2 space-y-1.5">
          {doDia.slice(0, 4).map((c) => (
            <li key={c.id} className="flex items-center gap-2.5 rounded-xl bg-neutral-100 px-3 py-2 text-sm">
              <span className="w-11 shrink-0 font-semibold text-medico">{c.hora || '--:--'}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{c.procedimento || 'Cirurgia'}</span>
                <span className="block truncate text-xs text-neutral-500">{nomeHospital(c.hospital_id)}</span>
              </span>
            </li>
          ))}
        </ul>
        <button type="button" onClick={abrirAgenda} className="mt-3 text-sm font-semibold text-medico hover:underline">
          Abrir a agenda
        </button>
      </div>
    </section>
  );
}
