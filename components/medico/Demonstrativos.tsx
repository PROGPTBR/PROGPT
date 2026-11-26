'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, FileUp, Mail, Paperclip, Plus, Trash2, Undo2, Zap } from 'lucide-react';
import { toast } from 'sonner';

import { CompradorImportDialog } from '@/components/assistants/CompradorImportDialog';
import { casarItens, ETAPA_LABEL, ETAPA_LABEL_DIRETO, ETAPAS, etapaDe, PROXIMO_PASSO, PROXIMO_PASSO_DIRETO, totalDosItens, type Etapa } from '@/lib/medico/conciliacao';
import { cobrancaAoPaciente, envioDaNota, pedidoDeNota, pedidoDeNotaDireto } from '@/lib/medico/mensagens';
import type { Demonstrativo, Entrada } from '@/lib/medico/types';
import { hospitalPeloNome } from './Cirurgias';
import { Anexar, ListaDeDocumentos } from './Documentos';
import { Botao, brl, CAMPO, CARTAO, chamar, dataBr, Janela, JanelaDeMensagem, lerNumero, ROTULO, Selo, TD, TH, type PropsDaAba, Info } from './ui';

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

export function Demonstrativos(props: PropsDaAba & { abrir?: string | null }) {
  const { estado, enviar } = props;
  const [novo, setNovo] = useState(props.abrir === 'demonstrativo');
  const [direto, setDireto] = useState(props.abrir === 'direto');
  const [conferindo, setConferindo] = useState<Entrada | null>(null);
  const emails = estado.entradas.filter((e) => e.canal === 'email');

  if (estado.hospitais.length === 0) {
    return <p className={`${CARTAO} text-sm text-muted-foreground`}>Cadastre pelo menos um hospital em &quot;Cadastros&quot; para registrar demonstrativos.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-1 text-xl font-semibold">
          Notas <Info>Registre o demonstrativo assim que o hospital mandar: o sistema confere com as suas cirurgias e acompanha a nota até o pagamento. Cobrança direta é para quando o paciente paga na hora.</Info>
        </h2>
        <div className="flex gap-2">
          <Botao tipo="secundario" onClick={() => setDireto(true)}>
            <Zap className="h-4 w-4" aria-hidden /> Pagou na hora
          </Botao>
          <Botao onClick={() => setNovo(true)}>
            <Plus className="h-4 w-4" aria-hidden /> Demonstrativo
          </Botao>
        </div>
      </div>

      {emails.map((e) => (
        <div key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-medico/40 bg-medico/5 px-4 py-3 text-sm">
          <p className="min-w-0">
            <Mail className="mr-1.5 inline h-4 w-4 text-medico" aria-hidden />
            <strong>Chegou por e-mail:</strong> {e.assunto || 'sem assunto'}
            <span className="text-muted-foreground"> · {e.remetente}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Botao tipo="secundario" onClick={() => void enviar('POST', '/entradas', { ids: [e.id] }, 'E-mail descartado.')}>
              Descartar
            </Botao>
            <Botao onClick={() => setConferindo(e)}>Conferir demonstrativo</Botao>
          </div>
        </div>
      ))}

      {estado.demonstrativos.length === 0 ? (
        emails.length === 0 && <p className={`${CARTAO} text-sm text-muted-foreground`}>Nenhum demonstrativo registrado ainda.</p>
      ) : (
        <div className="space-y-4 xl:grid xl:grid-cols-2 xl:items-start xl:gap-5 xl:space-y-0">
          {estado.demonstrativos.map((d) => (
            <CartaoDoDemonstrativo key={d.id} d={d} {...props} />
          ))}
        </div>
      )}

      {novo && <NovoDemonstrativo {...props} onFechar={() => setNovo(false)} />}
      {conferindo && <NovoDemonstrativo {...props} entrada={conferindo} onFechar={() => setConferindo(null)} />}
      {direto && <NovaCobrancaDireta {...props} onFechar={() => setDireto(false)} />}
    </div>
  );
}

function CartaoDoDemonstrativo({ d, estado, hoje, enviar, recarregar }: PropsDaAba & { d: Demonstrativo }) {
  const hospital = estado.hospitais.find((h) => h.id === d.hospital_id);
  const etapa = etapaDe(d);
  const indice = ETAPAS.indexOf(etapa);
  const [aberto, setAberto] = useState(false);
  const [mensagem, setMensagem] = useState<'pedido' | 'envio' | null>(null);
  const [anexos, setAnexos] = useState(false);
  const docs = estado.documentos.filter((x) => x.demonstrativo_id === d.id);
  const direto = d.tipo === 'direto';
  const rotulos = direto ? ETAPA_LABEL_DIRETO : ETAPA_LABEL;
  const canais = estado.integracoes.email_envio ? (['email'] as const) : ([] as const);
  const aoEnviar = async () => {
    await recarregar();
    setMensagem(null);
  };
  const [numero, setNumero] = useState('');
  const [dataNota, setDataNota] = useState(hoje);
  const [liquido, setLiquido] = useState('');
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
    <article className="rounded-3xl bg-neutral-50 p-4 ring-1 ring-black/[0.05] sm:p-5 lg:rounded-[2rem] lg:bg-white lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold">{direto ? d.pagador_nome || 'Paciente' : hospital.nome}</h3>
          <p className="truncate text-sm text-neutral-500">
            {direto ? `${d.itens[0]?.procedimento || 'Procedimento'} · ${dataBr(d.recebido_em)}` : `${d.referencia || dataBr(d.recebido_em)} · ${d.itens.length} ${d.itens.length === 1 ? 'procedimento' : 'procedimentos'}`}
            {d.nota_numero && ` · nota ${d.nota_numero}`}
          </p>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold">{brl(d.valor_total)}</div>
          <Selo cor={COR_ETAPA[etapa]}>{rotulos[etapa]}</Selo>
        </div>
      </div>

      <ol className="mt-4 flex gap-1" aria-label={`Etapa: ${rotulos[etapa]}`}>
        {ETAPAS.map((e, i) => (
          <li key={e} title={rotulos[e]} className={`h-1.5 flex-1 rounded-full ${i <= indice ? (etapa === 'pago' ? 'bg-emerald-500' : 'bg-medico') : 'bg-neutral-200'}`} />
        ))}
      </ol>
      <p className="mt-1.5 text-xs text-neutral-500">
        {rotulos[etapa]}
        {d[DATA_DA_ETAPA[etapa]] ? ` desde ${dataBr(d[DATA_DA_ETAPA[etapa]] as string)}` : ''}
      </p>

      {pagoAMenos && (
        <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-200">
          {direto ? 'O paciente' : 'O hospital'} pagou {brl(d.valor_pago)} e {direto ? 'a cobrança era de' : 'o demonstrativo dizia'} {brl(d.valor_total)}: faltam {brl(d.valor_total - d.valor_pago!)}.
        </p>
      )}

      {etapa !== 'pago' && (
        <div className="mt-4">
          <p className="sr-only">Agora: {(direto ? PROXIMO_PASSO_DIRETO : PROXIMO_PASSO)[etapa]}</p>
          {etapa === 'recebido' && <Botao onClick={() => setMensagem('pedido')}>Pedir a nota ao contador</Botao>}
          {etapa === 'nota_pedida' && (
            <div className="flex flex-wrap items-end gap-2">
              <label>
                <span className={ROTULO}>Número da nota</span>
                <input value={numero} onChange={(e) => setNumero(e.target.value)} className={`${CAMPO} !w-36`} />
              </label>
              <label>
                <span className={ROTULO}>Emitida em</span>
                <input type="date" value={dataNota} onChange={(e) => setDataNota(e.target.value)} className={`${CAMPO} !w-44`} />
              </label>
              <label>
                <span className={`${ROTULO} flex items-center gap-1`}>
                  Líquido da nota (R$) <Info>O valor que vai cair na conta: o total da nota menos as retenções (IRRF, PIS/COFINS/CSLL, ISS). Está no campo Valor líquido da NFS-e. Com ele, a conciliação do banco fecha sozinha.</Info>
                </span>
                <input value={liquido} onChange={(e) => setLiquido(e.target.value)} inputMode="decimal" className={`${CAMPO} !w-36`} />
              </label>
              <Botao ocupado={ocupado} desabilitado={!numero.trim() || !dataNota} onClick={() => gravar({ nota_numero: numero.trim(), nota_emitida_em: dataNota, nota_liquido: lerNumero(liquido) }, 'Nota registrada.')}>
                Registrar nota
              </Botao>
            </div>
          )}
          {etapa === 'nota_emitida' && <Botao onClick={() => setMensagem('envio')}>{direto ? 'Enviar a nota e o Pix ao paciente' : 'Enviar a nota ao hospital'}</Botao>}
          {etapa === 'nota_enviada' && (
            <div className="flex flex-wrap items-end gap-2">
              <label>
                <span className={ROTULO}>Valor que caiu na conta (R$)</span>
                <input value={valorPago} onChange={(e) => setValorPago(e.target.value)} inputMode="decimal" className={`${CAMPO} !w-44`} />
              </label>
              <label>
                <span className={ROTULO}>Pago em</span>
                <input type="date" value={dataPago} onChange={(e) => setDataPago(e.target.value)} className={`${CAMPO} !w-44`} />
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
        <button type="button" onClick={() => setAnexos((v) => !v)} aria-expanded={anexos} className="inline-flex items-center gap-1 hover:text-foreground">
          <Paperclip className="h-3.5 w-3.5" aria-hidden /> Anexar nota ou comprovante{docs.length > 0 ? ` (${docs.length})` : ''}
        </button>
        {etapa !== 'recebido' && (
          <button type="button" onClick={voltar} disabled={ocupado} className="inline-flex items-center gap-1 hover:text-foreground">
            <Undo2 className="h-3.5 w-3.5" aria-hidden /> Desfazer última etapa
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (window.confirm(direto ? 'Apagar esta cobrança direta?' : 'Apagar este demonstrativo? As cirurgias dele voltam a ficar em aberto.')) void enviar('DELETE', `/demonstrativos/${d.id}`, undefined, direto ? 'Cobrança apagada.' : 'Demonstrativo apagado.');
          }}
          className="ml-auto inline-flex items-center gap-1 hover:text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden /> Apagar
        </button>
      </div>

      {(anexos || docs.length > 0) && (
        <div className="mt-3 space-y-2">
          <ListaDeDocumentos documentos={docs} recarregar={recarregar} />
          {anexos && <Anexar recarregar={recarregar} demonstrativoId={d.id} tipoInicial={etapa === 'nota_enviada' || etapa === 'pago' ? 'comprovante' : 'nota'} compacto />}
        </div>
      )}

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
          mensagem={direto ? pedidoDeNotaDireto(d, hospital, estado.config) : pedidoDeNota(d, hospital, estado.config)}
          onFechar={() => setMensagem(null)}
          envio={{ tipo: 'pedido_nota', id: d.id, canais: [...canais], aoEnviar }}
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
          titulo={direto ? 'Enviar a nota e o Pix ao paciente' : 'Enviar a nota ao hospital'}
          mensagem={direto ? cobrancaAoPaciente(d, estado.config) : envioDaNota(d, hospital, estado.config)}
          aviso={direto && !estado.config.chave_pix ? 'Cadastre a sua chave Pix em Integrações para ela sair na mensagem.' : docs.some((x) => x.tipo === 'nota') ? 'A nota guardada neste recebimento vai anexada sozinha no envio automático.' : 'No envio manual, lembre de anexar o PDF da nota.'}
          onFechar={() => setMensagem(null)}
          envio={{
            tipo: direto ? 'cobranca_paciente' : 'envio_nota',
            id: d.id,
            canais: direto ? [...canais, ...(estado.integracoes.whatsapp ? (['whatsapp'] as const) : [])] : [...canais],
            anexo: true,
            aoEnviar,
          }}
          acao={{
            rotulo: 'Já enviei a nota',
            executar: async () => {
              await gravar({ nota_enviada_em: hoje }, 'Marcado: nota enviada.');
              setMensagem(null);
            },
          }}
        />
      )}
    </article>
  );
}

type ItemLido = { data: string | null; paciente: string; procedimento: string; convenio: string; valor: number | null };

function NovoDemonstrativo({ estado, hoje, enviar, onFechar, entrada }: PropsDaAba & { onFechar: () => void; entrada?: Entrada }) {
  const [hospitalId, setHospitalId] = useState(estado.hospitais.length === 1 ? estado.hospitais[0]!.id : '');
  const [recebido, setRecebido] = useState(hoje);
  const [referencia, setReferencia] = useState('');
  const [texto, setTexto] = useState(() => (entrada ? `${entrada.assunto}\n\n${entrada.texto}`.trim() : ''));
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
    const r = await enviar<{ casadas: number; criadas: number; cobradas_pagas: number; cobradas_pendentes: number }>('POST', '/demonstrativos', {
      hospital_id: hospitalId,
      referencia,
      recebido_em: recebido,
      valor_total: total,
      itens,
    });
    if (r && entrada) await enviar('POST', '/entradas', { ids: [entrada.id] });
    setSalvando(false);
    if (!r) return;
    toast.success(`Demonstrativo salvo: ${r.casadas} ${r.casadas === 1 ? 'cirurgia conferida' : 'cirurgias conferidas'}${r.criadas > 0 ? `, ${r.criadas} que você não tinha anotado` : ''}.`);
    // O hospital não responde às cobranças: é o demonstrativo que mostra o que entrou.
    if (r.cobradas_pagas + r.cobradas_pendentes > 0) {
      const total = r.cobradas_pagas + r.cobradas_pendentes;
      toast(`Das ${total} ${total === 1 ? 'pendência cobrada' : 'pendências cobradas'} deste hospital, ${r.cobradas_pagas} ${r.cobradas_pagas === 1 ? 'entrou' : 'entraram'} neste demonstrativo e ${r.cobradas_pendentes} ${r.cobradas_pendentes === 1 ? 'continua' : 'continuam'} sem pagamento.`, { duration: 12_000 });
    }
    onFechar();
  }

  return (
    <Janela titulo={entrada ? 'Conferir demonstrativo recebido por e-mail' : 'Novo demonstrativo'} onFechar={onFechar} larga>
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
                <button type="button" onClick={() => setImportar(true)} className="inline-flex items-center gap-1 text-xs font-medium text-medico hover:underline">
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

/** Cobrança direta: o paciente paga na hora (anestesista, particular). Registrar e pedir a nota é um passo só. */
function NovaCobrancaDireta({ estado, hoje, enviar, onFechar }: PropsDaAba & { onFechar: () => void }) {
  const [f, setF] = useState({
    hospital_id: estado.hospitais[0]?.id ?? '',
    data: hoje,
    paciente: '',
    procedimento: '',
    valor: '',
    pagador_nome: '',
    pagador_documento: '',
    pagador_contato: '',
    pedir_nota: estado.integracoes.email_envio && !!estado.config.contador_email,
  });
  const [salvando, setSalvando] = useState(false);
  const campo = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const valor = lerNumero(f.valor);
  const pronto = !!f.hospital_id && !!f.data && !!f.paciente.trim() && valor != null && valor > 0;

  async function salvar() {
    setSalvando(true);
    const r = await enviar<{ nota_pedida: boolean; aviso: string | null }>('POST', '/direto', { ...f, valor });
    setSalvando(false);
    if (!r) return;
    if (r.aviso) toast.error(r.aviso);
    else toast.success(r.nota_pedida ? 'Cobrança registrada e nota pedida ao contador.' : 'Cobrança registrada.');
    onFechar();
  }

  return (
    <Janela titulo="Cobrança direta" onFechar={onFechar}>
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <p className="text-muted-foreground sm:col-span-2">Para quando o paciente paga na hora. Informe quem paga (é o nome que sai na nota) e o sistema já pede a nota ao contador.</p>
        <label>
          <span className={ROTULO}>Hospital</span>
          <select value={f.hospital_id} onChange={campo('hospital_id')} className={CAMPO}>
            {estado.hospitais.map((h) => (
              <option key={h.id} value={h.id}>
                {h.nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={ROTULO}>Data</span>
          <input type="date" value={f.data} onChange={campo('data')} className={CAMPO} />
        </label>
        <label>
          <span className={ROTULO}>Paciente (iniciais)</span>
          <input value={f.paciente} onChange={campo('paciente')} className={CAMPO} />
        </label>
        <label>
          <span className={ROTULO}>Valor (R$)</span>
          <input value={f.valor} onChange={campo('valor')} inputMode="decimal" className={CAMPO} />
        </label>
        <label className="sm:col-span-2">
          <span className={ROTULO}>Procedimento</span>
          <input value={f.procedimento} onChange={campo('procedimento')} placeholder="ex.: anestesia para cesariana" className={CAMPO} />
        </label>
        <label>
          <span className={ROTULO}>Quem paga (nome para a nota)</span>
          <input value={f.pagador_nome} onChange={campo('pagador_nome')} className={CAMPO} />
        </label>
        <label>
          <span className={ROTULO}>CPF ou CNPJ de quem paga</span>
          <input value={f.pagador_documento} onChange={campo('pagador_documento')} inputMode="numeric" className={CAMPO} />
        </label>
        <label className="sm:col-span-2">
          <span className={ROTULO}>WhatsApp ou e-mail de quem paga (para enviar a nota e o Pix)</span>
          <input value={f.pagador_contato} onChange={campo('pagador_contato')} className={CAMPO} />
        </label>
        <label className="flex items-center gap-2 sm:col-span-2">
          <input type="checkbox" checked={f.pedir_nota} disabled={!estado.integracoes.email_envio} onChange={(e) => setF({ ...f, pedir_nota: e.target.checked })} />
          Pedir a nota ao contador agora, por e-mail
          {!estado.config.contador_email && <span className="text-xs text-amber-700 dark:text-amber-300">(cadastre o e-mail do contador)</span>}
        </label>
        <div className="flex justify-end sm:col-span-2">
          <Botao ocupado={salvando} desabilitado={!pronto} onClick={salvar}>
            Registrar cobrança
          </Botao>
        </div>
      </div>
    </Janela>
  );
}
