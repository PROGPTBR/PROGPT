import type { Metadata } from 'next';

import { getAprovacaoPorToken } from '@/lib/fluxo/acompanhamento';
import { LinkIndisponivel, PublicoShell } from '@/components/fluxo/publico/PublicoShell';
import { DecisaoGestor } from '@/components/fluxo/publico/DecisaoGestor';

export const dynamic = 'force-dynamic';

// Aprovação do gestor pelo e-mail (sub-projeto 90). Página PÚBLICA, fora do
// matcher do middleware: o gestor não tem conta. O token do link é a credencial.
export const metadata: Metadata = {
  title: 'Aprovação de compra | PROGPT',
  robots: { index: false, follow: false },
};

const FECHADO: Record<string, { titulo: string; texto: string }> = {
  aprovado: { titulo: 'Já aprovado', texto: 'Você já aprovou esta etapa. O comprador foi avisado.' },
  reprovado: { titulo: 'Já reprovado', texto: 'Você já reprovou esta etapa. O comprador foi avisado.' },
  cancelado: { titulo: 'Pedido cancelado', texto: 'O comprador cancelou este pedido de aprovação. Nada mais é necessário.' },
  expirado: { titulo: 'Link vencido', texto: 'Este pedido de aprovação venceu. Peça ao comprador para enviar de novo.' },
  superado: {
    titulo: 'Pedido não está mais aberto',
    texto: 'O comprador já decidiu esta etapa ou ela foi refeita. Se precisar, peça um novo pedido de aprovação.',
  },
};

export default async function AprovarPage({ params }: { params: { token: string } }) {
  const a = await getAprovacaoPorToken(params.token);

  if (!a) {
    return (
      <PublicoShell>
        <LinkIndisponivel titulo="Link indisponível" texto="Este link de aprovação não é válido." />
      </PublicoShell>
    );
  }

  if (a.estado !== 'pendente' || !a.saida) {
    const f = FECHADO[a.estado] ?? FECHADO.superado!;
    return (
      <PublicoShell>
        <LinkIndisponivel titulo={f.titulo} texto={f.texto} />
      </PublicoShell>
    );
  }

  const s = a.saida;

  return (
    <PublicoShell>
      <div className="space-y-5">
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-brand">Aprovação de compra</div>
          <h1 className="text-2xl font-semibold tracking-tight [text-wrap:balance]">{a.tituloCompra}</h1>
          <p className="text-sm text-muted-foreground">
            Etapa: {a.etapaLabel}
            {a.aprovadorNome ? ` · pedido para ${a.aprovadorNome}` : ''}
          </p>
        </div>

        <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <p className="text-sm">{s.resumo}</p>

          {s.campos.length > 0 && (
            <dl className="grid gap-2 sm:grid-cols-2">
              {s.campos.map((c, i) => (
                <div key={i} className="min-w-0 rounded-lg bg-muted/40 px-3 py-2">
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{c.rotulo}</dt>
                  <dd className="text-sm break-words">{c.valor}</dd>
                </div>
              ))}
            </dl>
          )}

          {s.itens.length > 0 && (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {s.itens.map((it, i) => (
                <li key={i} className="px-3 py-2">
                  <div className="text-sm font-medium">{it.titulo}</div>
                  <div className="text-xs text-muted-foreground">{it.detalhe}</div>
                </li>
              ))}
            </ul>
          )}

          {s.alertas.length > 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
              <div className="mb-1 text-xs font-semibold text-amber-700 dark:text-amber-400">Pontos de atenção</div>
              <ul className="list-disc pl-5 text-xs space-y-1">
                {s.alertas.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Se você aprovar</span>
            <div className="font-medium">{s.saida}</div>
          </div>
        </section>

        <details className="rounded-2xl border border-border bg-card px-5 py-3">
          <summary className="cursor-pointer text-sm font-medium">Ver o pedido original</summary>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{a.requisicao}</p>
        </details>

        <DecisaoGestor token={params.token} />
      </div>
    </PublicoShell>
  );
}
