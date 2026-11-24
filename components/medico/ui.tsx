'use client';

import { useState } from 'react';
import { Copy, Loader2, Mail, X } from 'lucide-react';
import { toast } from 'sonner';

import { mailto, type Mensagem } from '@/lib/medico/mensagens';
import type { EstadoMedico } from '@/lib/medico/types';

// Peças compartilhadas das telas da Área Médica (sub-projeto 100).

export const CAMPO =
  'w-full rounded-xl border border-input bg-background px-3 h-10 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';
export const ROTULO = 'mb-1 block text-xs font-medium text-muted-foreground';
export const CARTAO = 'rounded-2xl border border-border bg-card p-4 sm:p-5';
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
      ? 'bg-brand text-white hover:bg-brand/90'
      : tipo === 'perigo'
        ? 'border border-red-500/40 text-red-700 hover:bg-red-500/10 dark:text-red-300'
        : 'border border-border hover:bg-muted';
  return (
    <button
      type="button"
      onClick={onClick}
      title={titulo}
      disabled={ocupado || desabilitado}
      className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${cor}`}
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

/** Mostra um e-mail pronto: copiar o texto ou abrir no programa de e-mail. A ação final (ex.: marcar como pedido) é opcional. */
export function JanelaDeMensagem({
  titulo,
  mensagem,
  onFechar,
  acao,
  aviso,
}: {
  titulo: string;
  mensagem: Mensagem;
  onFechar: () => void;
  acao?: { rotulo: string; executar: () => Promise<void> };
  aviso?: string;
}) {
  const [corpo, setCorpo] = useState(mensagem.corpo);
  const [ocupado, setOcupado] = useState(false);
  const atual = { ...mensagem, corpo };

  async function copiar() {
    try {
      await navigator.clipboard.writeText(`${mensagem.assunto}\n\n${corpo}`);
      toast.success('Texto copiado.');
    } catch {
      toast.error('Não foi possível copiar. Selecione o texto e copie.');
    }
  }

  return (
    <Janela titulo={titulo} onFechar={onFechar}>
      <div className="space-y-3 text-sm">
        <p>
          <span className="text-muted-foreground">Para: </span>
          {mensagem.para || <span className="text-amber-700 dark:text-amber-300">sem e-mail cadastrado (preencha em Cadastros)</span>}
        </p>
        <p>
          <span className="text-muted-foreground">Assunto: </span>
          {mensagem.assunto}
        </p>
        <textarea value={corpo} onChange={(e) => setCorpo(e.target.value)} rows={12} className={`${CAMPO} h-auto py-2 font-mono text-xs leading-relaxed`} aria-label="Texto do e-mail" />
        {aviso && <p className="text-xs text-muted-foreground">{aviso}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Botao tipo="secundario" onClick={copiar}>
            <Copy className="h-4 w-4" aria-hidden /> Copiar
          </Botao>
          <a href={mailto(atual)} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-medium hover:bg-muted">
            <Mail className="h-4 w-4" aria-hidden /> Abrir no e-mail
          </a>
          {acao && (
            <Botao
              ocupado={ocupado}
              onClick={async () => {
                setOcupado(true);
                await acao.executar();
                setOcupado(false);
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
