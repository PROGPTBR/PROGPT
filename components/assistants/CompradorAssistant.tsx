'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Paperclip,
  Inbox,
  Plus,
  Settings as SettingsIcon,
  ArrowLeft,
  Send,
  Sparkles,
  Trash2,
  Loader2,
  ShieldCheck,
  Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { CompradorImportDialog } from '@/components/assistants/CompradorImportDialog';
import type { CompradorResult } from '@/lib/assistants/comprador';

const brl = (n: number) =>
  Number.isFinite(n) ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';

type Sev = 'info' | 'warn' | 'danger';
type QuoteSummary = {
  id: string;
  title: string;
  supplier_name: string | null;
  supplier_email: string | null;
  status: string;
  severidade: Sev | null;
  created_at: string;
};
type FullQuote = QuoteSummary & {
  escopo: string;
  propostas: string;
  politica: string;
  analysis: CompradorResult | null;
};
type Reply = {
  id: string;
  quote_id: string;
  to_email: string | null;
  subject: string;
  body: string;
  status: 'draft' | 'approved' | 'sent' | 'discarded';
  created_at: string;
  sent_at: string | null;
};
type Settings = {
  tone: 'cordial' | 'formal' | 'firme';
  rules: string;
  signature: string;
  approval_required: boolean;
  auto_draft: boolean;
};

const SEV_BADGE: Record<Sev, { label: string; cls: string }> = {
  info: { label: 'OK', cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' },
  warn: { label: 'Atenção', cls: 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300' },
  danger: { label: 'Risco', cls: 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-300' },
};
const STATUS_LABEL: Record<string, string> = {
  analyzed: 'Analisada',
  awaiting_reply: 'Resposta pronta',
  replied: 'Respondida',
  closed: 'Fechada',
};

type View = 'list' | 'new' | 'detail' | 'settings';

export function CompradorAssistant() {
  const [view, setView] = useState<View>('list');
  const [quotes, setQuotes] = useState<QuoteSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);

  const loadQuotes = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch('/api/assistants/comprador/quotes');
      const data = (await res.json()) as { quotes?: QuoteSummary[] };
      setQuotes(data.quotes ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void loadQuotes();
  }, [loadQuotes]);

  function openDetail(id: string) {
    setActiveId(id);
    setView('detail');
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Hero */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-gradient text-black brand-glow">
            <Inbox className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Robô Comprador <span className="text-brand">.</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Sua caixa de cotações: compara por TCO, aponta desvios e responde aos fornecedores — com sua aprovação.
            </p>
          </div>
        </div>
        {view === 'list' && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setView('settings')}>
              <SettingsIcon className="h-4 w-4 mr-1.5" /> Configurar
            </Button>
            <button
              onClick={() => setView('new')}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-gradient text-black h-9 px-4 text-sm font-semibold brand-glow hover:brightness-110 active:scale-95 transition-all"
            >
              <Plus className="h-4 w-4" /> Nova cotação
            </button>
          </div>
        )}
      </div>

      {view === 'list' && (
        <QuotesList
          quotes={quotes}
          loading={loadingList}
          onOpen={openDetail}
          onNew={() => setView('new')}
        />
      )}
      {view === 'new' && (
        <NewQuote
          onCancel={() => setView('list')}
          onCreated={(id) => {
            void loadQuotes();
            openDetail(id);
          }}
        />
      )}
      {view === 'detail' && activeId && (
        <QuoteDetail
          id={activeId}
          onBack={() => {
            setView('list');
            void loadQuotes();
          }}
        />
      )}
      {view === 'settings' && <SettingsPanel onBack={() => setView('list')} />}
    </div>
  );
}

// ─────────────────────────────── Lista ───────────────────────────────
function QuotesList({
  quotes,
  loading,
  onOpen,
  onNew,
}: {
  quotes: QuoteSummary[];
  loading: boolean;
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (quotes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
        <Inbox className="mx-auto h-10 w-10 text-muted-foreground/50" />
        <h2 className="mt-3 text-lg font-semibold">Sua caixa está vazia</h2>
        <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
          Crie uma cotação colando as propostas dos fornecedores (ou importando PDF/Excel). O robô analisa por TCO e rascunha a resposta.
        </p>
        <button
          onClick={onNew}
          className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-brand-gradient text-black h-10 px-5 text-sm font-semibold brand-glow hover:brightness-110 transition-all"
        >
          <Plus className="h-4 w-4" /> Nova cotação
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {quotes.map((q) => {
        const sev = q.severidade ? SEV_BADGE[q.severidade] : null;
        return (
          <button
            key={q.id}
            onClick={() => onOpen(q.id)}
            className="w-full text-left rounded-2xl border border-border bg-card p-4 hover:border-brand/40 hover:shadow-md transition-all flex items-center gap-4"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Mail className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-foreground truncate">{q.title}</div>
              <div className="text-xs text-muted-foreground truncate">
                {q.supplier_name || q.supplier_email || 'Sem fornecedor'} ·{' '}
                {new Date(q.created_at).toLocaleDateString('pt-BR')}
              </div>
            </div>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {STATUS_LABEL[q.status] ?? q.status}
            </span>
            {sev && (
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${sev.cls}`}>
                {sev.label}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────── Nova cotação ───────────────────────────────
const EXEMPLO = {
  escopo: '200 paletes PBR (1200x1000), entrega no Porto de Santos, até 30 dias.',
  propostas:
    'Fornecedor A (Madeireira Litoral): R$ 95,00/un, frete R$ 1.200, impostos inclusos, prazo 20 dias, 28 ddl.\n' +
    'Fornecedor B (PaletPro): R$ 88,00/un, frete R$ 2.500, impostos +12%, prazo 35 dias, à vista.\n' +
    'Fornecedor C (EcoPallets): R$ 91,50/un, frete grátis, impostos inclusos, prazo 25 dias, 14 ddl.',
  politica: 'Alçada de aprovação automática: R$ 50.000. Exigir 3 cotações. Homologados: Madeireira Litoral, PaletPro.',
};

function NewQuote({ onCancel, onCreated }: { onCancel: () => void; onCreated: (id: string) => void }) {
  const [supplierName, setSupplierName] = useState('');
  const [supplierEmail, setSupplierEmail] = useState('');
  const [escopo, setEscopo] = useState('');
  const [propostas, setPropostas] = useState('');
  const [politica, setPolitica] = useState('');
  const [loading, setLoading] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const lbl = 'text-xs font-medium text-muted-foreground';

  async function criar() {
    if (!propostas.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/assistants/comprador/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_name: supplierName || undefined,
          supplier_email: supplierEmail || undefined,
          escopo,
          propostas,
          politica,
        }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? `status ${res.status}`);
      }
      const data = (await res.json()) as { quote: { id: string } };
      toast.success('Cotação analisada e salva.');
      onCreated(data.quote.id);
    } catch (err) {
      toast.error('Falha ao analisar', { description: String(err) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onCancel} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <button
          onClick={() => { setEscopo(EXEMPLO.escopo); setPropostas(EXEMPLO.propostas); setPolitica(EXEMPLO.politica); setSupplierName('Madeireira Litoral'); }}
          className="text-xs text-muted-foreground underline hover:text-foreground"
        >
          Carregar exemplo
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className={lbl}>Fornecedor (opcional)</label>
          <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Nome do fornecedor" />
        </div>
        <div className="space-y-1.5">
          <label className={lbl}>E-mail do fornecedor (pra responder)</label>
          <Input value={supplierEmail} onChange={(e) => setSupplierEmail(e.target.value)} placeholder="contato@fornecedor.com" />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className={lbl}>Escopo / requisição</label>
        <Input value={escopo} onChange={(e) => setEscopo(e.target.value)} placeholder="O que comprar, quantidade, prazo, local…" />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className={lbl}>Propostas dos fornecedores</label>
          <Button type="button" variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Paperclip className="h-3.5 w-3.5 mr-1" /> Importar (PDF/Excel)
          </Button>
        </div>
        <Textarea value={propostas} onChange={(e) => setPropostas(e.target.value)} rows={9} placeholder="Cole as propostas recebidas (uma por bloco)…" />
      </div>
      <div className="space-y-1.5">
        <label className={lbl}>Política de compras / base homologada (opcional)</label>
        <Textarea value={politica} onChange={(e) => setPolitica(e.target.value)} rows={3} placeholder="Alçada, nº de cotações, fornecedores homologados…" />
      </div>
      <button
        onClick={criar}
        disabled={loading || !propostas.trim()}
        className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-brand-gradient text-black h-11 text-sm font-semibold brand-glow hover:brightness-110 disabled:opacity-50 transition-all"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {loading ? 'Analisando…' : 'Analisar e salvar na caixa'}
      </button>

      <CompradorImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(t) => setPropostas((p) => (p ? p + '\n\n' : '') + t)}
      />
    </div>
  );
}

// ─────────────────────────────── Detalhe ───────────────────────────────
function QuoteDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const [quote, setQuote] = useState<FullQuote | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafting, setDrafting] = useState(false);
  const [instruction, setInstruction] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/assistants/comprador/quotes/${id}`);
      const data = (await res.json()) as { quote: FullQuote; replies: Reply[] };
      setQuote(data.quote);
      setReplies(data.replies ?? []);
    } catch {
      toast.error('Falha ao carregar a cotação');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function rascunhar() {
    setDrafting(true);
    try {
      const res = await fetch(`/api/assistants/comprador/quotes/${id}/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: instruction || undefined }),
      });
      if (!res.ok) throw new Error(String(res.status));
      toast.success('Rascunho de resposta gerado.');
      setInstruction('');
      await load();
    } catch {
      toast.error('Falha ao rascunhar a resposta');
    } finally {
      setDrafting(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }
  if (!quote) return null;

  const a = quote.analysis;
  const activeReply = replies.find((r) => r.status === 'draft' || r.status === 'approved');
  const sentReply = replies.find((r) => r.status === 'sent');

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Caixa de cotações
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Análise */}
        <div className="space-y-4">
          {a && (
            <>
              <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
                <h2 className="text-sm font-semibold">Recomendação</h2>
                <div className="text-sm font-medium text-brand">{a.recomendacao_fornecedor}</div>
                <p className="text-sm text-muted-foreground">{a.justificativa}</p>
                <div className={'rounded-md border px-3 py-2 text-xs ' + (a.precisa_humano ? 'border-amber-500/40 bg-amber-500/10' : 'border-emerald-500/40 bg-emerald-500/10')}>
                  {a.precisa_humano ? `Requer aprovação humana — ${a.motivo_escalonamento}` : 'Dentro da alçada do agente.'}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="px-4 py-2 border-b border-border text-xs font-medium text-muted-foreground">Ranking por TCO</div>
                <table className="w-full text-left text-xs">
                  <thead><tr className="text-muted-foreground border-b border-border"><th className="px-3 py-2">Fornecedor</th><th className="px-3 py-2">Prazo</th><th className="px-3 py-2 text-right">Custo total</th></tr></thead>
                  <tbody>
                    {a.ranking?.map((it, i) => (
                      <tr key={i} className={'border-b border-border/50 ' + (it.fornecedor === a.recomendacao_fornecedor ? 'bg-brand/10' : '')}>
                        <td className="px-3 py-2">{it.fornecedor}</td>
                        <td className="px-3 py-2">{it.prazo_entrega}</td>
                        <td className="px-3 py-2 text-right">{brl(it.custo_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {a.desvios_politica?.length ? (
                <div className="rounded-2xl border border-red-500/40 bg-card p-5">
                  <div className="text-xs font-medium text-red-600 dark:text-red-400 mb-2">Desvios de política</div>
                  <ul className="space-y-1 text-sm">{a.desvios_politica.map((d, i) => <li key={i} className="text-red-600 dark:text-red-400">⛔ {d}</li>)}</ul>
                </div>
              ) : null}

              {a.pontos_negociacao?.length ? (
                <div className="rounded-2xl border border-border bg-card p-5">
                  <div className="text-xs font-medium text-muted-foreground mb-2">Pontos de negociação</div>
                  <ul className="space-y-1 text-sm text-muted-foreground">{a.pontos_negociacao.map((p, i) => <li key={i}>→ {p}</li>)}</ul>
                </div>
              ) : null}
            </>
          )}
        </div>

        {/* Resposta ao fornecedor */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-brand/30 bg-brand-gradient-soft p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-brand" />
              <h2 className="text-sm font-semibold">Resposta ao fornecedor</h2>
            </div>

            {sentReply ? (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-1">
                <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-300">
                  <ShieldCheck className="h-4 w-4" /> Enviada
                  {sentReply.sent_at && <span className="text-xs font-normal text-muted-foreground">· {new Date(sentReply.sent_at).toLocaleString('pt-BR')}</span>}
                </div>
                <div className="text-sm font-medium">{sentReply.subject}</div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{sentReply.body}</p>
              </div>
            ) : activeReply ? (
              <ReplyEditor reply={activeReply} hasEmail={!!quote.supplier_email} onChanged={load} />
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  O robô rascunha uma resposta (pedir dados faltantes, negociar) baseada na análise — você revisa e aprova antes de enviar.
                </p>
                <Input
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder="Intenção (opcional): ex. negociar 8%, pedir frete CIF…"
                />
                <button
                  onClick={rascunhar}
                  disabled={drafting}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-brand-gradient text-black h-10 text-sm font-semibold brand-glow hover:brightness-110 disabled:opacity-50 transition-all"
                >
                  {drafting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {drafting ? 'Rascunhando…' : 'Rascunhar resposta'}
                </button>
              </div>
            )}
          </div>

          {/* PO rascunho */}
          {a?.pedido_compra?.fornecedor ? (
            <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-muted-foreground">Pedido de Compra (rascunho)</div>
                <span className="text-xs font-mono text-brand">{a.pedido_compra.numero}</span>
              </div>
              <div className="text-sm"><span className="text-muted-foreground">Fornecedor:</span> {a.pedido_compra.fornecedor}</div>
              <div className="text-sm flex justify-between border-t border-border pt-2">
                <span className="text-muted-foreground">{a.pedido_compra.condicao_pagamento} · {a.pedido_compra.prazo_entrega}</span>
                <span className="font-semibold text-brand">{brl(a.pedido_compra.valor_total)}</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ReplyEditor({ reply, hasEmail, onChanged }: { reply: Reply; hasEmail: boolean; onChanged: () => Promise<void> }) {
  const [subject, setSubject] = useState(reply.subject);
  const [body, setBody] = useState(reply.body);
  const [busy, setBusy] = useState<'save' | 'send' | 'discard' | null>(null);

  async function patch(payload: Record<string, unknown>) {
    const res = await fetch(`/api/assistants/comprador/replies/${reply.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(String(res.status));
  }

  async function salvar() {
    setBusy('save');
    try { await patch({ subject, body }); toast.success('Rascunho salvo.'); }
    catch { toast.error('Falha ao salvar'); } finally { setBusy(null); }
  }
  async function enviar() {
    if (!hasEmail) { toast.error('Sem e-mail do fornecedor nesta cotação.'); return; }
    setBusy('send');
    try {
      await patch({ subject, body });
      const res = await fetch(`/api/assistants/comprador/replies/${reply.id}/send`, { method: 'POST' });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? String(res.status));
      }
      toast.success('Resposta enviada ao fornecedor.');
      await onChanged();
    } catch (err) {
      toast.error('Falha ao enviar', { description: String(err) });
    } finally { setBusy(null); }
  }
  async function descartar() {
    setBusy('discard');
    try { await patch({ status: 'discarded' }); await onChanged(); }
    catch { toast.error('Falha ao descartar'); } finally { setBusy(null); }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md bg-brand/10 border border-brand/20 px-2.5 py-1.5 text-[11px] text-brand">
        Rascunho — nada é enviado sem sua aprovação.
      </div>
      <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Assunto" />
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} />
      <div className="flex flex-wrap gap-2">
        <button
          onClick={enviar}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-gradient text-black h-9 px-4 text-sm font-semibold brand-glow hover:brightness-110 disabled:opacity-50 transition-all"
        >
          {busy === 'send' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Aprovar e enviar
        </button>
        <Button variant="outline" size="sm" onClick={salvar} disabled={busy !== null}>
          {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar rascunho'}
        </Button>
        <Button variant="ghost" size="sm" onClick={descartar} disabled={busy !== null} className="text-muted-foreground hover:text-red-500">
          <Trash2 className="h-4 w-4 mr-1" /> Descartar
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────── Config ───────────────────────────────
function SettingsPanel({ onBack }: { onBack: () => void }) {
  const [s, setS] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [alias, setAlias] = useState<string | null>(null);
  const [inboundEnabled, setInboundEnabled] = useState(false);
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    fetch('/api/assistants/comprador/settings')
      .then((r) => r.json())
      .then((d: { settings: Settings; inboundAlias: string | null; inboundEnabled: boolean }) => {
        setS(d.settings);
        setAlias(d.inboundAlias);
        setInboundEnabled(d.inboundEnabled);
      })
      .catch(() => setS({ tone: 'cordial', rules: '', signature: '', approval_required: true, auto_draft: true }));
  }, []);

  async function activate() {
    setActivating(true);
    try {
      const res = await fetch('/api/assistants/comprador/inbound/activate', { method: 'POST' });
      const d = (await res.json()) as { alias?: string; error?: string };
      if (!res.ok || !d.alias) throw new Error(d.error ?? 'falha');
      setAlias(d.alias);
      toast.success('Recebimento por e-mail ativado.');
    } catch (err) {
      toast.error('Não foi possível ativar', { description: String(err) });
    } finally {
      setActivating(false);
    }
  }

  async function salvar() {
    if (!s) return;
    setSaving(true);
    try {
      const res = await fetch('/api/assistants/comprador/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(s),
      });
      if (!res.ok) throw new Error(String(res.status));
      toast.success('Configuração salva.');
      onBack();
    } catch {
      toast.error('Falha ao salvar');
    } finally {
      setSaving(false);
    }
  }

  if (!s) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const lbl = 'text-xs font-medium text-muted-foreground uppercase tracking-wider';
  const TONES: { v: Settings['tone']; t: string }[] = [
    { v: 'cordial', t: 'Cordial' },
    { v: 'formal', t: 'Formal' },
    { v: 'firme', t: 'Firme' },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-5 max-w-2xl">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>
      <div>
        <h2 className="text-lg font-semibold">Configurar o robô</h2>
        <p className="text-sm text-muted-foreground">Como o robô deve falar com seus fornecedores.</p>
      </div>

      <div className="space-y-1.5">
        <label className={lbl}>Tom das respostas</label>
        <div className="flex gap-2">
          {TONES.map((o) => (
            <button
              key={o.v}
              onClick={() => setS({ ...s, tone: o.v })}
              className={`rounded-full px-4 h-9 text-sm font-medium border transition-colors ${
                s.tone === o.v ? 'bg-brand text-black border-brand' : 'border-border text-muted-foreground hover:bg-accent'
              }`}
            >
              {o.t}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className={lbl}>Regras (sempre respeitadas)</label>
        <Textarea
          value={s.rules}
          onChange={(e) => setS({ ...s, rules: e.target.value })}
          rows={4}
          placeholder="Ex.: sempre pedir frete e impostos discriminados; nunca aceitar prazo acima de 30 dias sem aviso; exigir validade mínima de 15 dias."
        />
      </div>

      <div className="space-y-1.5">
        <label className={lbl}>Assinatura</label>
        <Textarea
          value={s.signature}
          onChange={(e) => setS({ ...s, signature: e.target.value })}
          rows={3}
          placeholder={'Atenciosamente,\nEquipe de Compras — 2B Supply'}
        />
      </div>

      <label className="flex items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={s.approval_required}
          disabled
          className="h-4 w-4 accent-brand"
        />
        <span className="text-foreground">Exigir aprovação antes de enviar</span>
        <span className="text-xs text-muted-foreground">(sempre ativo nesta versão)</span>
      </label>
      <label className="flex items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={s.auto_draft}
          onChange={(e) => setS({ ...s, auto_draft: e.target.checked })}
          className="h-4 w-4 accent-brand"
        />
        <span className="text-foreground">Rascunhar resposta automaticamente ao analisar/receber</span>
      </label>

      {/* Recebimento por e-mail (Resend Inbound) */}
      <div className="rounded-xl border border-brand/30 bg-brand-gradient-soft p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Mail className="h-4 w-4 text-brand" /> Recebimento por e-mail
        </div>
        {alias ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Encaminhe (ou peça pros fornecedores enviarem) as cotações para este endereço — elas caem na sua caixa já analisadas:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-card border border-border px-2.5 py-1.5 text-xs break-all">{alias}</code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard?.writeText(alias);
                  toast.success('Copiado');
                }}
              >
                Copiar
              </Button>
            </div>
          </div>
        ) : inboundEnabled ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Ative um endereço dedicado pra receber cotações automaticamente.
            </p>
            <button
              onClick={activate}
              disabled={activating}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-gradient text-black h-9 px-4 text-sm font-semibold brand-glow hover:brightness-110 disabled:opacity-50 transition-all"
            >
              {activating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Ativar recebimento por e-mail
            </button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Recebimento ainda não habilitado no servidor (falta configurar o domínio de inbound).
          </p>
        )}
      </div>

      <button
        onClick={salvar}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-full bg-brand-gradient text-black h-10 px-5 text-sm font-semibold brand-glow hover:brightness-110 disabled:opacity-50 transition-all"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar configuração'}
      </button>
    </div>
  );
}
