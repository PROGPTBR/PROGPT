'use client';

import { useState } from 'react';
import { Copy, Info as IconeInfo, Loader2, Mail, MessageCircle, Paperclip, Send, X } from 'lucide-react';
import { toast } from 'sonner';

import { mailto, type Mensagem } from '@/lib/medico/mensagens';
import type { EstadoMedico } from '@/lib/medico/types';

// Peças compartilhadas das telas da Área Médica (sub-projeto 100).

export const CAMPO =
  'w-full rounded-2xl border-0 bg-neutral-100 px-3.5 h-11 text-sm outline-none ring-1 ring-transparent focus:bg-white focus:ring-2 focus:ring-medico';
export const ROTULO = 'mb-1 block text-xs font-medium text-muted-foreground';
export const CARTAO = 'rounded-3xl bg-white p-4 ring-1 ring-black/[0.06] sm:p-6';
export const TH = 'px-3 py-2 font-medium whitespace-nowrap';
export const TD = 'px-3 py-2 align-top';

export function brl(v: number | null | undefined): string {
  if (v == null) return 'sem valor';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function dataBr(iso: string | null | undefined): string {
  if (!iso) return 'sem data';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** "1.234,56", "1234.56" ou "1234,5" → número. */
export function lerNumero(s: string): number | null {
  const t = s.trim().replace(/\s|R\$/g, '');
  if (!t) return null;
  const normal = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  const n = Number(normal);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** O que cada aba recebe: os dados, o dia de hoje e como gravar. */
export type PropsDaAba = {
  estado: EstadoMedico;
  hoje: string;
  /** Chama a API, avisa o erro na tela e recarrega os dados. Devolve a resposta ou null. */
  enviar: <T = unknown>(metodo: 'POST' | 'PATCH' | 'PUT' | 'DELETE', caminho: string, corpo?: unknown, sucesso?: string) => Promise<T | null>;
  recarregar: () => Promise<void>;
};

/** Envio automático pelo sistema (e-mail, ou WhatsApp ao paciente). */
export type EnvioAutomatico = {
  tipo: 'pedido_nota' | 'envio_nota' | 'cobranca_hospital' | 'cobranca_paciente';
  id: string;
  /** Canais que o servidor tem prontos para este envio. */
  canais: ('email' | 'whatsapp')[];
  /** Mostra o campo para anexar o PDF da nota. */
  anexo?: boolean;
  /** Depois de enviado (a etapa já foi avançada no servidor). */
  aoEnviar: () => Promise<void>;
};

export async function chamar<T>(metodo: string, caminho: string, corpo?: unknown): Promise<{ ok: true; dados: T } | { ok: false; mensagem: string }> {
  try {
    const res = await fetch(`/api/medico${caminho}`, {
      method: metodo,
      headers: corpo === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    const dados = (await res.json().catch(() => ({}))) as T & { message?: string };
    if (!res.ok) return { ok: false, mensagem: dados.message ?? 'Não foi possível concluir agora. Tente de novo.' };
    return { ok: true, dados };
  } catch {
    return { ok: false, mensagem: 'Sem conexão. Tente de novo.' };
  }
}

/** O "i": a explicação fica guardada e aparece quando o médico toca. */
export function Info({ children, claro = false }: { children: React.ReactNode; claro?: boolean }) {
  const [aberto, setAberto] = useState(false);
  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        onBlur={() => setAberto(false)}
        aria-label="Saiba mais"
        aria-expanded={aberto}
        className={`grid h-6 w-6 place-items-center rounded-full transition ${claro ? 'text-white/70 hover:bg-white/15 hover:text-white' : 'text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700'}`}
      >
        <IconeInfo className="h-4 w-4" aria-hidden />
      </button>
      {aberto && (
        <span role="tooltip" className="absolute left-0 top-7 z-40 w-64 max-w-[78vw] rounded-2xl bg-neutral-900 px-3.5 py-3 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-white shadow-xl">
          {children}
        </span>
      )}
    </span>
  );
}

export function Botao({
  children,
  onClick,
  tipo = 'primario',
  ocupado = false,
  desabilitado = false,
  titulo,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  tipo?: 'primario' | 'secundario' | 'perigo';
  ocupado?: boolean;
  desabilitado?: boolean;
  titulo?: string;
}) {
  const cor =
    tipo === 'primario'
      ? 'bg-medico text-white hover:bg-medico/90'
      : tipo === 'perigo'
        ? 'border border-red-500/40 text-red-700 hover:bg-red-500/10 dark:text-red-300'
        : 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200';
  return (
    <button
      type="button"
      onClick={onClick}
      title={titulo}
      disabled={ocupado || desabilitado}
      className={`inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${cor}`}
    >
      {ocupado && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Selo({ children, cor = 'neutro' }: { children: React.ReactNode; cor?: 'neutro' | 'verde' | 'amarelo' | 'vermelho' | 'azul' }) {
  const classe = {
    neutro: 'bg-muted text-muted-foreground',
    verde: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    amarelo: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    vermelho: 'bg-red-500/15 text-red-700 dark:text-red-300',
    azul: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  }[cor];
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${classe}`}>{children}</span>;
}

export function Janela({ titulo, onFechar, children, larga = false }: { titulo: string; onFechar: () => void; children: React.ReactNode; larga?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className={`w-full ${larga ? 'max-w-4xl' : 'max-w-xl'} rounded-3xl border border-border bg-background p-5 shadow-xl`}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold">{titulo}</h2>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * Mostra uma mensagem pronta. Com `envio`, o sistema manda por conta própria
 * (e a etapa avança sozinha); sempre dá para copiar ou abrir no e-mail e
 * marcar à mão com `acao`.
 */
export function JanelaDeMensagem({
  titulo,
  mensagem,
  onFechar,
  acao,
  aviso,
  envio,
}: {
  titulo: string;
  mensagem: Mensagem;
  onFechar: () => void;
  acao?: { rotulo: string; executar: () => Promise<void> };
  aviso?: string;
  envio?: EnvioAutomatico;
}) {
  const [corpo, setCorpo] = useState(mensagem.corpo);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const atual = { ...mensagem, corpo };
  const ehEmail = mensagem.para.includes('@');

  async function copiar() {
    try {
      await navigator.clipboard.writeText(`${mensagem.assunto}\n\n${corpo}`);
      toast.success('Texto copiado.');
    } catch {
      toast.error('Não foi possível copiar. Selecione o texto e copie.');
    }
  }

  async function enviarAgora(canal: 'email' | 'whatsapp') {
    if (!envio) return;
    setOcupado(canal);
    const fd = new FormData();
    fd.set('tipo', envio.tipo);
    fd.set('canal', canal);
    fd.set('id', envio.id);
    fd.set('corpo', corpo);
    if (arquivo) fd.set('arquivo', arquivo);
    try {
      const res = await fetch('/api/medico/enviar', { method: 'POST', body: fd });
      const dados = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) toast.error(dados.message ?? 'Não foi possível enviar agora.');
      else {
        toast.success(canal === 'email' ? 'E-mail enviado.' : 'Mensagem enviada pelo WhatsApp.');
        await envio.aoEnviar();
      }
    } catch {
      toast.error('Sem conexão. Tente de novo.');
    }
    setOcupado(null);
  }

  return (
    <Janela titulo={titulo} onFechar={onFechar}>
      <div className="space-y-3 text-sm">
        <p>
          <span className="text-muted-foreground">Para: </span>
          {mensagem.para || <span className="text-amber-700 dark:text-amber-300">sem contato cadastrado</span>}
        </p>
        <p>
          <span className="text-muted-foreground">Assunto: </span>
          {mensagem.assunto}
        </p>
        <textarea value={corpo} onChange={(e) => setCorpo(e.target.value)} rows={12} className={`${CAMPO} h-auto py-2 font-mono text-xs leading-relaxed`} aria-label="Texto do e-mail" />
        {envio?.anexo && (
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2 text-xs hover:bg-muted">
            <Paperclip className="h-4 w-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{arquivo ? arquivo.name : 'Anexar o PDF da nota (vai junto no envio automático)'}</span>
            <input type="file" accept=".pdf,.xml,image/*" className="hidden" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
          </label>
        )}
        {aviso && <p className="text-xs text-muted-foreground">{aviso}</p>}
        {envio && envio.canais.length > 0 && (
          <div className="flex flex-wrap justify-end gap-2">
            {envio.canais.includes('whatsapp') && !ehEmail && (
              <Botao ocupado={ocupado === 'whatsapp'} desabilitado={!!ocupado} onClick={() => enviarAgora('whatsapp')}>
                <MessageCircle className="h-4 w-4" aria-hidden /> Enviar pelo WhatsApp
              </Botao>
            )}
            {envio.canais.includes('email') && ehEmail && (
              <Botao ocupado={ocupado === 'email'} desabilitado={!!ocupado} onClick={() => enviarAgora('email')}>
                <Send className="h-4 w-4" aria-hidden /> Enviar agora
              </Botao>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
          <span className="mr-auto text-xs text-muted-foreground">{envio && envio.canais.length > 0 ? 'Ou envie você mesmo:' : ''}</span>
          <Botao tipo="secundario" onClick={copiar}>
            <Copy className="h-4 w-4" aria-hidden /> Copiar
          </Botao>
          {ehEmail && (
            <a href={mailto(atual)} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-medium hover:bg-muted">
              <Mail className="h-4 w-4" aria-hidden /> Abrir no e-mail
            </a>
          )}
          {acao && (
            <Botao
              tipo="secundario"
              ocupado={ocupado === 'acao'}
              desabilitado={!!ocupado}
              onClick={async () => {
                setOcupado('acao');
                await acao.executar();
                setOcupado(null);
              }}
            >
              {acao.rotulo}
            </Botao>
          )}
        </div>
      </div>
    </Janela>
  );
}
