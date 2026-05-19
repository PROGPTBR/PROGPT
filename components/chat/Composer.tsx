'use client';

import {
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useRef,
  useState,
} from 'react';
import { Paperclip, Send, StopCircle, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export type ChatAttachment = {
  kind: 'pdf' | 'docx' | 'xlsx' | 'image';
  filename: string;
  sizeBytes: number;
  parsedText: string;
  truncated: boolean;
};

type Props = {
  input: string;
  onChange: (value: string) => void;
  onSubmit: (e?: FormEvent, attachment?: ChatAttachment) => void;
  isLoading: boolean;
  onStop: () => void;
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
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  // Track outermost drag state across nested dragenter/leave events.
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
      // Clear pending state — message is already in flight.
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

  return (
    <form
      onSubmit={submit}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`relative border-t bg-[#0d0d0d] p-4 pb-[max(env(safe-area-inset-bottom),1rem)] transition-colors ${
        dragOver ? 'border-brand bg-brand/5' : 'border-white/5'
      }`}
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

      <div className="max-w-3xl mx-auto space-y-2">
        {attachment && (
          <AttachmentChip
            attachment={attachment}
            onRemove={() => setAttachment(null)}
            disabled={isLoading}
          />
        )}
        {uploading && !attachment && (
          <div className="inline-flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-3 h-8 text-xs text-gray-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Processando arquivo…
          </div>
        )}

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
            className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 w-11 h-11 transition-all duration-300 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            <Paperclip className="h-4 w-4" aria-hidden="true" />
          </button>
          <textarea
            value={input}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              attachment
                ? 'Pergunte algo sobre o arquivo anexado…'
                : 'Pergunte algo sobre teorias de procurement…'
            }
            rows={1}
            className="flex-1 resize-none max-h-32 overflow-y-auto rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-brand focus:bg-white/10 transition-colors"
          />
          {isLoading ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Parar geração"
              title="Parar"
              className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 w-11 h-11 transition-all duration-300 active:scale-95 flex-shrink-0"
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
      <span className="text-gray-300 truncate max-w-[200px]" title={attachment.filename}>
        {attachment.filename}
      </span>
      <span className="text-gray-500">{fmtSize(attachment.sizeBytes)}</span>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label="Remover anexo"
        className="text-gray-400 hover:text-red-400 transition-colors disabled:opacity-40"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
