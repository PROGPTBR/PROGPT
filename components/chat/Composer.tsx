'use client';

import {
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { AudioLines, Paperclip, Send, StopCircle, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { MicRecorderButton } from './MicRecorderButton';

export type ChatAttachment = {
  kind: 'pdf' | 'docx' | 'xlsx' | 'image';
  filename: string;
  sizeBytes: number;
  parsedText: string;
  truncated: boolean;
};

type ComposerVariant = 'hero' | 'inline';

type Props = {
  input: string;
  onChange: (value: string) => void;
  onSubmit: (e?: FormEvent, attachment?: ChatAttachment) => void;
  isLoading: boolean;
  onStop: () => void;
  /**
   * 'inline' (default) — bottom-pinned with top border, used during a
   * conversation.
   * 'hero' — centered, larger, no top border, used on the empty state
   * landing screen (Claude/ChatGPT style).
   */
  variant?: ComposerVariant;
  /** Override placeholder text (used by empty state). */
  placeholder?: string;
  /** Quando presente, mostra o botão "Conversar por voz" (sub-projeto 35). */
  onVoiceMode?: () => void;
};

const ACCEPT_ATTR =
  '.pdf,.docx,.xlsx,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/png,image/jpeg';

const KIND_LABEL: Record<ChatAttachment['kind'], string> = {
  pdf: 'PDF',
  docx: 'DOCX',
  xlsx: 'XLSX',
  image: 'Imagem',
};

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function Composer({
  input,
  onChange,
  onSubmit,
  isLoading,
  onStop,
  variant = 'inline',
  placeholder,
  onVoiceMode,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const dragCounter = useRef(0);

  const handleFile = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/chat/attachments', {
        method: 'POST',
        body: fd,
      });
      const data = (await res.json().catch(() => ({}))) as
        | (ChatAttachment & { error?: undefined })
        | { error: string; message?: string; max_bytes?: number };
      if (!res.ok || 'error' in data) {
        const err = 'error' in data ? data.error : 'unknown';
        const msg =
          'message' in data && typeof data.message === 'string'
            ? data.message
            : null;
        if (err === 'unsupported_mime') {
          toast.error('Formato não suportado', {
            description: 'Use PDF, DOCX, XLSX, PNG ou JPG.',
          });
        } else if (err === 'file_too_large') {
          const maxMb =
            'max_bytes' in data && typeof data.max_bytes === 'number'
              ? Math.round(data.max_bytes / (1024 * 1024))
              : '5–10';
          toast.error('Arquivo grande demais', {
            description: `Limite: ${maxMb} MB.`,
          });
        } else if (err === 'rate_limited') {
          toast.error('Limite de mensagens atingido. Tente novamente em 1 min.');
        } else {
          toast.error('Falha ao processar arquivo', {
            description: msg ?? `status ${res.status}`,
          });
        }
        return;
      }
      const parsed = data as ChatAttachment;
      setAttachment(parsed);
      if (parsed.truncated) {
        toast.info('Arquivo grande — apenas o início foi enviado pra IA.', {
          description: `Cap de 8000 caracteres aplicado.`,
        });
      }
    } catch (err) {
      toast.error('Falha ao enviar', { description: String(err) });
    } finally {
      setUploading(false);
    }
  }, []);

  const onFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) void handleFile(f);
  };

  const onDragEnter = (e: DragEvent<HTMLFormElement>) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
    dragCounter.current += 1;
    setDragOver(true);
  };
  const onDragLeave = (e: DragEvent<HTMLFormElement>) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setDragOver(false);
    }
  };
  const onDragOver = (e: DragEvent<HTMLFormElement>) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
  };
  const onDrop = (e: DragEvent<HTMLFormElement>) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragOver(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) void handleFile(f);
  };

  const submit = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault();
      if (uploading) return;
      if (!input.trim() && !attachment) return;
      if (isLoading) return;
      onSubmit(e, attachment ?? undefined);
      setAttachment(null);
    },
    [attachment, input, isLoading, onSubmit, uploading],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    },
    [submit],
  );

  const handleTranscript = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const current = input.trim();
      onChange(current ? `${current} ${trimmed}` : trimmed);
    },
    [input, onChange],
  );

  const hero = variant === 'hero';

  // Auto-cresce o textarea conforme o conteúdo (até um teto), pra um prompt
  // grande — ex. vindo da Biblioteca de Prompts — aparecer inteiro em vez de
  // espremido numa linha. Acima do teto, rola internamente.
  const taRef = useRef<HTMLTextAreaElement>(null);
  const maxPx = hero ? 340 : 240;
  const autosize = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, maxPx)}px`;
  }, [maxPx]);
  useLayoutEffect(() => {
    autosize();
  }, [input, autosize]);

  // Container styling differs by variant.
  // - inline: pinned-bottom form with top border + safe-area padding
  // - hero: free-floating card in the middle of the screen, larger pill input
  const formClass = hero
    ? `relative w-full transition-colors ${
        dragOver ? 'bg-brand/5' : ''
      }`
    : `relative border-t bg-background dark:bg-[#0d0d0d] p-4 pb-[max(env(safe-area-inset-bottom),1rem)] transition-colors ${
        dragOver ? 'border-brand bg-brand/5' : 'border-border'
      }`;

  return (
    <form
      onSubmit={submit}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={formClass}
    >
      {dragOver && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-2 rounded-2xl border-2 border-dashed border-brand/60 bg-brand/5 flex items-center justify-center"
        >
          <span className="text-sm text-brand font-medium">
            Solte o arquivo para anexar
          </span>
        </div>
      )}

      <div className={hero ? 'w-full space-y-3' : 'max-w-3xl mx-auto space-y-2'}>
        {attachment && (
          <AttachmentChip
            attachment={attachment}
            onRemove={() => setAttachment(null)}
            disabled={isLoading}
          />
        )}
        {uploading && !attachment && (
          <div className="inline-flex items-center gap-2 rounded-full bg-muted border border-border px-3 h-8 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Processando arquivo…
          </div>
        )}

        {hero ? (
          /* Hero variant — Claude/ChatGPT-style centered card. Textarea
              fills the box; controls sit in a row at the bottom. */
          <div className="rounded-3xl border border-border bg-card shadow-sm focus-within:border-brand/60 focus-within:ring-2 focus-within:ring-brand/20 transition-all">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_ATTR}
              onChange={onFileInputChange}
              className="hidden"
            />
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder ?? 'Pergunte alguma coisa…'}
              rows={5}
              autoFocus
              className="block w-full resize-none overflow-y-auto bg-transparent px-5 pt-4 pb-2 text-base text-foreground placeholder-muted-foreground outline-none"
            />
            <div className="flex items-center justify-between px-3 pb-3 pt-1">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || isLoading}
                  aria-label="Anexar arquivo"
                  title="Anexar arquivo (PDF, DOCX, XLSX, PNG, JPG)"
                  className="inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent w-9 h-9 transition-colors active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Paperclip className="h-4 w-4" aria-hidden="true" />
                </button>
                <MicRecorderButton
                  size="sm"
                  onTranscript={handleTranscript}
                  disabled={isLoading}
                />
                {onVoiceMode && (
                  <button
                    type="button"
                    onClick={onVoiceMode}
                    disabled={isLoading}
                    aria-label="Conversar por voz em tempo real"
                    title="Conversar por voz — fale com o assistente em tempo real"
                    className="inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-brand hover:bg-brand/10 w-9 h-9 transition-colors active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <AudioLines className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>
              {isLoading ? (
                <button
                  type="button"
                  onClick={onStop}
                  aria-label="Parar geração"
                  title="Parar"
                  className="inline-flex items-center justify-center rounded-full bg-muted text-foreground hover:bg-accent w-9 h-9 transition-colors active:scale-95"
                >
                  <StopCircle className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="submit"
                  aria-label="Enviar"
                  title="Enviar"
                  disabled={(!input.trim() && !attachment) || uploading}
                  className="inline-flex items-center justify-center rounded-full bg-brand text-black hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed w-9 h-9 transition-all duration-300 active:scale-95"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Inline variant — pinned-bottom row layout */
          <div className="flex gap-2 items-end">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_ATTR}
              onChange={onFileInputChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || isLoading}
              aria-label="Anexar arquivo"
              title="Anexar arquivo (PDF, DOCX, XLSX, PNG, JPG)"
              className="inline-flex items-center justify-center rounded-full border border-border bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-accent w-11 h-11 transition-all duration-300 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            >
              <Paperclip className="h-4 w-4" aria-hidden="true" />
            </button>
            <MicRecorderButton
              size="lg"
              onTranscript={handleTranscript}
              disabled={isLoading}
            />
            {onVoiceMode && (
              <button
                type="button"
                onClick={onVoiceMode}
                disabled={isLoading}
                aria-label="Conversar por voz em tempo real"
                title="Conversar por voz — fale com o assistente em tempo real"
                className="inline-flex items-center justify-center rounded-full border border-border bg-muted/40 text-muted-foreground hover:text-brand hover:bg-brand/10 w-11 h-11 transition-all duration-300 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
              >
                <AudioLines className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                placeholder ??
                (attachment
                  ? 'Pergunte algo sobre o arquivo anexado…'
                  : 'Pergunte algo sobre teorias de procurement…')
              }
              rows={1}
              className="flex-1 resize-none overflow-y-auto rounded-xl bg-muted/40 border border-border px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-brand focus:bg-muted/60 transition-colors"
            />
            {isLoading ? (
              <button
                type="button"
                onClick={onStop}
                aria-label="Parar geração"
                title="Parar"
                className="inline-flex items-center justify-center rounded-full border border-border bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-accent w-11 h-11 transition-all duration-300 active:scale-95 flex-shrink-0"
              >
                <StopCircle className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="submit"
                aria-label="Enviar"
                title="Enviar"
                disabled={(!input.trim() && !attachment) || uploading}
                className="inline-flex items-center justify-center rounded-full bg-brand text-black hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed w-11 h-11 transition-all duration-300 active:scale-95 flex-shrink-0"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>
    </form>
  );
}

function AttachmentChip({
  attachment,
  onRemove,
  disabled,
}: {
  attachment: ChatAttachment;
  onRemove: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-brand/10 border border-brand/30 px-3 h-8 text-xs">
      <Paperclip className="h-3 w-3 text-brand flex-shrink-0" aria-hidden="true" />
      <span className="text-[10px] font-semibold uppercase tracking-wider text-brand">
        {KIND_LABEL[attachment.kind]}
      </span>
      <span className="text-foreground/80 truncate max-w-[200px]" title={attachment.filename}>
        {attachment.filename}
      </span>
      <span className="text-muted-foreground">{fmtSize(attachment.sizeBytes)}</span>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label="Remover anexo"
        className="text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-40"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
