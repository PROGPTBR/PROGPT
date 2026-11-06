'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';

import type { VisaoFornecedor } from '@/lib/recebimento/service';
import { FINALIDADE_LABEL } from '@/lib/recebimento/types';
import { brl, dataHora, EnvioNota, qtd } from './ui';

// Página do fornecedor (link sem conta, sub-projeto 95): vê o pedido e o que
// falta entregar, e anexa a nota. A conferência é interna do comprador.
export function PortalFornecedor({ token, visao, aberto }: { token: string; visao: VisaoFornecedor; aberto: boolean }) {
  const router = useRouter();
  const [recibo, setRecibo] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="text-xs font-semibold uppercase tracking-wider text-brand">Nota fiscal do pedido</div>
        <h1 className="text-2xl font-semibold tracking-tight [text-wrap:balance]">{visao.rotulo}</h1>
        <p className="text-sm text-muted-foreground">
          {visao.fornecedor}
          {visao.comprador ? ` · pedido de ${visao.comprador}` : ''}
        </p>
      </div>

      {recibo && (
        <div className="flex items-start gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden /> {recibo}
        </div>
      )}

      {aberto ? (
        <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold">Anexar a nota</h2>
          <p className="text-sm text-muted-foreground">
            Anexe a nota de saída do material. Se a venda tiver nota de entrega (remessa) e nota de faturamento separadas,
            anexe as duas, uma de cada vez. Os itens e as quantidades precisam ser os do pedido.
          </p>
          <EnvioNota
            endpoint={`/api/recebimento/portal/fornecedor/${token}`}
            onEnviada={(r) => {
              setRecibo(
                `Nota ${r.numero ? `nº ${r.numero} ` : ''}recebida${r.finalidade ? ` como ${FINALIDADE_LABEL[r.finalidade].toLowerCase()}` : ''}. O comprador já foi avisado.`,
              );
              router.refresh();
            }}
          />
        </section>
      ) : (
        <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
          Este pedido não aceita mais notas (foi concluído ou cancelado pelo comprador).
        </p>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Itens do pedido</h2>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Descrição</th>
                <th className="px-3 py-2 font-medium">NCM</th>
                <th className="px-3 py-2 font-medium text-right">Qtd.</th>
                <th className="px-3 py-2 font-medium text-right">Unit.</th>
                <th className="px-3 py-2 font-medium text-right">Falta entregar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visao.itens.map((it, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 min-w-[12rem]">
                    {it.descricao}
                    {it.codigo && <span className="text-xs text-muted-foreground"> · {it.codigo}</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{it.ncm || '-'}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {qtd(it.quantidade)} {it.unidade}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{brl(it.valor_unitario)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{qtd(visao.saldo[i]?.pendente ?? it.quantidade)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {visao.notas.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Notas já anexadas</h2>
          <ul className="divide-y divide-border rounded-xl border border-border text-sm">
            {visao.notas.map((n) => (
              <li key={n.id} className="px-3 py-2">
                NF {n.numero || 'sem número'} · {FINALIDADE_LABEL[n.finalidade]} · {dataHora(n.created_at)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
