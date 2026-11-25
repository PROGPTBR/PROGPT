'use client';

import { useMemo, useState } from 'react';
import { FileUp, MessageSquareText, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { CompradorImportDialog } from '@/components/assistants/CompradorImportDialog';
import { partesDoNome, passouDoCiclo } from '@/lib/medico/conciliacao';
import { FUNCOES, type Cirurgia, type Entrada, type EstadoMedico } from '@/lib/medico/types';
import { Botao, brl, CAMPO, CARTAO, chamar, dataBr, Janela, lerNumero, ROTULO, Selo, TD, TH, type PropsDaAba, Info } from './ui';

// Cirurgias feitas: a lista que o médico mantinha no grupo de WhatsApp. É
// contra ela que cada demonstrativo é conferido.

type Linha = { hospital_id: string; data: string; paciente: string; procedimento: string; convenio: string; valor: string; funcao: string; registro: string };

/** "2o auxiliar", "2º Auxiliar", "cirurgiao" → a grafia da lista; o que não for reconhecido fica em branco. */
export function funcaoPadrao(v: string | null | undefined): string {
  const t = (v ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (t.includes('aux')) {
    const n = /[123]/.exec(t)?.[0];
    return FUNCOES.find((f) => f.startsWith(`${n}º`)) ?? '';
  }
  if (t.includes('cirurgi')) return 'Cirurgião';
  if (t.includes('anest')) return 'Anestesista';
  if (t.includes('instrument')) return 'Instrumentador';
  return '';
}

/** Situação de uma cirurgia, derivada do demonstrativo em que ela entrou. */
export function situacao(c: Cirurgia, estado: EstadoMedico, hoje: string): { rotulo: string; cor: 'verde' | 'azul' | 'amarelo' | 'vermelho' } {
  if (c.demonstrativo_id) {
    const d = estado.demonstrativos.find((x) => x.id === c.demonstrativo_id);
    if (d?.pago_em) return { rotulo: 'Paga', cor: 'verde' };
    return d?.tipo === 'direto' ? { rotulo: 'Cobrada do paciente', cor: 'azul' } : { rotulo: 'No demonstrativo', cor: 'azul' };
  }
  // O hospital paga por mês: só é atraso se o demonstrativo do mês veio sem ela, ou se o prazo dele passou.
  return passouDoCiclo(c, estado.demonstrativos, hoje) ? { rotulo: 'Sem pagamento, atrasada', cor: 'vermelho' } : { rotulo: 'Aguardando demonstrativo', cor: 'amarelo' };
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

export function Cirurgias({ estado, hoje, enviar, abrir }: PropsDaAba & { abrir?: string | null }) {
  const [filtroHospital, setFiltroHospital] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState('');
  const [nova, setNova] = useState(abrir === 'nova-cirurgia');
  const [colar, setColar] = useState(false);
  const [doGrupo, setDoGrupo] = useState<Entrada[] | null>(null);
  const novas = useMemo(() => estado.entradas.filter((e) => e.canal === 'whatsapp'), [estado.entradas]);

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
      {novas.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-medico/40 bg-medico/5 px-4 py-3 text-sm">
          <p>
            <strong>
              {novas.length} {novas.length === 1 ? 'mensagem nova' : 'mensagens novas'}
            </strong>{' '}
            no grupo {estado.config.grupo_nome ? `"${estado.config.grupo_nome}"` : 'das cirurgias'}.
          </p>
          <div className="flex flex-wrap gap-2">
            <Botao tipo="secundario" onClick={() => void enviar('POST', '/entradas', { ids: novas.map((e) => e.id) }, 'Mensagens descartadas.')}>
              Descartar
            </Botao>
            <Botao onClick={() => setDoGrupo(novas)}>Ler cirurgias</Botao>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-1 text-xl font-semibold">
          Cirurgias <Info>A lista do que você operou. É contra ela que cada demonstrativo do hospital é conferido. Você pode colar as mensagens do grupo de WhatsApp e a IA separa as cirurgias.</Info>
        </h2>
        <div className="flex gap-2">
          <Botao tipo="secundario" onClick={() => setColar(true)}>
            <MessageSquareText className="h-4 w-4" aria-hidden /> Colar
          </Botao>
          <Botao onClick={() => setNova(true)}>
            <Plus className="h-4 w-4" aria-hidden /> Nova
          </Botao>
        </div>
      </div>
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
            {['Paga', 'No demonstrativo', 'Cobrada do paciente', 'Aguardando demonstrativo', 'Sem pagamento, atrasada'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {lista.length === 0 ? (
        <p className={`${CARTAO} text-sm text-muted-foreground`}>Nenhuma cirurgia aqui ainda. Registre uma ou cole as mensagens do grupo de WhatsApp.</p>
      ) : (
        <ul className="divide-y divide-neutral-200 border-y border-neutral-200 sm:hidden">
          {lista.map(({ c, s }) => (
            <li key={c.id} className="flex items-center gap-3 py-3">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${{ verde: 'bg-emerald-500', azul: 'bg-medico-claro', amarelo: 'bg-amber-400', vermelho: 'bg-red-500' }[s.cor]}`} title={s.rotulo} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{c.paciente}</span>
                <span className="block truncate text-xs text-neutral-500">
                  {dataBr(c.data)} · {nomeHospital(c.hospital_id)} · {c.procedimento || 'Cirurgia'}
                </span>
                <span className="block text-xs text-neutral-500">{s.rotulo}</span>
              </span>
              <span className="shrink-0 text-sm font-semibold">{c.valor == null ? '' : brl(c.valor)}</span>
            </li>
          ))}
        </ul>
      )}
      {lista.length > 0 && (
        <div className="hidden overflow-x-auto rounded-2xl ring-1 ring-black/[0.06] sm:block">
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
          linhasIniciais={[{ hospital_id: estado.hospitais[0]!.id, data: hoje, paciente: '', procedimento: '', convenio: '', valor: '', funcao: '', registro: '' }]}
          origem="manual"
          onFechar={() => setNova(false)}
          enviar={enviar}
        />
      )}
      {colar && <ColarDoWhatsApp estado={estado} onFechar={() => setColar(false)} enviar={enviar} />}
      {doGrupo && <ColarDoWhatsApp estado={estado} entradas={doGrupo} onFechar={() => setDoGrupo(null)} enviar={enviar} />}
    </div>
  );
}

/** Mensagens do grupo no formato que a IA lê: "[dia hora] quem: texto". */
export function textoDasEntradas(entradas: Entrada[]): string {
  return entradas
    .map((e) => {
      const quando = new Date(e.recebido_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
      return `[${quando}] ${e.remetente || 'Grupo'}: ${e.texto}`;
    })
    .join('\n');
}

function ColarDoWhatsApp({ estado, onFechar, enviar, entradas }: Pick<PropsDaAba, 'estado' | 'enviar'> & { onFechar: () => void; entradas?: Entrada[] }) {
  const [texto, setTexto] = useState(() => (entradas ? textoDasEntradas(entradas) : ''));
  const [lendo, setLendo] = useState(false);
  const [importar, setImportar] = useState(false);
  const [linhas, setLinhas] = useState<Linha[] | null>(null);

  async function ler() {
    setLendo(true);
    const r = await chamar<{ leitura: { cirurgias: { data: string | null; paciente: string; procedimento: string | null; convenio: string | null; valor: number | null; hospital: string | null; funcao: string | null; registro: string | null }[] } }>(
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
        funcao: funcaoPadrao(c.funcao),
        registro: c.registro ?? '',
      })),
    );
  }

  // Depois de salvar o que veio do grupo, as mensagens saem da caixa de entrada.
  const aoSalvar = entradas ? () => enviar('POST', '/entradas', { ids: entradas.map((e) => e.id) }).then(() => undefined) : undefined;

  if (linhas) {
    return <EditorDeCirurgias aoSalvar={aoSalvar} titulo={`Conferir ${linhas.length} ${linhas.length === 1 ? 'cirurgia lida' : 'cirurgias lidas'}`} estado={estado} linhasIniciais={linhas} origem="whatsapp" onFechar={onFechar} enviar={enviar} />;
  }

  return (
    <Janela titulo={entradas ? 'Mensagens novas do grupo' : 'Colar do WhatsApp'} onFechar={onFechar}>
      <div className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Cole as mensagens do grupo ou importe a planilha do mês que a secretária fecha. A IA separa as cirurgias e você confere antes de salvar.
        </p>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={10}
          placeholder={'12/11 D\'Or: M.A.S., colecistectomia, Bradesco\n14/11 CHN: J.P.R., hérnia inguinal, Unimed'}
          className={`${CAMPO} h-auto py-2`}
          aria-label="Texto com as cirurgias"
        />
        <p className="text-xs text-muted-foreground">O hospital pede o nome completo do paciente na planilha de pendências: escreva o nome como está no prontuário.</p>
        <div className="flex flex-wrap justify-between gap-2">
          <Botao tipo="secundario" onClick={() => setImportar(true)}>
            <FileUp className="h-4 w-4" aria-hidden /> Importar planilha
          </Botao>
          <Botao ocupado={lendo} desabilitado={texto.trim().length < 10} onClick={ler}>
            Ler cirurgias
          </Botao>
        </div>
        <CompradorImportDialog open={importar} onClose={() => setImportar(false)} titulo="Importar a planilha de cirurgias" onImported={(t) => setTexto((atual) => (atual.trim() ? `${atual}\n\n${t}` : t))} />
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
  aoSalvar,
}: Pick<PropsDaAba, 'estado' | 'enviar'> & { titulo: string; linhasIniciais: Linha[]; origem: 'manual' | 'whatsapp'; onFechar: () => void; aoSalvar?: () => Promise<void> }) {
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
    if (ok) await aoSalvar?.();
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
              <span className={ROTULO}>Paciente (nome como está no hospital)</span>
              <input value={l.paciente} onChange={(e) => mudar(i, 'paciente', e.target.value)} className={CAMPO} />
            </label>
            <label className="sm:col-span-3">
              <span className={ROTULO}>Procedimento</span>
              <input value={l.procedimento} onChange={(e) => mudar(i, 'procedimento', e.target.value)} className={CAMPO} />
            </label>
            <label className="sm:col-span-2">
              <span className={ROTULO}>Convênio e plano</span>
              <input value={l.convenio} onChange={(e) => mudar(i, 'convenio', e.target.value)} className={CAMPO} />
            </label>
            <label>
              <span className={ROTULO}>Valor (R$)</span>
              <input value={l.valor} onChange={(e) => mudar(i, 'valor', e.target.value)} inputMode="decimal" className={CAMPO} />
            </label>
            <label className="sm:col-span-2">
              <span className={ROTULO}>Sua função na cirurgia</span>
              <select value={l.funcao} onChange={(e) => mudar(i, 'funcao', e.target.value)} className={CAMPO}>
                <option value="">Não informar</option>
                {FUNCOES.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </label>
            <label className="sm:col-span-2">
              <span className={ROTULO}>Nº de registro (opcional)</span>
              <input value={l.registro} onChange={(e) => mudar(i, 'registro', e.target.value)} className={CAMPO} />
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
