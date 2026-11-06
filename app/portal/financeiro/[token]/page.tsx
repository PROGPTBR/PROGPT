import type { Metadata } from 'next';
import { Download, ShieldCheck, ShieldAlert } from 'lucide-react';

import { getPedidoPorToken, rotuloDoPedido } from '@/lib/recebimento/service';
import { ladoFinanceiro, podeAtestar } from '@/lib/recebimento/conferencia';
import { LinkIndisponivel, PublicoShell } from '@/components/fluxo/publico/PublicoShell';
import { Apontamentos, FinalidadeBadge, StatusBadge, TabelaSaldo } from '@/components/recebimento/ui';
import { brl, dataHora } from '@/lib/recebimento/formato';

export const dynamic = 'force-dynamic';

// Recebimento de NF (sub-projeto 95). Página PÚBLICA do financeiro: a nota
// financeira conferida contra o pedido (preço, impostos, NCM) e se o
// almoxarifado já liberou o pagamento.
export const metadata: Metadata = { title: 'Nota financeira | PROGPT', robots: { index: false, follow: false } };

export default async function PortalFinanceiroPage({ params }: { params: { token: string } }) {
  const c = await getPedidoPorToken('financeiro', params.token);
  if (!c) {
    return (
      <PublicoShell>
        <LinkIndisponivel titulo="Link indisponível" texto="Este link não é válido. Peça ao comprador um novo link." />
      </PublicoShell>
    );
  }

  const { pedido } = c;
  const financeiras = c.notas.filter((n) => ladoFinanceiro(n.finalidade));
  const liberado = !!pedido.pagamento_liberado_em;

  return (
    <PublicoShell>
      <div className="space-y-6">
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-brand">Nota financeira</div>
          <h1 className="text-2xl font-semibold tracking-tight [text-wrap:balance]">{rotuloDoPedido(pedido)}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {pedido.fornecedor_nome} · pedido de {brl(pedido.valor_total)} <StatusBadge status={pedido.status} />
          </div>
          {pedido.condicoes && <p className="text-sm text-muted-foreground">{pedido.condicoes}</p>}
        </div>

        <div
          className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${
            liberado ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-amber-500/30 bg-amber-500/10'
          }`}
        >
          {liberado ? (
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
          ) : (
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
          )}
          <div>
            <div className="font-semibold">{liberado ? 'Pagamento liberado' : 'Pagamento ainda bloqueado'}</div>
            <div className="text-muted-foreground">
              {liberado
                ? `${pedido.pagamento_liberado_por} (almoxarifado) atestou em ${dataHora(pedido.pagamento_liberado_em!)} que todos os itens foram entregues sem ressalva.`
                : podeAtestar(c.saldo)
                  ? 'Todos os itens chegaram. Falta o OK do almoxarifado.'
                  : 'O almoxarifado ainda não recebeu todos os itens. Não pague antes do OK dele.'}
            </div>
          </div>
        </div>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Notas financeiras e conferência</h2>
          {financeiras.length === 0 ? (
            <p className="text-sm text-muted-foreground">O fornecedor ainda não anexou a nota financeira.</p>
          ) : (
            financeiras.map((n) => (
              <article key={n.id} className="rounded-2xl border border-border bg-card p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">
                    NF {n.numero || 'sem número'}
                    {n.serie ? ` série ${n.serie}` : ''}
                  </span>
                  <FinalidadeBadge finalidade={n.finalidade} />
                  <span className="text-xs text-muted-foreground">
                    {n.emitente_nome} · {n.data_emissao} · {brl(n.valor_total)}
                  </span>
                  {n.arquivo_path && (
                    <a
                      href={`/api/recebimento/portal/financeiro/${params.token}/arquivo/${n.id}`}
                      className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-border h-8 px-3 text-xs font-medium hover:bg-accent"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden /> Baixar a nota
                    </a>
                  )}
                </div>
                <Apontamentos itens={n.conferencia.apontamentos} vazio="Preço, impostos e NCM batem com o pedido." />
              </article>
            ))
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Recebimento físico (almoxarifado)</h2>
          <TabelaSaldo saldo={c.saldo} />
        </section>
      </div>
    </PublicoShell>
  );
}
