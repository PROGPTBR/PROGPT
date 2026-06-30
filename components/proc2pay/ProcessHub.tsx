'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, Workflow, ArrowRight } from 'lucide-react';
import { getStage } from '@/lib/proc2pay/stages';
import type { Proc2PayProcess, StageId } from '@/lib/proc2pay/types';

type ItemRow = { descricao: string; qtd: string; unidade: string };

const STATE_BADGE: Record<string, string> = {
  em_andamento: 'border-brand/40 bg-brand/10 text-brand',
  concluido: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  cancelado: 'border-border bg-muted text-muted-foreground',
};

export function ProcessHub({
  initialProcesses,
  isPro,
}: {
  initialProcesses: Proc2PayProcess[];
  isPro: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(initialProcesses.length === 0);
  const [mode, setMode] = useState<'form' | 'email'>('email');
  const [emailText, setEmailText] = useState('');
  const [busy, setBusy] = useState(false);
  const [solicitante, setSolicitante] = useState('');
  const [categoria, setCategoria] = useState('');
  const [criticidade, setCriticidade] = useState('');
  const [descricao, setDescricao] = useState('');
  const [itens, setItens] = useState<ItemRow[]>([{ descricao: '', qtd: '1', unidade: 'un' }]);

  function setItem(i: number, patch: Partial<ItemRow>) {
    setItens((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function handleFromEmail() {
    if (!emailText.trim()) {
      toast.error('Cole o texto do e-mail da produção.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/proc2pay/processes/from-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: emailText }),
      });
      if (res.status === 402) {
        toast.error('O Proc2Pay é um recurso Pro.', {
          action: { label: 'Ver planos', onClick: () => router.push('/pricing') },
        });
        setBusy(false);
        return;
      }
      if (!res.ok) {
        toast.error('Não foi possível abrir o processo. Tente novamente.');
        setBusy(false);
        return;
      }
      const { process } = await res.json();
      router.push(`/proc2pay/${process.id}`);
    } catch {
      toast.error('Erro de rede. Tente novamente.');
      setBusy(false);
    }
  }

  async function handleCreate() {
    if (!solicitante.trim() || !descricao.trim()) {
      toast.error('Preencha o solicitante e a descrição da demanda.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/proc2pay/processes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          solicitante,
          categoria: categoria || undefined,
          criticidade: criticidade || undefined,
          descricao,
          itens: itens
            .filter((r) => r.descricao.trim())
            .map((r) => ({ descricao: r.descricao, qtd: Number(r.qtd) || 1, unidade: r.unidade || 'un' })),
        }),
      });
      if (res.status === 402) {
        toast.error('O Proc2Pay é um recurso Pro.', {
          action: { label: 'Ver planos', onClick: () => router.push('/pricing') },
        });
        setBusy(false);
        return;
      }
      if (!res.ok) {
        toast.error('Não foi possível abrir o processo. Tente novamente.');
        setBusy(false);
        return;
      }
      const { process } = await res.json();
      router.push(`/proc2pay/${process.id}`);
    } catch {
      toast.error('Erro de rede. Tente novamente.');
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-gradient text-black brand-glow">
          <Workflow className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Proc2Pay <span className="text-brand">.</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Da requisição ao envio da ordem de compra — um fluxo só, com os assistentes encadeados.
          </p>
        </div>
        <Link
          href="/proc2pay/exemplo"
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-border bg-background hover:bg-accent text-sm font-medium h-9 px-4 transition-colors"
        >
          Ver exemplo
        </Link>
      </div>

      {/* Novo processo */}
      <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Nova requisição de compra</h2>
          {initialProcesses.length > 0 && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="text-sm text-brand hover:text-brand/80"
            >
              {open ? 'Fechar' : 'Abrir formulário'}
            </button>
          )}
        </div>

        {open && (
          <div className="space-y-4">
            {!isPro && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                O Proc2Pay é um recurso <strong>Pro</strong>. Você pode preencher, mas a abertura exige assinatura ativa.
              </div>
            )}

            {/* Seletor de modo de entrada */}
            <div className="inline-flex rounded-full border border-border p-0.5 text-sm">
              <button
                type="button"
                onClick={() => setMode('email')}
                className={`rounded-full px-3 py-1 transition-colors ${mode === 'email' ? 'bg-brand text-white' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Colar e-mail
              </button>
              <button
                type="button"
                onClick={() => setMode('form')}
                className={`rounded-full px-3 py-1 transition-colors ${mode === 'form' ? 'bg-brand text-white' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Formulário
              </button>
            </div>

            {mode === 'email' ? (
              <div className="space-y-3">
                <Field label="E-mail da produção">
                  <textarea
                    value={emailText}
                    onChange={(e) => setEmailText(e.target.value)}
                    rows={7}
                    className={inputCls}
                    placeholder="Cole aqui o e-mail/solicitação da área. A IA estrutura a requisição (solicitante, itens, quantidades, prazo) automaticamente."
                  />
                </Field>
                <button
                  type="button"
                  onClick={handleFromEmail}
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-gradient text-black font-medium h-10 px-5 text-sm brand-glow disabled:opacity-50"
                >
                  {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Estruturando…</> : <>Estruturar e abrir <ArrowRight className="h-4 w-4" /></>}
                </button>
              </div>
            ) : (
            <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Solicitante *">
                <input value={solicitante} onChange={(e) => setSolicitante(e.target.value)} className={inputCls} placeholder="Produção / Manutenção" />
              </Field>
              <Field label="Categoria">
                <input value={categoria} onChange={(e) => setCategoria(e.target.value)} className={inputCls} placeholder="Ex.: MRO, matéria-prima" />
              </Field>
              <Field label="Criticidade">
                <select value={criticidade} onChange={(e) => setCriticidade(e.target.value)} className={inputCls}>
                  <option value="">—</option>
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                </select>
              </Field>
            </div>
            <Field label="Descrição da demanda *">
              <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} className={inputCls} placeholder="O que precisa ser comprado e por quê" />
            </Field>

            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Itens</div>
              {itens.map((row, i) => (
                <div key={i} className="flex gap-2">
                  <input value={row.descricao} onChange={(e) => setItem(i, { descricao: e.target.value })} className={`${inputCls} flex-1`} placeholder="Descrição do item" />
                  <input value={row.qtd} onChange={(e) => setItem(i, { qtd: e.target.value })} className={`${inputCls} w-20`} placeholder="Qtd" inputMode="numeric" />
                  <input value={row.unidade} onChange={(e) => setItem(i, { unidade: e.target.value })} className={`${inputCls} w-20`} placeholder="un" />
                  <button type="button" onClick={() => setItens((r) => r.filter((_, idx) => idx !== i))} className="px-2 text-muted-foreground hover:text-red-500" aria-label="Remover item">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => setItens((r) => [...r, { descricao: '', qtd: '1', unidade: 'un' }])} className="inline-flex items-center gap-1 text-sm text-brand hover:text-brand/80">
                <Plus className="h-4 w-4" /> Adicionar item
              </button>
            </div>

            <button
              type="button"
              onClick={handleCreate}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-gradient text-black font-medium h-10 px-5 text-sm brand-glow disabled:opacity-50"
            >
              {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Abrindo…</> : <>Abrir processo <ArrowRight className="h-4 w-4" /></>}
            </button>
            </>
            )}
          </div>
        )}
      </section>

      {/* Lista de processos */}
      {initialProcesses.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Seus processos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {initialProcesses.map((p) => (
              <Link
                key={p.id}
                href={`/proc2pay/${p.id}`}
                className="rounded-2xl border border-border bg-card p-4 hover:border-brand/40 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{p.numero}</span>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${STATE_BADGE[p.state] ?? STATE_BADGE.cancelado}`}>
                    {p.state === 'concluido' ? 'Concluído' : p.state === 'cancelado' ? 'Cancelado' : 'Em andamento'}
                  </span>
                </div>
                <div className="mt-1 font-medium truncate">{p.titulo}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Etapa atual: {safeStageLabel(p.status)}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function safeStageLabel(status: string): string {
  try {
    return getStage(status as StageId).label;
  } catch {
    return status;
  }
}

const inputCls =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/40';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
