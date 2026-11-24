'use client';

import { useMemo, useState } from 'react';
import { MessageSquareText, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { diasEntre, partesDoNome } from '@/lib/medico/conciliacao';
import type { Cirurgia, EstadoMedico } from '@/lib/medico/types';
import { Botao, brl, CAMPO, CARTAO, chamar, dataBr, Janela, lerNumero, ROTULO, Selo, TD, TH, type PropsDaAba } from './ui';

// Cirurgias feitas: a lista que o médico mantinha no grupo de WhatsApp. É
// contra ela que cada demonstrativo é conferido.

type Linha = { hospital_id: string; data: string; paciente: string; procedimento: string; convenio: string; valor: string };

/** Situação de uma cirurgia, derivada do demonstrativo em que ela entrou. */
export function situacao(c: Cirurgia, estado: EstadoMedico, hoje: string): { rotulo: string; cor: 'verde' | 'azul' | 'amarelo' | 'vermelho' } {
  if (c.demonstrativo_id) {
    const d = estado.demonstrativos.find((x) => x.id === c.demonstrativo_id);
    return d?.pago_em ? { rotulo: 'Paga', cor: 'verde' } : { rotulo: 'No demonstrativo', cor: 'azul' };
  }
  const prazo = estado.hospitais.find((h) => h.id === c.hospital_id)?.prazo_pagamento_dias ?? 30;
  return diasEntre(c.data, hoje) > prazo ? { rotulo: 'Sem pagamento, atrasada', cor: 'vermelho' } : { rotulo: 'Aguardando demonstrativo', cor: 'amarelo' };
}

/** Acha o hospital cadastrado que o texto cita ("D'Or" → "Niterói D'Or"). */
export function hospitalPeloNome(nome: string | null, estado: EstadoMedico): string {
  if (!nome) return '';
  const alvo = partesDoNome(nome).join(' ');
  if (!alvo) return '';
  const achado = estado.hospitais.find((h) => {
    const n = partesDoNome(h.nome).join(' ');
    return n === alvo || n.includes(alvo) || alvo.includes(n);
  });
  return achado?.id ?? '';
}

export function Cirurgias({ estado, hoje, enviar }: PropsDaAba) {
  const [filtroHospital, setFiltroHospital] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState('');
  const [nova, setNova] = useState(false);
  const [colar, setColar] = useState(false);

  const nomeHospital = (id: string) => estado.hospitais.find((h) => h.id === id)?.nome ?? '';
  const lista = useMemo(
    () =>
      estado.cirurgias
        .map((c) => ({ c, s: situacao(c, estado, hoje) }))
        .filter(({ c, s }) => (!filtroHospital || c.hospital_id === filtroHospital) && (!filtroSituacao || s.rotulo === filtroSituacao)),
    [estado, hoje, filtroHospital, filtroSituacao],
  );

  if (estado.hospitais.length === 0) {
    return <p className={`${CARTAO} text-sm text-muted-foreground`}>Cadastre pelo menos um hospital em &quot;Cadastros&quot; para registrar cirurgias.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <select value={filtroHospital} onChange={(e) => setFiltroHospital(e.target.value)} className={`${CAMPO} w-auto`} aria-label="Filtrar por hospital">
            <option value="">Todos os hospitais</option>
            {estado.hospitais.map((h) => (
              <option key={h.id} value={h.id}>
                {h.nome}
              </option>
            ))}
          </select>
          <select value={filtroSituacao} onChange={(e) => setFiltroSituacao(e.target.value)} className={`${CAMPO} w-auto`} aria-label="Filtrar por situação">
            <option value="">Todas as situações</option>
            {['Paga', 'No demonstrativo', 'Aguardando demonstrativo', 'Sem pagamento, atrasada'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Botao tipo="secundario" onClick={() => setColar(true)}>
            <MessageSquareText className="h-4 w-4" aria-hidden /> Colar do WhatsApp
          </Botao>
          <Botao onClick={() => setNova(true)}>
            <Plus className="h-4 w-4" aria-hidden /> Nova cirurgia
          </Botao>
        </div>
      </div>

      {lista.length === 0 ? (
        <p className={`${CARTAO} text-sm text-muted-foreground`}>Nenhuma cirurgia aqui ainda. Registre uma ou cole as mensagens do grupo de WhatsApp.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className={TH}>Data</th>
                <th className={TH}>Paciente</th>
                <th className={TH}>Procedimento</th>
                <th className={TH}>Hospital</th>
                <th className={TH}>Convênio</th>
                <th className={`${TH} text-right`}>Valor</th>
                <th className={TH}>Situação</th>
                <th className={TH} />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lista.map(({ c, s }) => (
                <tr key={c.id}>
                  <td className={`${TD} whitespace-nowrap`}>{dataBr(c.data)}</td>
                  <td className={`${TD} whitespace-nowrap font-medium`}>{c.paciente}</td>
                  <td className={`${TD} min-w-[12rem]`}>{c.procedimento}</td>
                  <td className={`${TD} whitespace-nowrap`}>{nomeHospital(c.hospital_id)}</td>
                  <td className={`${TD} whitespace-nowrap`}>{c.convenio}</td>
                  <td className={`${TD} whitespace-nowrap text-right`}>{brl(c.valor)}</td>
                  <td className={TD}>
                    <Selo cor={s.cor}>{s.rotulo}</Selo>
                  </td>
                  <td className={`${TD} text-right`}>
                    <button
                      type="button"
                      aria-label={`Apagar cirurgia de ${c.paciente}`}
                      title="Apagar"
                      onClick={() => {
                        if (window.confirm(`Apagar a cirurgia de ${c.paciente} em ${dataBr(c.data)}?`)) void enviar('DELETE', `/cirurgias/${c.id}`, undefined, 'Cirurgia apagada.');
                      }}
                      className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {nova && (
        <EditorDeCirurgias
          titulo="Nova cirurgia"
          estado={estado}
          linhasIniciais={[{ hospital_id: estado.hospitais[0]!.id, data: hoje, paciente: '', procedimento: '', convenio: '', valor: '' }]}
          origem="manual"
          onFechar={() => setNova(false)}
          enviar={enviar}
        />
      )}
      {colar && <ColarDoWhatsApp estado={estado} onFechar={() => setColar(false)} enviar={enviar} />}
    </div>
  );
}

function ColarDoWhatsApp({ estado, onFechar, enviar }: Pick<PropsDaAba, 'estado' | 'enviar'> & { onFechar: () => void }) {
  const [texto, setTexto] = useState('');
  const [lendo, setLendo] = useState(false);
  const [linhas, setLinhas] = useState<Linha[] | null>(null);

  async function ler() {
    setLendo(true);
    const r = await chamar<{ leitura: { cirurgias: { data: string | null; paciente: string; procedimento: string | null; convenio: string | null; valor: number | null; hospital: string | null }[] } }>(
      'POST',
      '/extrair',
      { tipo: 'cirurgias', texto, hospitais: estado.hospitais.map((h) => h.nome) },
    );
    setLendo(false);
    if (!r.ok) return void toast.error(r.mensagem);
    if (r.dados.leitura.cirurgias.length === 0) return void toast.error('Não encontrei nenhuma cirurgia nesse texto.');
    const unico = estado.hospitais.length === 1 ? estado.hospitais[0]!.id : '';
    setLinhas(
      r.dados.leitura.cirurgias.map((c) => ({
        hospital_id: hospitalPeloNome(c.hospital, estado) || unico,
        data: c.data ?? '',
        paciente: c.paciente,
        procedimento: c.procedimento ?? '',
        convenio: c.convenio ?? '',
        valor: c.valor == null ? '' : String(c.valor).replace('.', ','),
      })),
    );
  }

  if (linhas) {
    return <EditorDeCirurgias titulo={`Conferir ${linhas.length} ${linhas.length === 1 ? 'cirurgia lida' : 'cirurgias lidas'}`} estado={estado} linhasIniciais={linhas} origem="whatsapp" onFechar={onFechar} enviar={enviar} />;
  }

  return (
    <Janela titulo="Colar do WhatsApp" onFechar={onFechar}>
      <div className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Cole as mensagens do grupo, suas anotações ou uma lista copiada de planilha. A IA separa as cirurgias e você confere antes de salvar.
        </p>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={10}
          placeholder={'12/11 D\'Or: M.A.S., colecistectomia, Bradesco\n14/11 CHN: J.P.R., hérnia inguinal, Unimed'}
          className={`${CAMPO} h-auto py-2`}
          aria-label="Texto com as cirurgias"
        />
        <p className="text-xs text-muted-foreground">Nome de paciente é dado de saúde. Se puder, use só as iniciais.</p>
        <div className="flex justify-end">
          <Botao ocupado={lendo} desabilitado={texto.trim().length < 10} onClick={ler}>
            Ler cirurgias
          </Botao>
        </div>
      </div>
    </Janela>
  );
}

function EditorDeCirurgias({
  titulo,
  estado,
  linhasIniciais,
  origem,
  onFechar,
  enviar,
}: Pick<PropsDaAba, 'estado' | 'enviar'> & { titulo: string; linhasIniciais: Linha[]; origem: 'manual' | 'whatsapp'; onFechar: () => void }) {
  const [linhas, setLinhas] = useState(linhasIniciais);
  const [salvando, setSalvando] = useState(false);
  const mudar = (i: number, campo: keyof Linha, v: string) => setLinhas((l) => l.map((x, k) => (k === i ? { ...x, [campo]: v } : x)));
  const incompleta = (l: Linha) => !l.hospital_id || !l.data || !l.paciente.trim();
  const faltando = linhas.filter(incompleta).length;

  async function salvar() {
    setSalvando(true);
    const ok = await enviar(
      'POST',
      '/cirurgias',
      { cirurgias: linhas.map((l) => ({ ...l, valor: lerNumero(l.valor), origem })) },
      linhas.length === 1 ? 'Cirurgia salva.' : `${linhas.length} cirurgias salvas.`,
    );
    setSalvando(false);
    if (ok) onFechar();
  }

  return (
    <Janela titulo={titulo} onFechar={onFechar} larga>
      <div className="space-y-3">
        {linhas.map((l, i) => (
          <div key={i} className={`grid gap-2 rounded-xl border p-3 sm:grid-cols-6 ${incompleta(l) ? 'border-amber-500/50' : 'border-border'}`}>
            <label className="sm:col-span-2">
              <span className={ROTULO}>Hospital</span>
              <select value={l.hospital_id} onChange={(e) => mudar(i, 'hospital_id', e.target.value)} className={CAMPO}>
                <option value="">Escolha</option>
                {estado.hospitais.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="sm:col-span-2">
              <span className={ROTULO}>Data</span>
              <input type="date" value={l.data} onChange={(e) => mudar(i, 'data', e.target.value)} className={CAMPO} />
            </label>
            <label className="sm:col-span-2">
              <span className={ROTULO}>Paciente (iniciais)</span>
              <input value={l.paciente} onChange={(e) => mudar(i, 'paciente', e.target.value)} className={CAMPO} />
            </label>
            <label className="sm:col-span-3">
              <span className={ROTULO}>Procedimento</span>
              <input value={l.procedimento} onChange={(e) => mudar(i, 'procedimento', e.target.value)} className={CAMPO} />
            </label>
            <label className="sm:col-span-2">
              <span className={ROTULO}>Convênio</span>
              <input value={l.convenio} onChange={(e) => mudar(i, 'convenio', e.target.value)} className={CAMPO} />
            </label>
            <label>
              <span className={ROTULO}>Valor (R$)</span>
              <input value={l.valor} onChange={(e) => mudar(i, 'valor', e.target.value)} inputMode="decimal" className={CAMPO} />
            </label>
            {linhas.length > 1 && (
              <div className="sm:col-span-6 text-right">
                <button type="button" onClick={() => setLinhas((x) => x.filter((_, k) => k !== i))} className="text-xs text-muted-foreground hover:text-red-600">
                  Remover esta linha
                </button>
              </div>
            )}
          </div>
        ))}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-amber-700 dark:text-amber-300">{faltando > 0 ? `${faltando} ${faltando === 1 ? 'linha precisa' : 'linhas precisam'} de hospital, data e paciente.` : ''}</p>
          <Botao ocupado={salvando} desabilitado={faltando > 0 || linhas.length === 0} onClick={salvar}>
            Salvar
          </Botao>
        </div>
      </div>
    </Janela>
  );
}
