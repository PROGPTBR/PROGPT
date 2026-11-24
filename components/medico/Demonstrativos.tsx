'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronDown, FileUp, Plus, Trash2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';

import { CompradorImportDialog } from '@/components/assistants/CompradorImportDialog';
import { casarItens, ETAPA_LABEL, ETAPAS, etapaDe, PROXIMO_PASSO, totalDosItens, type Etapa } from '@/lib/medico/conciliacao';
import { envioDaNota, pedidoDeNota } from '@/lib/medico/mensagens';
import type { Demonstrativo } from '@/lib/medico/types';
import { hospitalPeloNome } from './Cirurgias';
import { Botao, brl, CAMPO, CARTAO, chamar, dataBr, Janela, JanelaDeMensagem, lerNumero, ROTULO, Selo, TD, TH, type PropsDaAba } from './ui';

// Demonstrativos e notas: cada demonstrativo que o hospital manda percorre
// recebido → nota pedida ao contador → nota emitida → nota enviada → pago.

const COR_ETAPA: Record<Etapa, 'amarelo' | 'azul' | 'verde'> = {
  recebido: 'amarelo',
  nota_pedida: 'azul',
  nota_emitida: 'amarelo',
  nota_enviada: 'azul',
  pago: 'verde',
};

const DATA_DA_ETAPA: Record<Etapa, keyof Demonstrativo> = {
  recebido: 'recebido_em',
  nota_pedida: 'nota_pedida_em',
  nota_emitida: 'nota_emitida_em',
  nota_enviada: 'nota_enviada_em',
  pago: 'pago_em',
};

export function Demonstrativos(props: PropsDaAba) {
  const { estado } = props;
  const [novo, setNovo] = useState(false);

  if (estado.hospitais.length === 0) {
    return <p className={`${CARTAO} text-sm text-muted-foreground`}>Cadastre pelo menos um hospital em &quot;Cadastros&quot; para registrar demonstrativos.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Registre o demonstrativo assim que o hospital mandar: o sistema confere com as suas cirurgias e acompanha a nota até o pagamento.</p>
        <Botao onClick={() => setNovo(true)}>
          <Plus className="h-4 w-4" aria-hidden /> Novo demonstrativo
        </Botao>
      </div>

      {estado.demonstrativos.length === 0 ? (
        <p className={`${CARTAO} text-sm text-muted-foreground`}>Nenhum demonstrativo registrado ainda.</p>
      ) : (
        estado.demonstrativos.map((d) => <CartaoDoDemonstrativo key={d.id} d={d} {...props} />)
      )}

      {novo && <NovoDemonstrativo {...props} onFechar={() => setNovo(false)} />}
    </div>
  );
}

function CartaoDoDemonstrativo({ d, estado, hoje, enviar }: PropsDaAba & { d: Demonstrativo }) {
  const hospital = estado.hospitais.find((h) => h.id === d.hospital_id);
  const etapa = etapaDe(d);
  const indice = ETAPAS.indexOf(etapa);
  const [aberto, setAberto] = useState(false);
  const [mensagem, setMensagem] = useState<'pedido' | 'envio' | null>(null);
  const [numero, setNumero] = useState('');
  const [dataNota, setDataNota] = useState(hoje);
  const [valorPago, setValorPago] = useState(String(d.valor_total.toFixed(2)).replace('.', ','));
  const [dataPago, setDataPago] = useState(hoje);
  const [ocupado, setOcupado] = useState(false);
  if (!hospital) return null;

  async function gravar(patch: Record<string, unknown>, sucesso: string) {
    setOcupado(true);
    await enviar('PATCH', `/demonstrativos/${d.id}`, patch, sucesso);
    setOcupado(false);
  }

  function voltar() {
    const patch: Record<string, unknown> =
      etapa === 'pago'
        ? { pago_em: null, valor_pago: null }
        : etapa === 'nota_enviada'
          ? { nota_enviada_em: null }
          : etapa === 'nota_emitida'
            ? { nota_emitida_em: null, nota_numero: '' }
            : { nota_pedida_em: null };
    void gravar(patch, 'Etapa desfeita.');
  }

  const pagoAMenos = d.pago_em && d.valor_pago != null && d.valor_pago < d.valor_total - 0.005;

  return (
    <article className={CARTAO}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold">
            {hospital.nome}
            {d.referencia && <span className="font-normal text-muted-foreground">, {d.referencia}</span>}
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Recebido em {dataBr(d.recebido_em)} · {d.itens.length} {d.itens.length === 1 ? 'procedimento' : 'procedimentos'}
            {d.nota_numero && ` · Nota ${d.nota_numero}`}
          </p>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold">{brl(d.valor_total)}</div>
          <Selo cor={COR_ETAPA[etapa]}>{ETAPA_LABEL[etapa]}</Selo>
        </div>
      </div>

      <ol className="mt-4 grid gap-2 sm:grid-cols-5">
        {ETAPAS.map((e, i) => {
          const feita = i <= indice;
          const data = d[DATA_DA_ETAPA[e]] as string | null;
          return (
            <li key={e} className={`rounded-xl border px-3 py-2 text-xs ${feita ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-dashed border-border text-muted-foreground'}`}>
              <div className="flex items-center gap-1.5 font-medium">
                {feita ? <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden /> : <span className="inline-block h-3.5 w-3.5 rounded-full border border-current opacity-50" aria-hidden />}
                {ETAPA_LABEL[e]}
              </div>
              <div className="mt-0.5 pl-5">{feita && data ? dataBr(data) : i === indice + 1 ? 'próximo passo' : ''}</div>
            </li>
          );
        })}
      </ol>

      {pagoAMenos && (
        <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-200">
          O hospital pagou {brl(d.valor_pago)} e o demonstrativo dizia {brl(d.valor_total)}: faltam {brl(d.valor_total - d.valor_pago!)}.
        </p>
      )}

      {etapa !== 'pago' && (
        <div className="mt-4 rounded-xl bg-muted/50 p-3">
          <p className="mb-2 text-sm font-medium">Agora: {PROXIMO_PASSO[etapa]}</p>
          {etapa === 'recebido' && <Botao onClick={() => setMensagem('pedido')}>Pedir a nota ao contador</Botao>}
          {etapa === 'nota_pedida' && (
            <div className="flex flex-wrap items-end gap-2">
              <label>
                <span className={ROTULO}>Número da nota</span>
                <input value={numero} onChange={(e) => setNumero(e.target.value)} className={`${CAMPO} w-36`} />
              </label>
              <label>
                <span className={ROTULO}>Emitida em</span>
                <input type="date" value={dataNota} onChange={(e) => setDataNota(e.target.value)} className={`${CAMPO} w-44`} />
              </label>
              <Botao ocupado={ocupado} desabilitado={!numero.trim() || !dataNota} onClick={() => gravar({ nota_numero: numero.trim(), nota_emitida_em: dataNota }, 'Nota registrada.')}>
                Registrar nota
              </Botao>
            </div>
          )}
          {etapa === 'nota_emitida' && <Botao onClick={() => setMensagem('envio')}>Enviar a nota ao hospital</Botao>}
          {etapa === 'nota_enviada' && (
            <div className="flex flex-wrap items-end gap-2">
              <label>
                <span className={ROTULO}>Valor que caiu na conta (R$)</span>
                <input value={valorPago} onChange={(e) => setValorPago(e.target.value)} inputMode="decimal" className={`${CAMPO} w-44`} />
              </label>
              <label>
                <span className={ROTULO}>Pago em</span>
                <input type="date" value={dataPago} onChange={(e) => setDataPago(e.target.value)} className={`${CAMPO} w-44`} />
              </label>
              <Botao
                ocupado={ocupado}
                desabilitado={lerNumero(valorPago) == null || !dataPago}
                onClick={() => gravar({ pago_em: dataPago, valor_pago: lerNumero(valorPago) }, 'Pagamento confirmado.')}
              >
                Confirmar pagamento
              </Botao>
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto} className="inline-flex items-center gap-1 hover:text-foreground">
          <ChevronDown className={`h-4 w-4 transition ${aberto ? 'rotate-180' : ''}`} aria-hidden /> {aberto ? 'Esconder' : 'Ver'} procedimentos
        </button>
        {etapa !== 'recebido' && (
          <button type="button" onClick={voltar} disabled={ocupado} className="inline-flex items-center gap-1 hover:text-foreground">
            <Undo2 className="h-3.5 w-3.5" aria-hidden /> Desfazer última etapa
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Apagar este demonstrativo? As cirurgias dele voltam a ficar em aberto.')) void enviar('DELETE', `/demonstrativos/${d.id}`, undefined, 'Demonstrativo apagado.');
          }}
          className="ml-auto inline-flex items-center gap-1 hover:text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden /> Apagar
        </button>
      </div>

      {aberto && (
        <div className="mt-3 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className={TH}>Data</th>
                <th className={TH}>Paciente</th>
                <th className={TH}>Procedimento</th>
                <th className={TH}>Convênio</th>
                <th className={`${TH} text-right`}>Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {d.itens.map((i, k) => (
                <tr key={k}>
                  <td className={`${TD} whitespace-nowrap`}>{dataBr(i.data)}</td>
                  <td className={`${TD} whitespace-nowrap font-medium`}>{i.paciente}</td>
                  <td className={`${TD} min-w-[12rem]`}>{i.procedimento}</td>
                  <td className={`${TD} whitespace-nowrap`}>{i.convenio}</td>
                  <td className={`${TD} whitespace-nowrap text-right`}>{brl(i.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {mensagem === 'pedido' && (
        <JanelaDeMensagem
          titulo="Pedir a nota ao contador"
          mensagem={pedidoDeNota(d, hospital, estado.config)}
          onFechar={() => setMensagem(null)}
          acao={{
            rotulo: 'Já pedi a nota',
            executar: async () => {
              await gravar({ nota_pedida_em: hoje }, 'Marcado: nota pedida ao contador.');
              setMensagem(null);
            },
          }}
        />
      )}
      {mensagem === 'envio' && (
        <JanelaDeMensagem
          titulo="Enviar a nota ao hospital"
          mensagem={envioDaNota(d, hospital, estado.config)}
          aviso="Lembre de anexar o PDF da nota no e-mail antes de enviar."
          onFechar={() => setMensagem(null)}
          acao={{
            rotulo: 'Já enviei a nota',
            executar: async () => {
              await gravar({ nota_enviada_em: hoje }, 'Marcado: nota enviada ao hospital.');
              setMensagem(null);
            },
          }}
        />
      )}
    </article>
  );
}

type ItemLido = { data: string | null; paciente: string; procedimento: string; convenio: string; valor: number | null };

function NovoDemonstrativo({ estado, hoje, enviar, onFechar }: PropsDaAba & { onFechar: () => void }) {
  const [hospitalId, setHospitalId] = useState(estado.hospitais.length === 1 ? estado.hospitais[0]!.id : '');
  const [recebido, setRecebido] = useState(hoje);
  const [referencia, setReferencia] = useState('');
  const [texto, setTexto] = useState('');
  const [importar, setImportar] = useState(false);
  const [lendo, setLendo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [itens, setItens] = useState<ItemLido[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);

  async function ler() {
    setLendo(true);
    const r = await chamar<{ leitura: { hospital: string | null; referencia: string | null; valor_total: number | null; itens: (Omit<ItemLido, 'procedimento' | 'convenio'> & { procedimento: string | null; convenio: string | null })[] } }>(
      'POST',
      '/extrair',
      { tipo: 'demonstrativo', texto },
    );
    setLendo(false);
    if (!r.ok) return void toast.error(r.mensagem);
    const l = r.dados.leitura;
    if (l.itens.length === 0) return void toast.error('Não encontrei nenhum procedimento nesse demonstrativo.');
    setItens(l.itens.map((i) => ({ ...i, procedimento: i.procedimento ?? '', convenio: i.convenio ?? '' })));
    setTotal(l.valor_total);
    if (!referencia && l.referencia) setReferencia(l.referencia);
    if (!hospitalId) setHospitalId(hospitalPeloNome(l.hospital, estado));
  }

  const casados = useMemo(() => (itens && hospitalId ? casarItens(itens, estado.cirurgias, hospitalId) : []), [itens, hospitalId, estado.cirurgias]);
  const idsCasados = new Set(casados.map((i) => i.cirurgia_id).filter(Boolean));
  const ultimaData = itens?.map((i) => i.data).filter(Boolean).sort().at(-1) ?? recebido;
  const deFora = hospitalId ? estado.cirurgias.filter((c) => c.hospital_id === hospitalId && !c.demonstrativo_id && !idsCasados.has(c.id) && c.data <= ultimaData!) : [];

  async function salvar() {
    if (!itens) return;
    setSalvando(true);
    const r = await enviar<{ casadas: number; criadas: number }>('POST', '/demonstrativos', {
      hospital_id: hospitalId,
      referencia,
      recebido_em: recebido,
      valor_total: total,
      itens,
    });
    setSalvando(false);
    if (!r) return;
    toast.success(`Demonstrativo salvo: ${r.casadas} ${r.casadas === 1 ? 'cirurgia conferida' : 'cirurgias conferidas'}${r.criadas > 0 ? `, ${r.criadas} que você não tinha anotado` : ''}.`);
    onFechar();
  }

  return (
    <Janela titulo="Novo demonstrativo" onFechar={onFechar} larga>
      <div className="space-y-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-3">
          <label>
            <span className={ROTULO}>Hospital</span>
            <select value={hospitalId} onChange={(e) => setHospitalId(e.target.value)} className={CAMPO}>
              <option value="">Escolha</option>
              {estado.hospitais.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={ROTULO}>Recebido em</span>
            <input type="date" value={recebido} onChange={(e) => setRecebido(e.target.value)} className={CAMPO} />
          </label>
          <label>
            <span className={ROTULO}>Referência (opcional)</span>
            <input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="ex.: outubro/2026" className={CAMPO} />
          </label>
        </div>

        {!itens ? (
          <>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className={ROTULO}>Demonstrativo (cole o texto do e-mail ou importe o arquivo)</span>
                <button type="button" onClick={() => setImportar(true)} className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
                  <FileUp className="h-3.5 w-3.5" aria-hidden /> Importar PDF, Excel ou Word
                </button>
              </div>
              <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={9} className={`${CAMPO} h-auto py-2`} aria-label="Texto do demonstrativo" />
            </div>
            <div className="flex justify-end">
              <Botao ocupado={lendo} desabilitado={texto.trim().length < 10} onClick={ler}>
                Ler demonstrativo
              </Botao>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p>
                <strong>{itens.length}</strong> {itens.length === 1 ? 'procedimento lido' : 'procedimentos lidos'}, total de <strong>{brl(total ?? totalDosItens(itens))}</strong>.
              </p>
              <button type="button" onClick={() => setItens(null)} className="text-xs text-muted-foreground hover:text-foreground">
                Ler de novo
              </button>
            </div>
            {!hospitalId && <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-amber-900 dark:text-amber-200">Escolha o hospital para conferir com as suas cirurgias.</p>}
            <div className="max-h-72 overflow-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className={TH}>Data</th>
                    <th className={TH}>Paciente</th>
                    <th className={TH}>Procedimento</th>
                    <th className={`${TH} text-right`}>Valor</th>
                    <th className={TH}>Conferência</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(hospitalId ? casados : itens.map((i) => ({ ...i, cirurgia_id: null }))).map((i, k) => (
                    <tr key={k}>
                      <td className={`${TD} whitespace-nowrap`}>{dataBr(i.data)}</td>
                      <td className={`${TD} whitespace-nowrap font-medium`}>{i.paciente}</td>
                      <td className={TD}>{i.procedimento}</td>
                      <td className={`${TD} whitespace-nowrap text-right`}>{brl(i.valor)}</td>
                      <td className={TD}>
                        {!hospitalId ? null : i.cirurgia_id ? (
                          <Selo cor="verde">Bate com a sua lista</Selo>
                        ) : i.data ? (
                          <Selo cor="azul">Você não tinha anotado</Selo>
                        ) : (
                          <Selo cor="amarelo">Sem data, não conferida</Selo>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {deFora.length > 0 && (
              <div className="rounded-xl bg-red-500/10 px-3 py-2 text-red-800 dark:text-red-200">
                <p className="font-medium">
                  {deFora.length} {deFora.length === 1 ? 'cirurgia sua ficou de fora' : 'cirurgias suas ficaram de fora'} deste demonstrativo:
                </p>
                <ul className="mt-1 list-disc pl-5">
                  {deFora.slice(0, 8).map((c) => (
                    <li key={c.id}>
                      {dataBr(c.data)}: {c.paciente}
                      {c.procedimento && `, ${c.procedimento}`}
                      {c.valor != null && ` (${brl(c.valor)})`}
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-xs">Elas vão para &quot;Pendências a cobrar&quot;.</p>
              </div>
            )}
            <div className="flex justify-end">
              <Botao ocupado={salvando} desabilitado={!hospitalId || !recebido} onClick={salvar}>
                Salvar demonstrativo
              </Botao>
            </div>
          </>
        )}
      </div>

      <CompradorImportDialog
        open={importar}
        onClose={() => setImportar(false)}
        titulo="Importar demonstrativo"
        onImported={(t) => setTexto((atual) => (atual.trim() ? `${atual}\n\n${t}` : t))}
      />
    </Janela>
  );
}
