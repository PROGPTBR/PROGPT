'use client';

import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { Download, FileUp, Plus, RotateCcw, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CompradorImportDialog } from './CompradorImportDialog';
import { handlePaywallResponse } from '@/lib/billing/handle-paywall';
import { readAssistantChunk } from '@/lib/assistants/stream-client';
import { semTravessao } from '@/lib/texto/sem-travessao';
import {
  CENARIOS,
  DESTINACAO_LABELS,
  DESTINACOES,
  PADROES_REFORMA,
  REDUCAO_LABELS,
  REDUCOES,
  REGIMES_COMPRADOR,
  REGIME_COMPRADOR_LABELS,
  REGIME_FORNECEDOR_LABELS,
  REGIMES_FORNECEDOR,
  ParametrosTributariosSchema,
  analisarPropostas,
  brl,
  type Destinacao,
  type ParametrosTributarios,
  type PropostaTributaria,
  type RegimeComprador,
} from '@/lib/tributario/calculo';

// Análise Tributária de Propostas: o comprador traz as propostas, a IA lê os
// dados fiscais, ele confere/corrige numa tabela editável, vê o custo líquido
// de cada uma recalculado na hora (mesma função do servidor) e, se quiser,
// gera o relatório com a recomendação.

type PropostaEdit = PropostaTributaria & { observacoes?: string; faltando?: string[] };
type Phase = 'form' | 'generating' | 'done';
type Template = { id: string; name: string };

function novaProposta(n: number): PropostaEdit {
  return {
    fornecedor: `Fornecedor ${String.fromCharCode(64 + n)}`,
    cnpj: '',
    uf: '',
    regimeFornecedor: 'regular',
    valorProdutos: 0,
    ipiPct: 0,
    icmsPct: 18,
    pisCofinsPct: 9.25,
    stValor: 0,
    freteValor: 0,
    reducaoReformaPct: 0,
  };
}

const EXEMPLO: PropostaEdit[] = [
  { ...novaProposta(1), fornecedor: 'Metalúrgica Paulista Ltda', uf: 'SP', valorProdutos: 100_000, ipiPct: 5, icmsPct: 12, freteValor: 1_800 },
  { ...novaProposta(2), fornecedor: 'Aços do Vale ME', uf: 'MG', regimeFornecedor: 'simples', valorProdutos: 85_000, icmsPct: 2.5, pisCofinsPct: 0, freteValor: 1_000 },
  { ...novaProposta(3), fornecedor: 'Distribuidora Sul Industrial', uf: 'PR', valorProdutos: 97_500, ipiPct: 5, icmsPct: 12, stValor: 0, freteValor: 0 },
];

/** Aceita "1.234,56", "1234.56" e "12%". */
function numero(texto: string): number {
  const t = texto.replace(/[^\d,.-]/g, '');
  if (!t) return 0;
  const normal = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  const n = Number(normal);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function CampoNumero({
  valor,
  onChange,
  sufixo,
  rotulo,
}: {
  valor: number;
  onChange: (n: number) => void;
  sufixo?: string;
  rotulo: string;
}) {
  const [texto, setTexto] = useState(valor ? String(valor).replace('.', ',') : '');
  useEffect(() => {
    if (numero(texto) !== valor) setTexto(valor ? String(valor).replace('.', ',') : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-muted-foreground">{rotulo}</span>
      <div className="relative">
        <Input
          inputMode="decimal"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            onChange(numero(e.target.value));
          }}
          className="h-9 rounded-xl pr-8"
          placeholder="0"
        />
        {sufixo && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {sufixo}
          </span>
        )}
      </div>
    </label>
  );
}

const SELECT = 'h-9 w-full rounded-xl border border-input bg-background px-2 text-sm';

export function TributarioAssistant() {
  const [phase, setPhase] = useState<Phase>('form');
  const [texto, setTexto] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [lendo, setLendo] = useState(false);
  const [propostas, setPropostas] = useState<PropostaEdit[]>([]);

  const [descricaoCompra, setDescricaoCompra] = useState('');
  const [regimeComprador, setRegimeComprador] = useState<RegimeComprador>('lucro_real');
  const [destinacao, setDestinacao] = useState<Destinacao>('insumo');
  const [ufComprador, setUfComprador] = useState('');
  const [cbsPct, setCbsPct] = useState<number>(PADROES_REFORMA.cbsPct);
  const [ibsPct, setIbsPct] = useState<number>(PADROES_REFORMA.ibsPct);
  const [simplesCreditoPct, setSimplesCreditoPct] = useState<number>(PADROES_REFORMA.simplesCreditoPct);
  const [notes, setNotes] = useState('');

  const [templates, setTemplates] = useState<Template[]>([]);
  const [output, setOutput] = useState('');
  const [runId, setRunId] = useState<string | null>(null);
  const [baixando, setBaixando] = useState(false);

  useEffect(() => {
    fetch('/api/assistants/templates?type=tributario_propostas')
      .then((r) => (r.ok ? r.json() : { templates: [] }))
      .then((d: { templates?: Template[] }) => setTemplates(d.templates ?? []))
      .catch(() => setTemplates([]));
  }, []);

  const params: ParametrosTributarios = {
    descricaoCompra: descricaoCompra.trim() || 'Compra em análise',
    regimeComprador,
    destinacao,
    ufComprador: ufComprador.trim().toUpperCase().slice(0, 2),
    cbsPct,
    ibsPct,
    simplesCreditoPct,
    propostas: propostas.map(({ observacoes: _o, faltando: _f, ...p }) => p),
    notes: notes.trim(),
  };
  const valido = ParametrosTributariosSchema.safeParse(params).success && propostas.every((p) => p.valorProdutos > 0);
  const analise = useMemo(
    () => (propostas.length >= 2 && valido ? analisarPropostas(params) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(params), valido],
  );

  function editar(i: number, campo: Partial<PropostaEdit>) {
    setPropostas((prev) => prev.map((p, j) => (j === i ? { ...p, ...campo } : p)));
  }

  async function lerPropostas() {
    if (texto.trim().length < 20) {
      toast.error('Cole ou importe as propostas primeiro.');
      return;
    }
    setLendo(true);
    try {
      const res = await fetch('/api/assistants/tributario_propostas/extrair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto }),
      });
      const data = (await res.json().catch(() => ({}))) as { propostas?: PropostaEdit[]; detail?: string; error?: string };
      if (!res.ok || !data.propostas) {
        toast.error(data.detail ?? 'Não consegui ler as propostas.');
        return;
      }
      if (data.propostas.length === 0) {
        toast.error('Não encontrei propostas no texto. Preencha à mão.');
        return;
      }
      setPropostas(data.propostas);
      const faltando = data.propostas.filter((p) => p.faltando?.length).length;
      toast.success(`${data.propostas.length} propostas lidas`, {
        description: faltando ? `Confira as marcadas: ${faltando} com dado faltando.` : 'Confira os números antes de gerar o relatório.',
      });
    } catch (err) {
      toast.error('Não consegui ler as propostas.', { description: String(err) });
    } finally {
      setLendo(false);
    }
  }

  async function gerar() {
    const templateId = templates[0]?.id;
    if (!templateId) {
      toast.error('Modelo do relatório indisponível. Tente de novo em instantes.');
      return;
    }
    if (!descricaoCompra.trim()) {
      toast.error('Descreva a compra (ex.: chapas de aço para a produção).');
      return;
    }
    setPhase('generating');
    setOutput('');
    setRunId(null);
    try {
      const res = await fetch('/api/assistants/tributario_propostas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, params }),
      });
      if (handlePaywallResponse(res, 'tributario_propostas')) {
        setPhase('form');
        return;
      }
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error === 'rate_limited' ? 'Muitas análises seguidas. Aguarde um minuto.' : (data.error ?? `status ${res.status}`));
      }
      const id = res.headers.get('x-run-id');
      if (id) setRunId(id);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await readAssistantChunk(reader);
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const linhas = buffer.split('\n');
        buffer = linhas.pop() ?? '';
        for (const linha of linhas) {
          if (!linha.startsWith('0:')) continue;
          try {
            const t = JSON.parse(linha.slice(2)) as string;
            setOutput((prev) => prev + t);
          } catch {
            // tolerante a linha quebrada
          }
        }
      }
      if (id) {
        const out = await fetch(`/api/assistants/runs/${id}/output`).catch(() => null);
        if (out?.ok) {
          const d = (await out.json()) as { output_md?: string };
          if (d.output_md) setOutput(d.output_md);
        }
      }
      setPhase('done');
    } catch (err) {
      toast.error('Falha ao gerar o relatório', { description: err instanceof Error ? err.message : String(err) });
      setPhase('form');
    }
  }

  async function baixarDocx() {
    if (!runId) return;
    setBaixando(true);
    try {
      const res = await fetch(`/api/assistants/runs/${runId}/docx`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `analise-tributaria-${runId.slice(0, 8)}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Falha ao baixar o Word', { description: String(err) });
    } finally {
      setBaixando(false);
    }
  }

  const tabela = analise && (
    <div className="overflow-x-auto rounded-2xl border bg-card">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="sticky left-0 bg-card px-3 py-2 font-medium">Custo líquido de impostos</th>
            {CENARIOS.map((c) => (
              <th key={c.id} className="whitespace-nowrap px-3 py-2 text-right font-medium">
                {c.rotulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {analise.propostas.map((p, i) => (
            <tr key={i} className="border-b last:border-0">
              <td className="sticky left-0 bg-card px-3 py-2">
                <div className="font-medium">{p.fornecedor}</div>
                <div className="text-xs text-muted-foreground">
                  {REGIME_FORNECEDOR_LABELS[params.propostas[i]!.regimeFornecedor]}
                </div>
              </td>
              {CENARIOS.map((c) => {
                const r = p.cenarios[c.id];
                const melhor = analise.melhorPorCenario[c.id] === i;
                return (
                  <td
                    key={c.id}
                    className={`whitespace-nowrap px-3 py-2 text-right tabular-nums ${melhor ? 'font-semibold text-emerald-700 dark:text-emerald-400' : ''}`}
                    title={`Desembolso ${brl(r.desembolso)} menos créditos ${brl(r.creditos)}`}
                  >
                    {brl(r.custoLiquido)}
                    {melhor && <span className="ml-1 text-[10px] uppercase">melhor</span>}
                    <div className="text-[11px] font-normal text-muted-foreground">créditos {brl(r.creditos)}</div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="space-y-1 border-t px-4 py-3 text-xs text-muted-foreground">
        {analise.viradaNaReforma && (
          <p className="font-medium text-amber-700 dark:text-amber-400">
            A proposta mais barata hoje não é a mais barata em todos os anos da reforma.
          </p>
        )}
        {analise.avisos.map((a) => (
          <p key={a}>{a}</p>
        ))}
        <p>
          Estimativa simplificada para comparar propostas: alíquotas de IBS e CBS ainda não são definitivas. Valide
          com o contador antes de fechar contrato longo.
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Análise Tributária de Propostas <span className="text-brand">.</span>
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Qual proposta sai mais barata depois dos impostos? Traga as propostas dos fornecedores: o assistente
          calcula o custo líquido de cada uma (preço menos os créditos que sua empresa recupera) hoje e ano a ano na
          reforma tributária, até 2033.
        </p>
      </div>

      {phase === 'form' && (
        <>
          <section className="space-y-3 rounded-2xl border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold">1. Propostas</h2>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                  <FileUp className="mr-1 h-3.5 w-3.5" /> Importar documentos
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPropostas(EXEMPLO)}>
                  Carregar exemplo
                </Button>
              </div>
            </div>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={5}
              placeholder="Cole aqui as propostas (ou importe PDF, Word, Excel). A IA lê fornecedor, valor, IPI, ICMS, ST, frete e regime."
              className="w-full rounded-xl border border-input bg-background p-3 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={lerPropostas} disabled={lendo || texto.trim().length < 20}>
                <Sparkles className="mr-1 h-4 w-4" /> {lendo ? 'Lendo as propostas…' : 'Ler propostas com IA'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setPropostas((p) => (p.length >= 8 ? p : [...p, novaProposta(p.length + 1)]))}
                disabled={propostas.length >= 8}
              >
                <Plus className="mr-1 h-4 w-4" /> Adicionar à mão
              </Button>
            </div>

            {propostas.length > 0 && (
              <div className="grid gap-3 lg:grid-cols-2">
                {propostas.map((p, i) => (
                  <div key={i} className="space-y-3 rounded-2xl border p-4">
                    <div className="flex items-start gap-2">
                      <Input
                        value={p.fornecedor}
                        onChange={(e) => editar(i, { fornecedor: e.target.value })}
                        className="h-9 rounded-xl font-medium"
                        aria-label="Fornecedor"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Remover proposta"
                        onClick={() => setPropostas((prev) => prev.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {p.faltando && p.faltando.length > 0 && (
                      <p className="rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs text-amber-800 dark:text-amber-300">
                        Não veio na proposta: {p.faltando.join(', ')}. Preenchemos com um padrão, confira.
                      </p>
                    )}
                    {p.observacoes && <p className="text-xs text-muted-foreground">{p.observacoes}</p>}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <label className="col-span-2 block sm:col-span-1">
                        <span className="mb-1 block text-[11px] font-medium text-muted-foreground">Regime do fornecedor</span>
                        <select
                          className={SELECT}
                          value={p.regimeFornecedor}
                          onChange={(e) => {
                            const regime = e.target.value as PropostaTributaria['regimeFornecedor'];
                            editar(i, {
                              regimeFornecedor: regime,
                              ...(regime === 'simples' ? { pisCofinsPct: 0 } : p.pisCofinsPct === 0 ? { pisCofinsPct: 9.25 } : {}),
                            });
                          }}
                        >
                          {REGIMES_FORNECEDOR.map((r) => (
                            <option key={r} value={r}>
                              {REGIME_FORNECEDOR_LABELS[r]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <CampoNumero rotulo="Valor dos produtos" sufixo="R$" valor={p.valorProdutos} onChange={(n) => editar(i, { valorProdutos: n })} />
                      <CampoNumero rotulo="Frete" sufixo="R$" valor={p.freteValor} onChange={(n) => editar(i, { freteValor: n })} />
                      <CampoNumero
                        rotulo={p.regimeFornecedor === 'simples' ? 'Crédito ICMS na nota' : 'ICMS'}
                        sufixo="%"
                        valor={p.icmsPct}
                        onChange={(n) => editar(i, { icmsPct: n })}
                      />
                      <CampoNumero rotulo="IPI" sufixo="%" valor={p.ipiPct} onChange={(n) => editar(i, { ipiPct: n })} />
                      <CampoNumero rotulo="ICMS-ST" sufixo="R$" valor={p.stValor} onChange={(n) => editar(i, { stValor: n })} />
                      {p.regimeFornecedor === 'regular' && (
                        <CampoNumero rotulo="PIS/Cofins no preço" sufixo="%" valor={p.pisCofinsPct} onChange={(n) => editar(i, { pisCofinsPct: n })} />
                      )}
                      <label className="col-span-2 block">
                        <span className="mb-1 block text-[11px] font-medium text-muted-foreground">Item na reforma (IBS/CBS)</span>
                        <select
                          className={SELECT}
                          value={p.reducaoReformaPct}
                          onChange={(e) => editar(i, { reducaoReformaPct: Number(e.target.value) as PropostaTributaria['reducaoReformaPct'] })}
                        >
                          {REDUCOES.map((r) => (
                            <option key={r} value={r}>
                              {REDUCAO_LABELS[r]}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3 rounded-2xl border bg-card p-5">
            <h2 className="text-base font-semibold">2. Sua empresa e a compra</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-[11px] font-medium text-muted-foreground">O que está sendo comprado</span>
                <Input
                  value={descricaoCompra}
                  onChange={(e) => setDescricaoCompra(e.target.value)}
                  className="h-9 rounded-xl"
                  placeholder="Ex.: chapas de aço para a linha de produção"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-muted-foreground">Regime da sua empresa</span>
                <select className={SELECT} value={regimeComprador} onChange={(e) => setRegimeComprador(e.target.value as RegimeComprador)}>
                  {REGIMES_COMPRADOR.map((r) => (
                    <option key={r} value={r}>
                      {REGIME_COMPRADOR_LABELS[r]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-muted-foreground">Para que serve a compra</span>
                <select className={SELECT} value={destinacao} onChange={(e) => setDestinacao(e.target.value as Destinacao)}>
                  {DESTINACOES.map((d) => (
                    <option key={d} value={d}>
                      {DESTINACAO_LABELS[d]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <details className="rounded-xl border px-4 py-2">
              <summary className="cursor-pointer text-sm font-medium">Premissas da reforma (editáveis)</summary>
              <div className="grid gap-3 py-3 sm:grid-cols-4">
                <CampoNumero rotulo="CBS (federal)" sufixo="%" valor={cbsPct} onChange={setCbsPct} />
                <CampoNumero rotulo="IBS (estados e municípios)" sufixo="%" valor={ibsPct} onChange={setIbsPct} />
                <CampoNumero rotulo="Crédito que o Simples transfere" sufixo="%" valor={simplesCreditoPct} onChange={setSimplesCreditoPct} />
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-muted-foreground">Sua UF</span>
                  <Input value={ufComprador} onChange={(e) => setUfComprador(e.target.value)} className="h-9 rounded-xl" maxLength={2} placeholder="SP" />
                </label>
              </div>
              <p className="pb-2 text-xs text-muted-foreground">
                Padrões: CBS 8,8% + IBS 17,7% (estimativa de 26,5% somados; as alíquotas oficiais ainda serão fixadas).
                Transição: 2027 entra a CBS e saem PIS/Cofins e IPI; de 2029 a 2032 o ICMS cai 10% ao ano; em 2033 só IBS
                e CBS.
              </p>
            </details>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-muted-foreground">Observações (opcional)</span>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="h-9 rounded-xl" placeholder="Ex.: contrato de 3 anos, entrega mensal" />
            </label>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold">3. Resultado</h2>
            {propostas.length < 2 ? (
              <p className="text-sm text-muted-foreground">Traga pelo menos 2 propostas para comparar.</p>
            ) : !analise ? (
              <p className="text-sm text-muted-foreground">Preencha o valor dos produtos de todas as propostas.</p>
            ) : (
              <>
                {tabela}
                <Button onClick={gerar} disabled={!valido}>
                  <Sparkles className="mr-1 h-4 w-4" /> Gerar relatório com recomendação
                </Button>
              </>
            )}
          </section>
        </>
      )}

      {phase !== 'form' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-muted-foreground">
              {descricaoCompra}
              {phase === 'generating' && <span className="ml-2 text-xs text-primary">Gerando…</span>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPhase('form')} disabled={phase === 'generating'}>
                <RotateCcw className="mr-1 h-3.5 w-3.5" /> Ajustar propostas
              </Button>
              <Button variant="outline" size="sm" onClick={baixarDocx} disabled={!runId || phase === 'generating' || baixando}>
                <Download className="mr-1 h-3.5 w-3.5" /> {baixando ? 'Baixando…' : 'Baixar Word'}
              </Button>
            </div>
          </div>
          {tabela}
          <article className="prose prose-sm max-w-none overflow-x-auto rounded-2xl border bg-card p-6 dark:prose-invert [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_td]:px-2 [&_th]:px-2">
            {output.length === 0 ? (
              <p className="italic text-muted-foreground">Escrevendo a recomendação… cerca de 20 segundos.</p>
            ) : (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{semTravessao(output)}</ReactMarkdown>
            )}
          </article>
        </div>
      )}

      <CompradorImportDialog
        titulo="Importar propostas dos fornecedores"
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(t) => setTexto((prev) => (prev ? `${prev}\n\n` : '') + t)}
      />
    </div>
  );
}
