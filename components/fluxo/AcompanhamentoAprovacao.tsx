'use client';

import { useState } from 'react';
import { Check, Copy, Link2, Loader2, Mail, UserCheck, X } from 'lucide-react';
import { toast } from 'sonner';

import { avisarSobDemanda } from '@/components/vitrine/ui';
import type { FluxoAprovacao, FluxoProcesso } from '@/lib/fluxo/types';

// Fluxo de Compras, Fase 1 (sub-projeto 90): o comprador compartilha o link
// "Como está meu pedido?" com quem pediu a compra e manda a etapa para o
// gestor aprovar pelo e-mail. No processo de exemplo nada é enviado.

const INPUT =
  'w-full rounded-lg border border-input bg-background px-3 h-10 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';

function dataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function PainelAcompanhamento({
  processo,
  exemplo,
  onAtualizado,
}: {
  processo: FluxoProcesso;
  exemplo: boolean;
  onAtualizado: (p: FluxoProcesso) => void;
}) {
  const [nome, setNome] = useState(processo.solicitante_nome ?? '');
  const [email, setEmail] = useState(processo.solicitante_email ?? '');
  const [busy, setBusy] = useState<null | 'link' | 'enviar'>(null);
  const [copiado, setCopiado] = useState(false);

  const token = processo.acompanhamento_token;
  const link = token && typeof window !== 'undefined' ? `${window.location.origin}/acompanhar/${token}` : null;

  async function chamar(enviar: boolean): Promise<string | null> {
    const res = await fetch(`/api/fluxo/processos/${processo.id}/acompanhamento`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(enviar ? { solicitanteNome: nome, solicitanteEmail: email, enviar: true } : {}),
    });
    const data = (await res.json().catch(() => ({}))) as {
      link?: string;
      processo?: FluxoProcesso;
      enviado?: boolean;
      message?: string;
    };
    if (!res.ok || !data.processo) {
      toast.error(data.message ?? 'Não foi possível agora.');
      return null;
    }
    onAtualizado(data.processo);
    if (enviar) {
      if (data.enviado) toast.success('Link enviado. A pessoa recebe um aviso a cada etapa concluída.');
      else toast.message('Contato salvo, mas o e-mail não saiu agora. Copie o link e mande por mensagem.');
    }
    return data.link ?? null;
  }

  async function copiar() {
    if (exemplo) {
      avisarSobDemanda('fluxo_compras', 'Copiar o link de acompanhamento');
      return;
    }
    let url = link;
    if (!url) {
      setBusy('link');
      url = await chamar(false);
      setBusy(null);
      if (!url) return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
      toast.success('Link copiado.');
    } catch {
      toast.message(url);
    }
  }

  async function enviar() {
    if (exemplo) {
      avisarSobDemanda('fluxo_compras', 'Enviar o link para quem pediu a compra');
      return;
    }
    if (!email.trim()) {
      toast.error('Informe o e-mail de quem pediu a compra.');
      return;
    }
    setBusy('enviar');
    try {
      await chamar(true);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-start gap-2">
        <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
        <div>
          <h2 className="text-sm font-semibold">Como está meu pedido?</h2>
          <p className="text-xs text-muted-foreground">
            Quem pediu a compra acompanha cada etapa por este link, sem conta e sem precisar perguntar.
            O link mostra só o andamento, sem preços nem propostas.
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input
          aria-label="Nome de quem pediu"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome de quem pediu"
          className={INPUT}
        />
        <input
          aria-label="E-mail de quem pediu"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@empresa.com.br"
          className={INPUT}
        />
        <button
          type="button"
          onClick={enviar}
          disabled={busy !== null}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 h-10 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {busy === 'enviar' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Mail className="h-4 w-4" aria-hidden />}
          Enviar link
        </button>
      </div>

      <button
        type="button"
        onClick={copiar}
        disabled={busy !== null}
        className="inline-flex items-center gap-2 rounded-full border border-border px-4 h-9 text-xs font-medium hover:bg-accent disabled:opacity-60"
      >
        {busy === 'link' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : copiado ? (
          <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
        ) : (
          <Copy className="h-3.5 w-3.5" aria-hidden />
        )}
        Copiar link de acompanhamento
      </button>
    </section>
  );
}

export function PedirAprovacaoGestor({
  processoId,
  pendenteId,
  aprovacoes,
  exemplo,
  disabled,
  onMudou,
}: {
  processoId: string;
  pendenteId: string;
  aprovacoes: FluxoAprovacao[];
  exemplo: boolean;
  disabled: boolean;
  onMudou: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const aberta = aprovacoes.find((a) => a.status === 'pendente' && a.etapa_execucao_id === pendenteId) ?? null;

  async function enviar() {
    if (exemplo) {
      avisarSobDemanda('fluxo_compras', 'Pedir aprovação do gestor por e-mail');
      return;
    }
    if (!email.trim()) {
      toast.error('Informe o e-mail do gestor.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/fluxo/processos/${processoId}/aprovacao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aprovadorNome: nome, aprovadorEmail: email }),
      });
      const data = (await res.json().catch(() => ({}))) as { enviado?: boolean; message?: string };
      if (!res.ok) {
        toast.error(data.message ?? 'Não foi possível enviar agora.');
        return;
      }
      if (data.enviado) toast.success('Pedido enviado. Quando o gestor decidir, você recebe um e-mail.');
      else toast.message('Pedido registrado, mas o e-mail não saiu agora. Tente reenviar em instantes.');
      setAberto(false);
      onMudou();
    } finally {
      setBusy(false);
    }
  }

  async function cancelar() {
    setBusy(true);
    try {
      await fetch(`/api/fluxo/processos/${processoId}/aprovacao`, { method: 'DELETE' });
      toast.success('Pedido de aprovação cancelado.');
      onMudou();
    } finally {
      setBusy(false);
    }
  }

  if (aberta) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-sky-500/40 bg-sky-500/10 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2">
          <UserCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
          <div>
            <div className="font-medium">
              Aguardando a aprovação de {aberta.aprovador_nome || aberta.aprovador_email}
            </div>
            <div className="text-xs text-muted-foreground">
              Enviado para {aberta.aprovador_email} em {dataHora(aberta.created_at)}. Se você decidir aqui
              antes, o pedido deixa de valer.
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={cancelar}
          disabled={busy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 h-8 text-xs hover:bg-accent disabled:opacity-60"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          Cancelar pedido
        </button>
      </div>
    );
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        disabled={disabled}
        className="inline-flex items-center gap-2 rounded-full border border-sky-500/50 px-4 h-10 text-sm font-medium text-sky-700 hover:bg-sky-500/10 disabled:opacity-60 dark:text-sky-300"
      >
        <UserCheck className="h-4 w-4" aria-hidden />
        Pedir aprovação do gestor por e-mail
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-sky-500/40 bg-sky-500/5 p-3">
      <p className="text-xs text-muted-foreground">
        O gestor recebe um e-mail com o resumo desta etapa e decide com um clique, sem criar conta.
        Aprovar avança a compra; reprovar devolve a etapa com o motivo.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <input aria-label="Nome do gestor" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do gestor" className={INPUT} />
        <input
          aria-label="E-mail do gestor"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="gestor@empresa.com.br"
          className={INPUT}
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={enviar}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-4 h-9 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Mail className="h-4 w-4" aria-hidden />}
          Enviar pedido
        </button>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="rounded-full border border-border px-4 h-9 text-sm text-muted-foreground hover:bg-accent"
        >
          Voltar
        </button>
      </div>
    </div>
  );
}
