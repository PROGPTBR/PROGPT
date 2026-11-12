'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, Check, Copy, Download, Mail, ShieldCheck, Truck, Warehouse, Wallet } from 'lucide-react';
import { toast } from 'sonner';

import type { SaldoItem } from '@/lib/recebimento/conferencia';
import type { RecebimentoEntrada, RecebimentoNota, RecebimentoPedido } from '@/lib/recebimento/types';
import { Apontamentos, brl, dataHora, EnvioNota, FinalidadeBadge, qtd, StatusBadge, TabelaSaldo } from './ui';

// Detalhe de um pedido no Recebimento de NF (sub-projeto 95): os três links,
// as notas com a conferência, o saldo físico e o OK para pagamento.

type Papel = 'fornecedor' | 'almoxarifado' | 'financeiro';

const PAPEIS: Array<{ papel: Papel; titulo: string; texto: string; icon: typeof Truck }> = [
  { papel: 'fornecedor', titulo: 'Fornecedor', texto: 'Anexa a nota fiscal (XML ou PDF).', icon: Truck },
  { papel: 'almoxarifado', titulo: 'Almoxarifado', texto: 'Confere o material sem ver valores e dá o OK para pagamento.', icon: Warehouse },
  { papel: 'financeiro', titulo: 'Financeiro', texto: 'Vê a nota financeira conferida e o pagamento liberado.', icon: Wallet },
];

export function PedidoRecebimento({
  pedido,
  notas,
  entradas,
  saldo,
  links,
}: {
  pedido: RecebimentoPedido;
  notas: RecebimentoNota[];
  entradas: RecebimentoEntrada[];
  saldo: SaldoItem[];
  links: Record<Papel, string>;
}) {
  const router = useRouter();
  const [enviando, setEnviando] = useState<Papel | null>(null);
  const [confirmarCancelamento, setConfirmarCancelamento] = useState(false);
  const encerrado = pedido.status === 'cancelado' || !!pedido.pagamento_liberado_em;

  const contato: Record<Papel, string> = {
    fornecedor: pedido.fornecedor_email,
    almoxarifado: pedido.almoxarifado_email,
    financeiro: pedido.financeiro_email,
  };

  async function copiar(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Link copiado.');
    } catch {
      toast.error('Não foi possível copiar. Selecione o link e copie à mão.');
    }
  }

  async function enviarPorEmail(papel: Papel) {
    setEnviando(papel);
    try {
      const res = await fetch(`/api/recebimento/pedidos/${pedido.id}/enviar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ papeis: [papel] }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.enviados?.[papel]) toast.success(`Link enviado para ${contato[papel]}.`);
      else toast.error('O e-mail não saiu. Copie o link e envie por WhatsApp ou e-mail.');
    } finally {
      setEnviando(null);
    }
  }

  async function cancelar() {
    const res = await fetch(`/api/recebimento/pedidos/${pedido.id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.message ?? 'Não foi possível cancelar.');
      return;
    }
    toast.success('Pedido cancelado. Os links deixam de aceitar nota e recebimento.');
    setConfirmarCancelamento(false);
    router.refresh();
  }

  const pendentes = saldo.filter((s) => s.pendente > 0);

  return (
    <div className="w-full space-y-8">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight [text-wrap:balance]">
            {pedido.numero ? `Pedido ${pedido.numero}` : pedido.titulo || 'Pedido de compra'}
          </h1>
          <StatusBadge status={pedido.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {pedido.fornecedor_nome}
          {pedido.fornecedor_cnpj ? ` · CNPJ ${pedido.fornecedor_cnpj}` : ''} · {brl(pedido.valor_total)}
          {pedido.numero && pedido.titulo ? ` · ${pedido.titulo}` : ''}
        </p>
        {pedido.condicoes && <p className="text-sm text-muted-foreground max-w-3xl">{pedido.condicoes}</p>}
      </header>

      {pedido.pagamento_liberado_em && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
          <div>
            <div className="font-semibold">Pagamento liberado</div>
            <div className="text-muted-foreground">
              {pedido.pagamento_liberado_por} atestou em {dataHora(pedido.pagamento_liberado_em)} que todos os itens foram entregues.
            </div>
          </div>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Links de cada um (sem conta)</h2>
        <div className="grid gap-3 lg:grid-cols-3">
          {PAPEIS.map(({ papel, titulo, texto, icon: Icon }) => (
            <div key={papel} className="min-w-0 rounded-2xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-brand" aria-hidden />
                <span className="text-sm font-semibold">{titulo}</span>
              </div>
              <p className="text-xs text-muted-foreground">{texto}</p>
              <div className="truncate rounded-lg bg-muted/50 px-2 py-1.5 font-mono text-[11px] select-all">{links[papel]}</div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void copiar(links[papel])}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border h-8 px-3 text-xs font-medium hover:bg-accent"
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden /> Copiar link
                </button>
                {contato[papel] && (
                  <button
                    type="button"
                    disabled={enviando === papel}
                    onClick={() => void enviarPorEmail(papel)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border h-8 px-3 text-xs font-medium hover:bg-accent disabled:opacity-60"
                  >
                    <Mail className="h-3.5 w-3.5" aria-hidden /> Enviar para {contato[papel]}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="min-w-0 space-y-3">
          <h2 className="text-sm font-semibold">Recebimento físico</h2>
          <TabelaSaldo saldo={saldo} />
          <p className="text-xs text-muted-foreground">
            {pendentes.length > 0
              ? `${pendentes.length} item(ns) com pendência. Quem registra o recebimento é o almoxarifado, pelo link dele.`
              : pedido.pagamento_liberado_em
                ? 'Tudo entregue e atestado.'
                : 'Tudo entregue. Falta o OK do almoxarifado para liberar o pagamento.'}
          </p>
          {entradas.length > 0 && (
            <ul className="space-y-2">
              {entradas.map((e) => (
                <li key={e.id} className="rounded-xl border border-border px-3 py-2 text-sm">
                  <div className="text-xs text-muted-foreground">
                    {dataHora(e.created_at)} · {e.responsavel || 'Almoxarifado'}
                  </div>
                  <div>
                    {e.itens
                      .filter((i) => i.quantidade > 0)
                      .map((i) => `${qtd(i.quantidade)} ${pedido.itens[i.item]?.unidade ?? ''} de ${pedido.itens[i.item]?.descricao ?? 'item'}`)
                      .join('; ')}
                  </div>
                  {e.observacao && <div className="text-xs text-muted-foreground">{e.observacao}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>

        {!encerrado && (
          <div className="min-w-0 rounded-2xl border border-border bg-card p-4 space-y-3 h-fit">
            <h2 className="text-sm font-semibold">Anexar nota pelo fornecedor</h2>
            <p className="text-xs text-muted-foreground">
              Se a nota chegou por e-mail, anexe aqui. O normal é o fornecedor anexar pelo link dele.
            </p>
            <EnvioNota
              endpoint={`/api/recebimento/pedidos/${pedido.id}/notas`}
              onEnviada={() => {
                toast.success('Nota lida e conferida.');
                router.refresh();
              }}
            />
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Notas e conferência</h2>
        {notas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma nota ainda. Envie o link para o fornecedor anexar.</p>
        ) : (
          <div className="space-y-4">
            {notas.map((n) => (
              <article key={n.id} className="rounded-2xl border border-border bg-card p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">
                    NF {n.numero || 'sem número'}
                    {n.serie ? ` série ${n.serie}` : ''}
                  </span>
                  <FinalidadeBadge finalidade={n.finalidade} />
                  <span className="text-xs text-muted-foreground">
                    {n.emitente_nome} · {n.data_emissao || 'sem data'} · {brl(n.valor_total)} · lida do {n.origem === 'xml' ? 'XML' : 'PDF pela IA'} ·
                    enviada pelo {n.enviado_por}
                  </span>
                  {n.arquivo_path && (
                    <a
                      href={`/api/recebimento/notas/${n.id}/arquivo`}
                      className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-border h-8 px-3 text-xs font-medium hover:bg-accent"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden /> Arquivo
                    </a>
                  )}
                </div>
                <Apontamentos itens={n.conferencia.apontamentos} />
                <details className="rounded-xl border border-border">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-medium">Itens da nota ({n.itens.length})</summary>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 text-left uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">Descrição</th>
                          <th className="px-3 py-2 font-medium">NCM</th>
                          <th className="px-3 py-2 font-medium">CFOP</th>
                          <th className="px-3 py-2 font-medium text-right">Qtd.</th>
                          <th className="px-3 py-2 font-medium text-right">Unit.</th>
                          <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Líquido</th>
                          <th className="px-3 py-2 font-medium text-right">ICMS</th>
                          <th className="px-3 py-2 font-medium text-right">IPI</th>
                          <th className="px-3 py-2 font-medium">No pedido</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {n.itens.map((it, k) => {
                          const idx = n.conferencia.casamento?.[k];
                          return (
                            <tr key={k}>
                              <td className="px-3 py-1.5 min-w-[12rem]">{it.descricao}</td>
                              <td className="px-3 py-1.5 whitespace-nowrap">{it.ncm}</td>
                              <td className="px-3 py-1.5">{it.cfop}</td>
                              <td className="px-3 py-1.5 text-right whitespace-nowrap">
                                {qtd(it.quantidade)} {it.unidade}
                              </td>
                              <td className="px-3 py-1.5 text-right whitespace-nowrap">{brl(it.valor_unitario)}</td>
                              <td className="px-3 py-1.5 text-right whitespace-nowrap">{it.liquido?.total != null ? brl(it.liquido.total) : '-'}</td>
                              <td className="px-3 py-1.5 text-right">{it.icms_pct ?? '-'}</td>
                              <td className="px-3 py-1.5 text-right">{it.ipi_pct ?? '-'}</td>
                              <td className="px-3 py-1.5 min-w-[10rem]">
                                {idx != null ? (
                                  <span className="inline-flex items-center gap-1">
                                    <Check className="h-3 w-3 text-emerald-600" aria-hidden /> {pedido.itens[idx]?.descricao}
                                  </span>
                                ) : (
                                  <span className="text-red-600">não está no pedido</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </details>
              </article>
            ))}
          </div>
        )}
      </section>

      <details className="rounded-2xl border border-border bg-card">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Itens do pedido ({pedido.itens.length})</summary>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Código</th>
                <th className="px-3 py-2 font-medium">Descrição</th>
                <th className="px-3 py-2 font-medium">NCM</th>
                <th className="px-3 py-2 font-medium text-right">Qtd.</th>
                <th className="px-3 py-2 font-medium text-right">Unit.</th>
                <th className="px-3 py-2 font-medium text-right">ICMS</th>
                <th className="px-3 py-2 font-medium text-right">IPI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pedido.itens.map((it, i) => (
                <tr key={i}>
                  <td className="px-3 py-1.5">{it.codigo}</td>
                  <td className="px-3 py-1.5 min-w-[14rem]">{it.descricao}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap">{it.ncm || 'não informado'}</td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap">
                    {qtd(it.quantidade)} {it.unidade}
                  </td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap">{brl(it.valor_unitario)}</td>
                  <td className="px-3 py-1.5 text-right">{it.icms_pct ?? 'não informado'}</td>
                  <td className="px-3 py-1.5 text-right">{it.ipi_pct ?? 'não informado'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {!encerrado && (
        <div className="flex flex-wrap items-center gap-2">
          {confirmarCancelamento ? (
            <>
              <span className="text-sm">Cancelar este pedido? Os links deixam de funcionar.</span>
              <button
                type="button"
                onClick={() => void cancelar()}
                className="inline-flex items-center rounded-full bg-red-600 text-white h-9 px-4 text-xs font-semibold"
              >
                Sim, cancelar
              </button>
              <button
                type="button"
                onClick={() => setConfirmarCancelamento(false)}
                className="inline-flex items-center rounded-full border border-border h-9 px-4 text-xs font-medium"
              >
                Não
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmarCancelamento(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border h-9 px-4 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <Ban className="h-3.5 w-3.5" aria-hidden /> Cancelar pedido
            </button>
          )}
        </div>
      )}
    </div>
  );
}
