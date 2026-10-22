import type { Metadata } from 'next';
import { CheckCircle2, Circle, Clock } from 'lucide-react';

import { getAcompanhamentoPorToken } from '@/lib/fluxo/acompanhamento';
import { LinkIndisponivel, PublicoShell } from '@/components/fluxo/publico/PublicoShell';

export const dynamic = 'force-dynamic';

// "Como está meu pedido?" (sub-projeto 90). Página PÚBLICA, fora do matcher
// do middleware: quem pediu a compra não tem conta. Mostra só o andamento,
// sem preço, proposta nem fornecedor.
export const metadata: Metadata = {
  title: 'Como está meu pedido? | PROGPT',
  robots: { index: false, follow: false },
};

function data(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

export default async function AcompanharPage({ params }: { params: { token: string } }) {
  const a = await getAcompanhamentoPorToken(params.token);

  if (!a) {
    return (
      <PublicoShell>
        <LinkIndisponivel
          titulo="Link indisponível"
          texto="Este link de acompanhamento não é válido. Peça um novo para o time de compras."
        />
      </PublicoShell>
    );
  }

  const feitas = a.etapas.filter((e) => e.estado === 'concluida').length;

  return (
    <PublicoShell>
      <div className="space-y-6">
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-brand">Como está meu pedido?</div>
          <h1 className="text-2xl font-semibold tracking-tight [text-wrap:balance]">{a.titulo}</h1>
          <p className="text-sm text-muted-foreground">
            Aberto em {data(a.abertoEm)} · atualizado em {data(a.atualizadoEm)}
          </p>
        </div>

        <div
          className={`rounded-2xl border p-4 ${
            a.concluido
              ? 'border-emerald-500/40 bg-emerald-500/10'
              : a.cancelado
                ? 'border-border bg-muted/40'
                : 'border-brand/40 bg-brand/5'
          }`}
        >
          <div className="text-sm font-medium">
            {a.concluido
              ? 'Compra concluída. O item foi recebido.'
              : a.cancelado
                ? 'Este pedido foi cancelado pelo time de compras.'
                : `Etapa ${feitas + 1} de ${a.etapas.length}: ${a.etapas.find((e) => e.estado === 'atual')?.label ?? ''}`}
          </div>
          {a.aguardando && <div className="mt-1 text-sm text-muted-foreground">{a.aguardando}</div>}
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${Math.round((feitas / a.etapas.length) * 100)}%` }}
            />
          </div>
        </div>

        <ol className="space-y-2">
          {a.etapas.map((e) => (
            <li
              key={e.num}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                e.estado === 'atual' ? 'border-brand bg-card' : 'border-border bg-card'
              } ${e.estado === 'futura' ? 'opacity-60' : ''}`}
            >
              {e.estado === 'concluida' ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
              ) : e.estado === 'atual' ? (
                <Clock className="h-5 w-5 shrink-0 text-brand" aria-hidden />
              ) : (
                <Circle className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">
                  {e.num}. {e.label}
                </div>
                <div className="text-xs text-muted-foreground">
                  {e.estado === 'concluida'
                    ? `Concluída${e.concluidaEm ? ` em ${data(e.concluidaEm)}` : ''}`
                    : e.estado === 'atual'
                      ? 'Em andamento'
                      : 'Ainda não começou'}
                </div>
              </div>
            </li>
          ))}
        </ol>

        <p className="text-xs text-muted-foreground">
          Esta página atualiza sozinha a cada etapa. Para dúvidas sobre o pedido, fale com o time de compras
          da sua empresa.
        </p>
      </div>
    </PublicoShell>
  );
}
