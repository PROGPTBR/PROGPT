'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, FileSpreadsheet, Loader2, PackageCheck, Plus, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { CompradorImportDialog } from '@/components/assistants/CompradorImportDialog';
import { PEDIDO_EXEMPLO } from '@/lib/recebimento/exemplo';
import type { PedidoItem, RecebimentoPedido } from '@/lib/recebimento/types';
import { brl, CAMPO, dataHora, StatusBadge } from './ui';

// Recebimento de NF (sub-projeto 95): lista dos pedidos acompanhados e o
// cadastro de um pedido novo. O pedido é a referência de toda a conferência:
// quanto mais completo (NCM e alíquotas), mais o sistema confere sozinho.

type LinhaItem = {
  codigo: string;
  descricao: string;
  ncm: string;
  unidade: string;
  quantidade: string;
  valor_unitario: string;
  icms_pct: string;
  ipi_pct: string;
};

const LINHA_VAZIA: LinhaItem = { codigo: '', descricao: '', ncm: '', unidade: 'UN', quantidade: '', valor_unitario: '', icms_pct: '', ipi_pct: '' };

/** "1.234,56", "1234.56" ou "1234,5" → número. */
export function lerNumero(s: string): number | null {
  const t = s.trim().replace(/\s|R\$|%/g, '');
  if (!t) return null;
  const normal = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

function paraLinha(i: Partial<PedidoItem>): LinhaItem {
  const f = (v: number | null | undefined) => (v == null ? '' : String(v).replace('.', ','));
  return {
    codigo: i.codigo ?? '',
    descricao: i.descricao ?? '',
    ncm: i.ncm ?? '',
    unidade: i.unidade || 'UN',
    quantidade: f(i.quantidade),
    valor_unitario: f(i.valor_unitario),
    icms_pct: f(i.icms_pct),
    ipi_pct: f(i.ipi_pct),
  };
}

const vazio = {
  numero: '',
  titulo: '',
  fornecedor_nome: '',
  fornecedor_cnpj: '',
  fornecedor_email: '',
  almoxarifado_nome: '',
  almoxarifado_email: '',
  financeiro_nome: '',
  financeiro_email: '',
  condicoes: '',
};

export function RecebimentoRoot({ pedidosIniciais }: { pedidosIniciais: RecebimentoPedido[] }) {
  const router = useRouter();
  const [abrindo, setAbrindo] = useState(pedidosIniciais.length === 0);
  const [dados, setDados] = useState(vazio);
  const [itens, setItens] = useState<LinhaItem[]>([{ ...LINHA_VAZIA }]);
  const [enviarLinks, setEnviarLinks] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [lendo, setLendo] = useState(false);

  const set = (k: keyof typeof vazio) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDados((d) => ({ ...d, [k]: e.target.value }));
  const setItem = (i: number, k: keyof LinhaItem, v: string) =>
    setItens((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));

  function carregarExemplo() {
    const { itens: ex, ...resto } = PEDIDO_EXEMPLO;
    setDados({ ...vazio, ...resto });
    setItens(ex.map(paraLinha));
    setAbrindo(true);
  }

  async function lerPedido(texto: string) {
    setLendo(true);
    try {
      const res = await fetch('/api/recebimento/importar-pedido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.message ?? 'Não foi possível ler o pedido.');
        return;
      }
      const p = data.pedido as { numero: string; fornecedor_nome: string; fornecedor_cnpj: string; condicoes: string; itens: PedidoItem[] };
      setDados((d) => ({
        ...d,
        numero: p.numero || d.numero,
        fornecedor_nome: p.fornecedor_nome || d.fornecedor_nome,
        fornecedor_cnpj: p.fornecedor_cnpj || d.fornecedor_cnpj,
        condicoes: p.condicoes || d.condicoes,
      }));
      setItens(p.itens.map(paraLinha));
      toast.success(`${p.itens.length} item(ns) lido(s). Confira antes de salvar, principalmente NCM e alíquotas.`);
    } catch {
      toast.error('Sem conexão. Tente de novo.');
    } finally {
      setLendo(false);
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (salvando) return;
    if (!dados.fornecedor_nome.trim()) {
      toast.error('Informe o fornecedor.');
      return;
    }
    const linhas = itens.filter((l) => l.descricao.trim());
    if (linhas.length === 0) {
      toast.error('Inclua pelo menos um item.');
      return;
    }
    const convertidos: PedidoItem[] = [];
    for (const l of linhas) {
      const quantidade = lerNumero(l.quantidade);
      const valor = lerNumero(l.valor_unitario);
      if (!quantidade || quantidade <= 0) {
        toast.error(`Informe a quantidade de "${l.descricao}".`);
        return;
      }
      convertidos.push({
        codigo: l.codigo.trim(),
        descricao: l.descricao.trim(),
        ncm: l.ncm.trim(),
        unidade: l.unidade.trim() || 'UN',
        quantidade,
        valor_unitario: valor ?? 0,
        icms_pct: lerNumero(l.icms_pct),
        ipi_pct: lerNumero(l.ipi_pct),
      });
    }

    const enviar = enviarLinks
      ? (['fornecedor', 'almoxarifado', 'financeiro'] as const).filter((p) => dados[`${p}_email`].trim())
      : [];

    setSalvando(true);
    try {
      const res = await fetch('/api/recebimento/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...dados, itens: convertidos, enviar }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.message ?? 'Não foi possível salvar o pedido.');
        return;
      }
      if (enviar.length) toast.success('Pedido salvo. Os links foram enviados por e-mail.');
      router.push(`/recebimento/${data.pedido.id}`);
    } catch {
      toast.error('Sem conexão. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  const total = itens.reduce((s, l) => s + (lerNumero(l.quantidade) ?? 0) * (lerNumero(l.valor_unitario) ?? 0), 0);
  const semImposto = itens.some((l) => l.descricao.trim() && (!l.icms_pct.trim() || !l.ncm.trim()));

  return (
    <div className="w-full space-y-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-brand">
          <PackageCheck className="h-5 w-5" aria-hidden />
          <span className="text-xs font-semibold uppercase tracking-wider">Recebimento de NF</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight [text-wrap:balance]">Do pedido de compra ao pagamento liberado</h1>
        <p className="text-sm text-muted-foreground max-w-3xl">
          O fornecedor anexa a nota pelo link do pedido. O sistema separa a nota de entrega (vai para o almoxarifado, sem
          valores) da nota financeira (vai para o financeiro), confere cada uma contra o pedido, inclusive NCM e impostos,
          aceita entrega parcial com pendência e só libera o pagamento depois do OK do almoxarifado.
        </p>
      </header>

      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          ['1', 'Pedido de compra', 'Itens, NCM e alíquotas'],
          ['2', 'Fornecedor anexa a nota', 'XML ou PDF, sem conta'],
          ['3', 'Conferência automática', 'Pedido x nota, NCM e impostos'],
          ['4', 'Almoxarifado confere', 'Sem ver valores, aceita parcial'],
          ['5', 'OK para pagamento', 'Financeiro é avisado'],
        ].map(([n, t, d]) => (
          <li key={n} className="min-w-0 rounded-xl border border-border bg-card p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Passo {n}</div>
            <div className="mt-1 text-xs font-medium leading-tight">{t}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground leading-tight">{d}</div>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-2">
        {!abrindo && (
          <button
            type="button"
            onClick={() => setAbrindo(true)}
            className="inline-flex items-center gap-2 rounded-full bg-brand-gradient text-black h-11 px-5 text-sm font-semibold"
          >
            <Plus className="h-4 w-4" aria-hidden /> Novo pedido
          </button>
        )}
        <button
          type="button"
          onClick={carregarExemplo}
          className="inline-flex items-center gap-2 rounded-full border border-brand/40 bg-brand/5 h-11 px-5 text-sm font-medium hover:bg-brand/10 transition-colors"
        >
          <Sparkles className="h-4 w-4 text-brand" aria-hidden /> Carregar exemplo
        </button>
      </div>

      {abrindo && (
        <form onSubmit={salvar} className="rounded-2xl border border-border bg-card p-5 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Pedido de compra</h2>
            <button
              type="button"
              disabled={lendo}
              onClick={() => setImportando(true)}
              className="inline-flex items-center gap-2 rounded-full border border-border h-9 px-4 text-xs font-medium hover:bg-accent disabled:opacity-60"
            >
              {lendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />}
              {lendo ? 'Lendo o pedido…' : 'Importar pedido (PDF, Word ou Excel)'}
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Número do pedido</span>
              <input className={CAMPO} value={dados.numero} onChange={set('numero')} placeholder="PO-2026-0142" />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs font-medium text-muted-foreground">Descrição (opcional)</span>
              <input className={CAMPO} value={dados.titulo} onChange={set('titulo')} placeholder="Material de estrutura, Torre B" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Fornecedor *</span>
              <input className={CAMPO} value={dados.fornecedor_nome} onChange={set('fornecedor_nome')} required />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">CNPJ do fornecedor</span>
              <input className={CAMPO} value={dados.fornecedor_cnpj} onChange={set('fornecedor_cnpj')} placeholder="Confere o emitente da nota" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">E-mail do fornecedor</span>
              <input className={CAMPO} type="email" value={dados.fornecedor_email} onChange={set('fornecedor_email')} placeholder="Recebe o link para anexar a nota" />
            </label>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Itens</h3>
              <span className="text-xs text-muted-foreground">Total do pedido: {brl(total)}</span>
            </div>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 font-medium min-w-[7rem]">Código</th>
                    <th className="px-2 py-2 font-medium min-w-[16rem]">Descrição *</th>
                    <th className="px-2 py-2 font-medium min-w-[7rem]">NCM</th>
                    <th className="px-2 py-2 font-medium min-w-[4.5rem]">Un.</th>
                    <th className="px-2 py-2 font-medium min-w-[6rem]">Qtd. *</th>
                    <th className="px-2 py-2 font-medium min-w-[7rem]">Valor unit.</th>
                    <th className="px-2 py-2 font-medium min-w-[5rem]">ICMS %</th>
                    <th className="px-2 py-2 font-medium min-w-[5rem]">IPI %</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {itens.map((l, i) => (
                    <tr key={i}>
                      {(['codigo', 'descricao', 'ncm', 'unidade', 'quantidade', 'valor_unitario', 'icms_pct', 'ipi_pct'] as const).map((k) => (
                        <td key={k} className="px-1.5 py-1.5">
                          <input
                            className="w-full rounded-lg border border-transparent bg-transparent px-2 h-9 text-sm outline-none hover:border-input focus:border-brand focus:bg-background"
                            value={l[k]}
                            inputMode={['quantidade', 'valor_unitario', 'icms_pct', 'ipi_pct', 'ncm'].includes(k) ? 'decimal' : undefined}
                            onChange={(e) => setItem(i, k, e.target.value)}
                            aria-label={`${k} do item ${i + 1}`}
                          />
                        </td>
                      ))}
                      <td className="px-1.5 py-1.5">
                        <button
                          type="button"
                          onClick={() => setItens((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : [{ ...LINHA_VAZIA }]))}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
                          aria-label={`Remover item ${i + 1}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={() => setItens((ls) => [...ls, { ...LINHA_VAZIA }])}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden /> Adicionar item
            </button>
            {semImposto && (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Item sem NCM ou sem alíquota de ICMS não tem esse ponto conferido na nota. Informe no pedido para a
                conferência tributária ficar completa.
              </p>
            )}
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Condições (prazo, pagamento, frete, local de entrega)</span>
            <textarea className={`${CAMPO} h-auto py-2`} rows={2} value={dados.condicoes} onChange={set('condicoes')} />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <fieldset className="space-y-2 rounded-xl border border-border p-3">
              <legend className="px-1 text-xs font-semibold">Almoxarifado</legend>
              <p className="text-[11px] text-muted-foreground">Confere o material e dá o OK para o pagamento. Não vê valores.</p>
              <input className={CAMPO} value={dados.almoxarifado_nome} onChange={set('almoxarifado_nome')} placeholder="Nome" />
              <input className={CAMPO} type="email" value={dados.almoxarifado_email} onChange={set('almoxarifado_email')} placeholder="E-mail" />
            </fieldset>
            <fieldset className="space-y-2 rounded-xl border border-border p-3">
              <legend className="px-1 text-xs font-semibold">Financeiro</legend>
              <p className="text-[11px] text-muted-foreground">Recebe a nota financeira conferida e o aviso de pagamento liberado.</p>
              <input className={CAMPO} value={dados.financeiro_nome} onChange={set('financeiro_nome')} placeholder="Nome" />
              <input className={CAMPO} type="email" value={dados.financeiro_email} onChange={set('financeiro_email')} placeholder="E-mail" />
            </fieldset>
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={enviarLinks} onChange={(e) => setEnviarLinks(e.target.checked)} />
            <span>Enviar agora, por e-mail, o link de cada um (fornecedor, almoxarifado e financeiro). Ninguém precisa criar conta.</span>
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={salvando}
              className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground h-11 px-6 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
            >
              {salvando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Salvar pedido
            </button>
            {pedidosIniciais.length > 0 && (
              <button
                type="button"
                onClick={() => setAbrindo(false)}
                className="inline-flex items-center rounded-full border border-border h-11 px-5 text-sm font-medium hover:bg-accent"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Pedidos acompanhados</h2>
        {pedidosIniciais.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum pedido ainda. Cadastre o primeiro ou carregue o exemplo.</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {pedidosIniciais.map((p) => (
              <li key={p.id}>
                <Link href={`/recebimento/${p.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-accent/50">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {p.numero ? `Pedido ${p.numero}` : p.titulo || 'Pedido'} · {p.fornecedor_nome}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {brl(p.valor_total)} · atualizado em {dataHora(p.updated_at)}
                    </div>
                  </div>
                  <StatusBadge status={p.status} />
                  <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CompradorImportDialog
        open={importando}
        onClose={() => setImportando(false)}
        titulo="Importar o pedido de compra"
        onImported={(texto) => {
          setImportando(false);
          void lerPedido(texto);
        }}
      />
    </div>
  );
}
