'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { BadgeCheck, Calculator, FileUp, Landmark, Loader2, Plus, Sparkles, Trash2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';

import type { Classificacao, Municipio, Uf, VersaoCalculadora } from '@/lib/reforma/calculadora';
import {
  conferirDestaque,
  PADRAO_CLASSIFICACAO,
  REFERENCIA_PADRAO,
  type ItemCalculo,
  type RegimeComprador,
} from '@/lib/reforma/cenarios';
import type { ResultadoCalculo, Sugestao } from '@/lib/reforma/servidor';

// Calculadora da Reforma (sub-projeto 96): CBS e IBS de cada item de compra
// calculados pelo motor oficial da Receita Federal, com redução, crédito e
// custo real ano a ano até 2033.

const CAMPO =
  'w-full rounded-xl border border-input bg-background px-3 h-10 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';

const CAPITAIS: Record<string, string> = {
  AC: 'Rio Branco', AL: 'Maceió', AP: 'Macapá', AM: 'Manaus', BA: 'Salvador', CE: 'Fortaleza', DF: 'Brasília',
  ES: 'Vitória', GO: 'Goiânia', MA: 'São Luís', MT: 'Cuiabá', MS: 'Campo Grande', MG: 'Belo Horizonte', PA: 'Belém',
  PB: 'João Pessoa', PR: 'Curitiba', PE: 'Recife', PI: 'Teresina', RJ: 'Rio de Janeiro', RN: 'Natal', RS: 'Porto Alegre',
  RO: 'Porto Velho', RR: 'Boa Vista', SC: 'Florianópolis', SP: 'São Paulo', SE: 'Aracaju', TO: 'Palmas',
};

type Linha = {
  descricao: string;
  ncm: string;
  valor: string;
  cClassTrib: string;
  quantidade?: number;
  unidade?: string;
  destacado?: { cbs: number | null; ibs: number | null };
  sugestao?: Sugestao | null;
};

const LINHA_VAZIA: Linha = { descricao: '', ncm: '', valor: '', cClassTrib: PADRAO_CLASSIFICACAO.cClassTrib };

const EXEMPLO: Linha[] = [
  { descricao: 'Cimento CP II-F 32 saco 50 kg', ncm: '25232910', valor: '10470', cClassTrib: '000001' },
  { descricao: 'Leite UHT integral 1 L', ncm: '04011010', valor: '3200', cClassTrib: '200003' },
  { descricao: 'Sabão em barra (limpeza do canteiro)', ncm: '34011190', valor: '1800', cClassTrib: '200035' },
  { descricao: 'Notebook para o escritório da obra', ncm: '84713012', valor: '8900', cClassTrib: '000001' },
];

function lerNumero(s: string): number | null {
  const t = s.trim().replace(/\s|R\$|%/g, '');
  if (!t) return null;
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(n) ? n : null;
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

function dataBr(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split('-');
  return a && m && d ? `${d}/${m}/${a}` : iso;
}

export function ReformaCalculadora() {
  const [versao, setVersao] = useState<VersaoCalculadora | null>(null);
  const [listaUfs, setListaUfs] = useState<Uf[]>([]);
  const [classifs, setClassifs] = useState<Classificacao[]>([]);
  const [erroBase, setErroBase] = useState<string | null>(null);

  const [uf, setUf] = useState('SP');
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [municipio, setMunicipio] = useState<number | null>(null);
  const [regime, setRegime] = useState<RegimeComprador>('regular');
  const [refCbs, setRefCbs] = useState(String(REFERENCIA_PADRAO.cbs).replace('.', ','));
  const [refIbs, setRefIbs] = useState(String(REFERENCIA_PADRAO.ibs).replace('.', ','));
  const [linhas, setLinhas] = useState<Linha[]>([{ ...LINHA_VAZIA }]);
  const [origemNota, setOrigemNota] = useState<string | null>(null);

  const [sugerindo, setSugerindo] = useState(false);
  const [calculando, setCalculando] = useState(false);
  const [lendoXml, setLendoXml] = useState(false);
  const [resultado, setResultado] = useState<ResultadoCalculo | null>(null);
  const [itensCalculados, setItensCalculados] = useState<ItemCalculo[]>([]);
  const [anoAberto, setAnoAberto] = useState(2033);
  const xmlRef = useRef<HTMLInputElement>(null);

  const porCodigo = useMemo(() => new Map(classifs.map((c) => [c.codigo, c])), [classifs]);

  useEffect(() => {
    fetch('/api/reforma/base')
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.message ?? 'A calculadora oficial não respondeu.');
        setVersao(d.versao);
        setListaUfs(d.ufs);
        setClassifs(d.classificacoes);
      })
      .catch((e: Error) => setErroBase(e.message));
  }, []);

  useEffect(() => {
    setMunicipios([]);
    setMunicipio(null);
    fetch(`/api/reforma/municipios?uf=${uf}`)
      .then((r) => r.json())
      .then((d: { municipios?: Municipio[] }) => {
        const lista = d.municipios ?? [];
        setMunicipios(lista);
        const capital = lista.find((m) => m.nome === CAPITAIS[uf]);
        setMunicipio((capital ?? lista[0])?.codigo ?? null);
      })
      .catch(() => toast.error('Não foi possível carregar os municípios.'));
  }, [uf]);

  const grupos = useMemo(() => {
    const g = new Map<string, Classificacao[]>();
    for (const c of classifs) {
      const k = `${c.cst} · ${c.cstDescricao}`;
      g.set(k, [...(g.get(k) ?? []), c]);
    }
    return [...g.entries()];
  }, [classifs]);

  const setLinha = (i: number, patch: Partial<Linha>) => setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  async function sugerir(alvo?: Linha[]) {
    const base = alvo ?? linhas;
    const ncms = [...new Set(base.map((l) => l.ncm.replace(/\D/g, '')).filter((n) => n.length === 8))];
    if (ncms.length === 0) {
      toast.error('Informe o NCM (8 dígitos) dos itens.');
      return;
    }
    setSugerindo(true);
    try {
      const res = await fetch('/api/reforma/sugerir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ncms: ncms.slice(0, 20) }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d.message ?? 'Não foi possível consultar as classificações.');
        return;
      }
      const mapa = new Map((d.sugestoes as Sugestao[]).map((s) => [s.ncm, s]));
      setLinhas(base.map((l) => ({ ...l, sugestao: mapa.get(l.ncm.replace(/\D/g, '')) ?? l.sugestao ?? null })));
      const comReducao = (d.sugestoes as Sugestao[]).filter((s) => s.opcoes.length > 0).length;
      toast.success(
        comReducao
          ? `${comReducao} NCM(s) com redução prevista na lei. Confira a sugestão em cada item.`
          : 'Nenhum dos NCMs está nas listas de redução: tributação integral.',
      );
    } finally {
      setSugerindo(false);
    }
  }

  async function importarXml(file: File) {
    setLendoXml(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/reforma/xml', { method: 'POST', body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d.message ?? 'Não foi possível ler o XML.');
        return;
      }
      type ItemXml = { descricao: string; ncm: string; valor: number; origemValor: 'liquido_da_nota' | 'sem_embutidos' | 'valor_do_produto'; quantidade: number | null; unidade: string; ibscbs: { cClassTrib: string; vCBS: number | null; vIBS: number | null } | null };
      const nota = d.nota as { numero: string; emitente: string; data: string; itens: ItemXml[] };
      const novas: Linha[] = nota.itens.map((it) => ({
        descricao: it.descricao,
        ncm: it.ncm,
        valor: String(Math.round(it.valor * 100) / 100).replace('.', ','),
        cClassTrib: it.ibscbs?.cClassTrib && porCodigo.has(it.ibscbs.cClassTrib) ? it.ibscbs.cClassTrib : PADRAO_CLASSIFICACAO.cClassTrib,
        quantidade: it.quantidade ?? undefined,
        unidade: it.unidade,
        destacado: it.ibscbs ? { cbs: it.ibscbs.vCBS, ibs: it.ibscbs.vIBS } : undefined,
      }));
      setLinhas(novas);
      setResultado(null);
      setOrigemNota(`NF ${nota.numero || ''} de ${nota.emitente || 'fornecedor'}${nota.data ? `, emitida em ${dataBr(nota.data)}` : ''}`);
      const comGrupo = nota.itens.filter((i) => i.ibscbs).length;
      const comLiquido = nota.itens.filter((i) => i.origemValor === 'liquido_da_nota').length;
      toast.success(
        [
          `${novas.length} item(ns) lidos, com o valor sem impostos`,
          comLiquido ? ` (${comLiquido} com o valor líquido informado na própria nota)` : ' (valor do produto menos ICMS, PIS e Cofins)',
          '. ',
          comGrupo
            ? `${comGrupo} já trazem a classificação e o destaque de CBS/IBS.`
            : 'A nota não traz o grupo de CBS/IBS: confira a classificação de cada item.',
        ].join(''),
      );
      if (comGrupo < novas.length) void sugerir(novas);
    } finally {
      setLendoXml(false);
      if (xmlRef.current) xmlRef.current.value = '';
    }
  }

  async function calcular() {
    if (!municipio) {
      toast.error('Escolha o município da operação.');
      return;
    }
    const cbs = lerNumero(refCbs);
    const ibs = lerNumero(refIbs);
    if (cbs == null || ibs == null) {
      toast.error('Confira as alíquotas de referência.');
      return;
    }
    const itens: ItemCalculo[] = [];
    for (const l of linhas.filter((x) => x.descricao.trim() || x.valor.trim())) {
      const valor = lerNumero(l.valor);
      if (!valor || valor <= 0) {
        toast.error(`Informe o valor de "${l.descricao || 'item sem nome'}".`);
        return;
      }
      const c = porCodigo.get(l.cClassTrib);
      itens.push({
        descricao: l.descricao.trim() || 'Item',
        ncm: l.ncm,
        cst: c?.cst ?? PADRAO_CLASSIFICACAO.cst,
        cClassTrib: l.cClassTrib,
        valor,
        quantidade: l.quantidade,
        unidade: l.unidade,
        destacado: l.destacado,
      });
    }
    if (itens.length === 0) {
      toast.error('Inclua pelo menos um item.');
      return;
    }
    setCalculando(true);
    try {
      const res = await fetch('/api/reforma/calcular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uf, municipio, regime, referencia: { cbs, ibs }, itens }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d.message ?? 'Não foi possível calcular agora.');
        return;
      }
      setItensCalculados(itens);
      setResultado(d as ResultadoCalculo);
      setTimeout(() => document.getElementById('resultado-reforma')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    } finally {
      setCalculando(false);
    }
  }

  const ano = resultado?.anos.find((a) => a.ano === anoAberto) ?? resultado?.anos.at(-1);
  const ano2026 = resultado?.anos.find((a) => a.ano === 2026);
  const nomeMunicipio = municipios.find((m) => m.codigo === municipio)?.nome;

  return (
    <div className="w-full space-y-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-brand">
          <Landmark className="h-5 w-5" aria-hidden />
          <span className="text-xs font-semibold uppercase tracking-wider">Reforma tributária</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight [text-wrap:balance]">Calculadora da Reforma: motor oficial da Receita</h1>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Informe os itens da compra (ou importe o XML da nota) e veja, item a item, quanto de CBS e IBS incide, se o item
          tem redução prevista na lei, quanto volta de crédito para a sua empresa e o custo real de 2026 a 2033. O cálculo é
          feito pela calculadora oficial da Receita Federal, a mesma usada pela fiscalização, com a base legal de cada item.
        </p>
        {versao && (
          <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-800 dark:text-emerald-200">
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
            Motor oficial conectado · versão {versao.versaoApp.split('-')[0]} · regras atualizadas em {dataBr(versao.dataVersaoDb)}
          </div>
        )}
        {erroBase && (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
            {erroBase}
          </p>
        )}
      </header>

      <section className="rounded-2xl border border-border bg-card p-5 space-y-5">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">UF da operação</span>
            <select className={CAMPO} value={uf} onChange={(e) => setUf(e.target.value)}>
              {(listaUfs.length ? listaUfs : [{ sigla: 'SP', nome: 'SÃO PAULO', codigo: 35 }])
                .slice()
                .sort((a, b) => a.sigla.localeCompare(b.sigla))
                .map((u) => (
                  <option key={u.sigla} value={u.sigla}>
                    {u.sigla}
                  </option>
                ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Município</span>
            <select className={CAMPO} value={municipio ?? ''} onChange={(e) => setMunicipio(Number(e.target.value))}>
              {municipios.length === 0 && <option value="">Carregando…</option>}
              {municipios.map((m) => (
                <option key={m.codigo} value={m.codigo}>
                  {m.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-medium text-muted-foreground">Como a sua empresa paga imposto</span>
            <select className={CAMPO} value={regime} onChange={(e) => setRegime(e.target.value as RegimeComprador)}>
              <option value="regular">Lucro Real ou Presumido: recupera a CBS e o IBS como crédito</option>
              <option value="simples">Simples Nacional: não recupera, o imposto vira custo</option>
            </select>
          </label>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Itens da compra</h2>
            {origemNota && <span className="text-xs text-muted-foreground">Importado da {origemNota}</span>}
          </div>
          <div className="space-y-2">
            {linhas.map((l, i) => {
              const c = porCodigo.get(l.cClassTrib);
              const sug = l.sugestao;
              const opcaoMelhor = sug?.opcoes[0];
              return (
                <div key={i} className="rounded-xl border border-border p-3 space-y-2">
                  <div className="grid gap-2 md:grid-cols-[minmax(0,2fr)_8rem_9rem_minmax(0,2.4fr)_auto] md:items-end">
                    <label className="space-y-1 min-w-0">
                      <span className="text-[11px] text-muted-foreground">Descrição</span>
                      <input className={CAMPO} value={l.descricao} onChange={(e) => setLinha(i, { descricao: e.target.value })} />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[11px] text-muted-foreground">NCM</span>
                      <input
                        className={CAMPO}
                        inputMode="numeric"
                        placeholder="8 dígitos"
                        value={l.ncm}
                        onChange={(e) => setLinha(i, { ncm: e.target.value, sugestao: null })}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[11px] text-muted-foreground">Valor sem impostos</span>
                      <input className={CAMPO} inputMode="decimal" placeholder="R$" value={l.valor} onChange={(e) => setLinha(i, { valor: e.target.value })} />
                    </label>
                    <label className="space-y-1 min-w-0">
                      <span className="text-[11px] text-muted-foreground">Classificação na reforma (cClassTrib)</span>
                      <select className={CAMPO} value={l.cClassTrib} onChange={(e) => setLinha(i, { cClassTrib: e.target.value })}>
                        {grupos.length === 0 && <option value={l.cClassTrib}>{l.cClassTrib}</option>}
                        {grupos.map(([nome, lista]) => (
                          <optgroup key={nome} label={nome}>
                            {lista.map((cl) => (
                              <option key={cl.codigo} value={cl.codigo}>
                                {cl.codigo} · {cl.descricao.slice(0, 80)}
                                {cl.reducaoCbs > 0 ? ` (redução ${cl.reducaoCbs}%)` : ''}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => setLinhas((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : [{ ...LINHA_VAZIA }]))}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
                      aria-label={`Remover item ${i + 1}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {c && (
                      <span>
                        {c.tratamento || c.cstDescricao}
                        {c.reducaoCbs > 0 ? ` · redução de ${c.reducaoCbs}%` : ''}
                        {regime === 'regular' ? (c.creditoCbs && c.creditoIbs ? ' · gera crédito para você' : ' · não gera crédito integral') : ''}
                      </span>
                    )}
                    {sug?.descricaoNcm && <span>NCM: {sug.descricaoNcm}</span>}
                    {sug?.impostoSeletivo && <span className="text-amber-700 dark:text-amber-300">Sujeito ao Imposto Seletivo</span>}
                    {l.destacado && <span>Nota destaca CBS {brl(l.destacado.cbs ?? 0)} e IBS {brl(l.destacado.ibs ?? 0)}</span>}
                  </div>
                  {opcaoMelhor && opcaoMelhor.codigo !== l.cClassTrib && (
                    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-brand/5 px-3 py-2 text-xs">
                      <Wand2 className="h-3.5 w-3.5 text-brand" aria-hidden />
                      <span>
                        O motor oficial indica que este NCM está na lista de <strong>{opcaoMelhor.descricao}</strong> (redução de{' '}
                        {opcaoMelhor.reducaoCbs}%). Confirme se a operação se enquadra.
                      </span>
                      <button
                        type="button"
                        onClick={() => setLinha(i, { cClassTrib: opcaoMelhor.codigo })}
                        className="rounded-full border border-brand/40 px-2.5 py-0.5 font-medium text-brand hover:bg-brand/10"
                      >
                        Usar {opcaoMelhor.codigo}
                      </button>
                    </div>
                  )}
                  {sug && sug.opcoes.length === 0 && l.ncm.replace(/\D/g, '').length === 8 && (
                    <div className="text-xs text-muted-foreground">Este NCM não está nas listas de redução: tributação integral.</div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setLinhas((ls) => [...ls, { ...LINHA_VAZIA }])}
              className="inline-flex items-center gap-1.5 rounded-full border border-border h-9 px-4 text-xs font-medium hover:bg-accent"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden /> Adicionar item
            </button>
            <input
              ref={xmlRef}
              type="file"
              accept=".xml,text/xml,application/xml"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importarXml(f);
              }}
            />
            <button
              type="button"
              disabled={lendoXml}
              onClick={() => xmlRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-full border border-border h-9 px-4 text-xs font-medium hover:bg-accent disabled:opacity-60"
            >
              {lendoXml ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <FileUp className="h-3.5 w-3.5" aria-hidden />}
              Importar XML da NF-e
            </button>
            <button
              type="button"
              disabled={sugerindo}
              onClick={() => void sugerir()}
              className="inline-flex items-center gap-1.5 rounded-full border border-border h-9 px-4 text-xs font-medium hover:bg-accent disabled:opacity-60"
            >
              {sugerindo ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Wand2 className="h-3.5 w-3.5" aria-hidden />}
              Verificar reduções pelo NCM
            </button>
            <button
              type="button"
              onClick={() => {
                setLinhas(EXEMPLO.map((x) => ({ ...x })));
                setOrigemNota(null);
                setResultado(null);
                setUf('PR');
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/5 h-9 px-4 text-xs font-medium hover:bg-brand/10"
            >
              <Sparkles className="h-3.5 w-3.5 text-brand" aria-hidden /> Carregar exemplo
            </button>
          </div>
        </div>

        <details className="rounded-xl border border-border">
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium">
            Alíquotas de referência de 2027 em diante (CBS {refCbs}% e IBS {refIbs}%)
          </summary>
          <div className="grid gap-3 p-3 sm:grid-cols-[8rem_8rem_minmax(0,1fr)] sm:items-end">
            <label className="space-y-1">
              <span className="text-[11px] text-muted-foreground">CBS (%)</span>
              <input className={CAMPO} inputMode="decimal" value={refCbs} onChange={(e) => setRefCbs(e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-muted-foreground">IBS (%)</span>
              <input className={CAMPO} inputMode="decimal" value={refIbs} onChange={(e) => setRefIbs(e.target.value)} />
            </label>
            <p className="text-xs text-muted-foreground">
              Em 2026 o motor usa as alíquotas oficiais (ano de teste: CBS 0,9% e IBS 0,1%). As alíquotas de 2027 em diante
              ainda não foram fixadas, e a própria calculadora da Receita pede que sejam informadas. As reduções, o direito a
              crédito e a base legal continuam vindo do motor oficial.
            </p>
          </div>
        </details>

        <button
          type="button"
          disabled={calculando || !!erroBase}
          onClick={() => void calcular()}
          className="inline-flex items-center gap-2 rounded-full bg-brand-gradient text-black h-11 px-6 text-sm font-semibold disabled:opacity-60"
        >
          {calculando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Calculator className="h-4 w-4" aria-hidden />}
          {calculando ? 'Calculando no motor oficial…' : 'Calcular com o motor oficial'}
        </button>
      </section>

      {resultado && ano && (
        <section id="resultado-reforma" className="space-y-6 scroll-mt-24">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">Resultado ano a ano</h2>
            <p className="text-sm text-muted-foreground">
              Compra de {brl(ano.total.valor)} em {nomeMunicipio ?? uf}/{uf}.{' '}
              {regime === 'regular'
                ? 'Como a sua empresa recupera a CBS e o IBS, o imposto que volta como crédito sai do custo.'
                : 'No Simples Nacional a sua empresa não recupera a CBS e o IBS: o imposto vira custo.'}
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Ano</th>
                  <th className="px-4 py-2 font-medium text-right">CBS</th>
                  <th className="px-4 py-2 font-medium text-right">IBS</th>
                  <th className="px-4 py-2 font-medium text-right">Imposto total</th>
                  <th className="px-4 py-2 font-medium text-right">Volta como crédito</th>
                  <th className="px-4 py-2 font-medium text-right">Custo real da compra</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {resultado.anos.map((a) => (
                  <tr
                    key={a.ano}
                    onClick={() => setAnoAberto(a.ano)}
                    className={`cursor-pointer hover:bg-accent/40 ${a.ano === ano.ano ? 'bg-brand/5' : ''}`}
                  >
                    <td className="px-4 py-2 whitespace-nowrap font-medium">
                      {a.rotulo}
                      <span className="ml-2 text-[10px] font-normal text-muted-foreground">{a.oficial ? 'alíquota oficial' : 'alíquota de referência'}</span>
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">{brl(a.total.cbs)}</td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">{brl(a.total.ibs)}</td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">{brl(a.total.total)}</td>
                    <td className="px-4 py-2 text-right whitespace-nowrap text-emerald-700 dark:text-emerald-300">{brl(a.total.credito)}</td>
                    <td className="px-4 py-2 text-right whitespace-nowrap font-semibold">{brl(a.total.custoReal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground -mt-4">
            2026 é ano de teste: o imposto aparece na nota, mas é compensável e não muda o custo. Clique num ano para ver os itens.
          </p>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">Itens em {ano.rotulo}</h3>
              <div className="inline-flex flex-wrap gap-1 rounded-full border border-border p-0.5 text-xs">
                {resultado.anos.map((a) => (
                  <button
                    key={a.ano}
                    type="button"
                    onClick={() => setAnoAberto(a.ano)}
                    className={`rounded-full px-3 h-7 ${a.ano === ano.ano ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {a.ano}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Item</th>
                    <th className="px-3 py-2 font-medium">Classificação</th>
                    <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Alíq. CBS / IBS</th>
                    <th className="px-3 py-2 font-medium text-right">Redução</th>
                    <th className="px-3 py-2 font-medium text-right">Imposto</th>
                    <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Peso no item</th>
                    <th className="px-3 py-2 font-medium text-right">Crédito</th>
                    <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Custo real</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {itensCalculados.map((it, i) => {
                    const r = ano.itens[i];
                    if (!r) return null;
                    const cl = porCodigo.get(it.cClassTrib);
                    return (
                      <tr key={i}>
                        <td className="px-3 py-2 min-w-[12rem]">
                          <div className="font-medium">{it.descricao}</div>
                          <div className="text-xs text-muted-foreground">
                            {it.ncm ? `NCM ${it.ncm} · ` : ''}
                            {brl(it.valor)}
                          </div>
                        </td>
                        <td className="px-3 py-2 min-w-[12rem] text-xs">
                          <span className="font-medium">{it.cClassTrib}</span> {cl?.descricao.slice(0, 70)}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          {pct(r.aliqCbs)} / {pct(r.aliqIbs)}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{r.reducao ? pct(r.reducao) : '-'}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{brl(r.total)}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{pct(r.aliquotaEfetiva)}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap text-emerald-700 dark:text-emerald-300">{brl(r.credito)}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap font-semibold">{brl(r.custoReal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {ano2026 && itensCalculados.some((it) => it.destacado) && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Conferência da nota contra o cálculo oficial (2026)</h3>
              <ul className="space-y-1.5">
                {itensCalculados.map((it, i) => {
                  const c = conferirDestaque(it, ano2026.itens[i]);
                  return (
                    <li
                      key={i}
                      className={`rounded-xl px-3 py-2 text-sm ${
                        c.situacao === 'confere'
                          ? 'bg-emerald-500/10 text-emerald-900 dark:text-emerald-200'
                          : c.situacao === 'diverge'
                            ? 'bg-red-500/10 text-red-900 dark:text-red-200'
                            : 'bg-muted/60 text-muted-foreground'
                      }`}
                    >
                      <strong>{it.descricao}:</strong> {c.mensagem}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <details className="rounded-2xl border border-border bg-card">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Memória de cálculo e base legal (motor oficial, {ano.rotulo})</summary>
            <ul className="divide-y divide-border">
              {itensCalculados.map((it, i) => (
                <li key={i} className="px-4 py-2 text-sm">
                  <div className="font-medium">{it.descricao}</div>
                  <div className="text-xs text-muted-foreground">{ano.itens[i]?.memoria || 'Sem memória de cálculo.'}</div>
                </li>
              ))}
            </ul>
          </details>

          <p className="text-xs text-muted-foreground">
            Cálculo feito pela Calculadora de Tributos oficial da Receita Federal
            {versao ? ` (aplicativo ${versao.versaoApp.split('-')[0]}, regras de ${dataBr(versao.dataVersaoDb)})` : ''}. De 2027 em
            diante as alíquotas são de referência e mudam quando forem fixadas oficialmente. O custo real considera só a CBS e o
            IBS: o ICMS e o ISS, que vão diminuindo até sumir em 2033, não entram nesta conta. Fornecedor do Simples Nacional que
            não optou pelo regime regular do IBS e da CBS transfere crédito menor do que o mostrado aqui.
          </p>
        </section>
      )}
    </div>
  );
}
