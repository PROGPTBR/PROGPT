'use client';

import { useState } from 'react';
import { Loader2, PackageCheck, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import type { VisaoAlmoxarifado } from '@/lib/recebimento/service';
import { podeAtestar } from '@/lib/recebimento/conferencia';
import { Apontamentos, CAMPO, dataHora, FinalidadeBadge, qtd, StatusBadge, TabelaSaldo } from './ui';

// Página do almoxarifado (link sem conta, sub-projeto 95). Recebimento às
// cegas: nenhum valor aparece aqui, nem a nota financeira. Registra o que
// chegou (entrega parcial vira pendência) e, com tudo entregue, dá o OK que
// libera o pagamento.

function lerQtd(s: string): number {
  const t = s.trim().replace(/\./g, '').replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function PortalAlmoxarifado({ token, visaoInicial }: { token: string; visaoInicial: VisaoAlmoxarifado }) {
  const [visao, setVisao] = useState(visaoInicial);
  const [responsavel, setResponsavel] = useState('');
  const [quantidades, setQuantidades] = useState<string[]>(() => visaoInicial.itens.map(() => ''));
  const [ressalvas, setRessalvas] = useState<string[]>(() => visaoInicial.itens.map(() => ''));
  const [observacao, setObservacao] = useState('');
  const [notaId, setNotaId] = useState<string>(visaoInicial.notasEntrega.at(-1)?.id ?? '');
  const [confirmo, setConfirmo] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const encerrado = visao.status === 'cancelado' || !!visao.pagamentoLiberadoEm;
  const tudoEntregue = podeAtestar(visao.saldo);

  async function postar(body: object): Promise<boolean> {
    setEnviando(true);
    try {
      const res = await fetch(`/api/recebimento/portal/almoxarifado/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.message ?? 'Não foi possível registrar.');
        return false;
      }
      setVisao(data.visao);
      return true;
    } catch {
      toast.error('Sem conexão. Tente de novo.');
      return false;
    } finally {
      setEnviando(false);
    }
  }

  async function registrar(e: React.FormEvent) {
    e.preventDefault();
    if (!responsavel.trim()) {
      toast.error('Informe o seu nome.');
      return;
    }
    const itens = visao.itens
      .map((_, i) => ({ item: i, quantidade: lerQtd(quantidades[i] ?? ''), ressalva: ressalvas[i] ?? '' }))
      .filter((i) => i.quantidade > 0 || i.ressalva.trim());
    if (!itens.some((i) => i.quantidade > 0)) {
      toast.error('Informe a quantidade recebida de pelo menos um item.');
      return;
    }
    const ok = await postar({ acao: 'entrada', responsavel, observacao, notaId: notaId || null, itens });
    if (ok) {
      toast.success('Recebimento registrado.');
      setQuantidades(visao.itens.map(() => ''));
      setRessalvas(visao.itens.map(() => ''));
      setObservacao('');
    }
  }

  async function atestar() {
    if (!responsavel.trim()) {
      toast.error('Informe o seu nome para registrar o OK.');
      return;
    }
    const ok = await postar({ acao: 'atestar', responsavel, confirmo: true });
    if (ok) toast.success('OK registrado. O financeiro foi avisado de que o pagamento está liberado.');
  }

  function receberTudoPendente() {
    setQuantidades(visao.saldo.map((s) => (s.pendente > 0 ? String(s.pendente).replace('.', ',') : '')));
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="text-xs font-semibold uppercase tracking-wider text-brand">Conferência de recebimento</div>
        <h1 className="text-2xl font-semibold tracking-tight [text-wrap:balance]">{visao.rotulo}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {visao.fornecedor} <StatusBadge status={visao.status} />
        </div>
      </div>

      {visao.pagamentoLiberadoEm && (
        <div className="flex items-start gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
          OK para pagamento dado por {visao.pagamentoLiberadoPor} em {dataHora(visao.pagamentoLiberadoEm)}.
        </div>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">O que o pedido pede e o que já chegou</h2>
        <TabelaSaldo saldo={visao.saldo} />
      </section>

      {visao.notasEntrega.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Notas de entrega do fornecedor</h2>
          {visao.notasEntrega.map((n) => (
            <div key={n.id} className="rounded-xl border border-border p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">NF {n.numero || 'sem número'}</span>
                <FinalidadeBadge finalidade={n.finalidade} />
                <span className="text-xs text-muted-foreground">{n.data_emissao}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {n.itens.map((i) => `${qtd(i.quantidade)} ${i.unidade} ${i.descricao}`).join(' · ')}
              </div>
              <Apontamentos itens={n.apontamentos} vazio="Itens e quantidades batem com o pedido." />
            </div>
          ))}
        </section>
      )}

      {!encerrado && (
        <form onSubmit={registrar} className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Registrar o que chegou</h2>
            <button type="button" onClick={receberTudoPendente} className="text-xs font-medium text-brand hover:underline">
              Chegou tudo o que faltava
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Conte o material e informe só o que chegou em bom estado. O que não veio (ou veio avariado) fica como pendência
            com o fornecedor. Use a ressalva para registrar o problema.
          </p>

          <div className="space-y-2">
            {visao.itens.map((it, i) => {
              const s = visao.saldo[i]!;
              return (
                <div key={i} className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[minmax(0,1fr)_8rem_minmax(0,1fr)] sm:items-center">
                  <div className="min-w-0 text-sm">
                    <div className="font-medium">{it.descricao}</div>
                    <div className="text-xs text-muted-foreground">
                      Pendente: {qtd(s.pendente)} {it.unidade}
                    </div>
                  </div>
                  <input
                    className={CAMPO}
                    inputMode="decimal"
                    placeholder="Qtd. recebida"
                    aria-label={`Quantidade recebida de ${it.descricao}`}
                    disabled={s.pendente <= 0}
                    value={quantidades[i] ?? ''}
                    onChange={(e) => setQuantidades((q) => q.map((v, j) => (j === i ? e.target.value : v)))}
                  />
                  <input
                    className={CAMPO}
                    placeholder="Ressalva (opcional)"
                    aria-label={`Ressalva de ${it.descricao}`}
                    value={ressalvas[i] ?? ''}
                    onChange={(e) => setRessalvas((r) => r.map((v, j) => (j === i ? e.target.value : v)))}
                  />
                </div>
              );
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Seu nome *</span>
              <input className={CAMPO} value={responsavel} onChange={(e) => setResponsavel(e.target.value)} />
            </label>
            {visao.notasEntrega.length > 0 && (
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Chegou com a nota</span>
                <select className={CAMPO} value={notaId} onChange={(e) => setNotaId(e.target.value)}>
                  <option value="">Sem nota no sistema</option>
                  {visao.notasEntrega.map((n) => (
                    <option key={n.id} value={n.id}>
                      NF {n.numero || 'sem número'}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Observação (opcional)</span>
            <input className={CAMPO} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </label>

          <button
            type="submit"
            disabled={enviando || tudoEntregue}
            className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground h-11 px-6 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <PackageCheck className="h-4 w-4" aria-hidden />}
            Registrar recebimento
          </button>
        </form>
      )}

      {!encerrado && (
        <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold">OK para pagamento</h2>
          {tudoEntregue ? (
            <>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" checked={confirmo} onChange={(e) => setConfirmo(e.target.checked)} />
                <span>Atesto que todos os produtos do pedido foram entregues, conferidos e estão sem ressalva.</span>
              </label>
              <button
                type="button"
                disabled={!confirmo || enviando}
                onClick={() => void atestar()}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 text-white h-11 px-6 text-sm font-semibold disabled:opacity-50"
              >
                <ShieldCheck className="h-4 w-4" aria-hidden /> Liberar pagamento
              </button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              O OK só fica disponível quando todos os itens tiverem chegado. Enquanto houver pendência, o pagamento segue
              bloqueado.
            </p>
          )}
        </section>
      )}

      {visao.entradas.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Recebimentos registrados</h2>
          <ul className="divide-y divide-border rounded-xl border border-border text-sm">
            {visao.entradas.map((e) => (
              <li key={e.id} className="px-3 py-2">
                <div className="text-xs text-muted-foreground">
                  {dataHora(e.created_at)} · {e.responsavel}
                </div>
                {e.itens
                  .map((i) => `${qtd(i.quantidade)} ${visao.itens[i.item]?.unidade ?? ''} de ${visao.itens[i.item]?.descricao ?? 'item'}${i.ressalva ? ` (ressalva: ${i.ressalva})` : ''}`)
                  .join('; ')}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
