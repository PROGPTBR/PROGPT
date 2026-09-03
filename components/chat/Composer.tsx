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

import {
  AudioLines,
  Globe,
  Loader2,
  Paperclip,
  Plus,
  Send,
  StopCircle,
  X,
} from 'lucide-react';

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

  onSubmit: (
    e?: FormEvent,
    attachment?: ChatAttachment
  ) => void;

  isLoading: boolean;

  onStop: () => void;

  /**
   * 'inline' (default) — bottom-pinned com borda superior.
   * 'hero' — campo principal da tela vazia.
   */
  variant?: ComposerVariant;

  /** Placeholder personalizado */
  placeholder?: string;

  /** Conversa por voz em tempo real */
  onVoiceMode?: () => void;

  /**
   * Assistente Pessoal — modo livre, sem restrição de domínio, com busca na
   * web. `personalMode` controla o estado visual (botão "ativo"); só
   * aparece o botão quando `onTogglePersonalMode` é passado.
   */
  personalMode?: boolean;
  onTogglePersonalMode?: () => void;
};

const ACCEPT_ATTR =
  '.pdf,.docx,.xlsx,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/png,image/jpeg';

const KIND_LABEL: Record<
  ChatAttachment['kind'],
  string
> = {
  pdf: 'PDF',
  docx: 'DOCX',
  xlsx: 'XLSX',
  image: 'Imagem',
};

function fmtSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
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
  personalMode,
  onTogglePersonalMode,
}: Props) {
  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const taRef =
    useRef<HTMLTextAreaElement>(null);

  const dragCounter = useRef(0);

  const [attachment, setAttachment] =
    useState<ChatAttachment | null>(null);

  const [uploading, setUploading] =
    useState(false);

  const [dragOver, setDragOver] =
    useState(false);

  const [
    attachmentMenuOpen,
    setAttachmentMenuOpen,
  ] = useState(false);

  const hero = variant === 'hero';

  /**
   * HERO:
   * começa com apenas uma linha e cresce até 180px.
   *
   * INLINE:
   * mantém limite maior.
   */
  const maxPx = hero ? 180 : 240;

  const autosize = useCallback(() => {
    const el = taRef.current;

    if (!el) {
      return;
    }

    el.style.height = 'auto';

    const nextHeight = Math.min(
      el.scrollHeight,
      maxPx
    );

    el.style.height = `${nextHeight}px`;
  }, [maxPx]);

  useLayoutEffect(() => {
    autosize();
  }, [input, autosize]);

  const handleFile = useCallback(
    async (file: File) => {
      setUploading(true);

      try {
        const fd = new FormData();

        fd.append('file', file);

        const res = await fetch(
          '/api/chat/attachments',
          {
            method: 'POST',
            body: fd,
          }
        );

        const data = (await res
          .json()
          .catch(() => ({}))) as
          | (ChatAttachment & {
              error?: undefined;
            })
          | {
              error: string;
              message?: string;
              max_bytes?: number;
            };

        if (!res.ok || 'error' in data) {
          const err =
            'error' in data
              ? data.error
              : 'unknown';

          const msg =
            'message' in data &&
            typeof data.message === 'string'
              ? data.message
              : null;

          if (err === 'unsupported_mime') {
            toast.error(
              'Formato não suportado',
              {
                description:
                  'Use PDF, DOCX, XLSX, PNG ou JPG.',
              }
            );
          } else if (
            err === 'file_too_large'
          ) {
            const maxMb =
              'max_bytes' in data &&
              typeof data.max_bytes ===
                'number'
                ? Math.round(
                    data.max_bytes /
                      (1024 * 1024)
                  )
                : '5–10';

            toast.error(
              'Arquivo grande demais',
              {
                description: `Limite: ${maxMb} MB.`,
              }
            );
          } else if (
            err === 'rate_limited'
          ) {
            toast.error(
              'Limite de mensagens atingido. Tente novamente em 1 min.'
            );
          } else {
            toast.error(
              'Falha ao processar arquivo',
              {
                description:
                  msg ??
                  `status ${res.status}`,
              }
            );
          }

          return;
        }

        const parsed =
          data as ChatAttachment;

        setAttachment(parsed);

        if (parsed.truncated) {
          toast.info(
            'Arquivo grande — apenas o início foi enviado pra IA.',
            {
              description:
                'Cap de 8000 caracteres aplicado.',
            }
          );
        }
      } catch (err) {
        toast.error('Falha ao enviar', {
          description: String(err),
        });
      } finally {
        setUploading(false);
      }
    },
    []
  );

  const onFileInputChange = (
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      e.target.files?.[0];

    e.target.value = '';

    setAttachmentMenuOpen(false);

    if (file) {
      void handleFile(file);
    }
  };

  const onDragEnter = (
    e: DragEvent<HTMLFormElement>
  ) => {
    if (
      !e.dataTransfer?.types?.includes(
        'Files'
      )
    ) {
      return;
    }

    e.preventDefault();

    dragCounter.current += 1;

    setDragOver(true);
  };

  const onDragLeave = (
    e: DragEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    dragCounter.current -= 1;

    if (dragCounter.current <= 0) {
      dragCounter.current = 0;

      setDragOver(false);
    }
  };

  const onDragOver = (
    e: DragEvent<HTMLFormElement>
  ) => {
    if (
      !e.dataTransfer?.types?.includes(
        'Files'
      )
    ) {
      return;
    }

    e.preventDefault();
  };

  const onDrop = (
    e: DragEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    dragCounter.current = 0;

    setDragOver(false);

    setAttachmentMenuOpen(false);

    const file =
      e.dataTransfer?.files?.[0];

    if (file) {
      void handleFile(file);
    }
  };

  const submit = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault();

      if (uploading) {
        return;
      }

      if (
        !input.trim() &&
        !attachment
      ) {
        return;
      }

      if (isLoading) {
        return;
      }

      onSubmit(
        e,
        attachment ?? undefined
      );

      setAttachment(null);

      setAttachmentMenuOpen(false);
    },
    [
      attachment,
      input,
      isLoading,
      onSubmit,
      uploading,
    ]
  );

  const handleKeyDown = useCallback(
    (
      e: KeyboardEvent<HTMLTextAreaElement>
    ) => {
      if (
        e.key === 'Enter' &&
        !e.shiftKey
      ) {
        e.preventDefault();

        submit();
      }
    },
    [submit]
  );

  const handleTranscript = useCallback(
    (text: string) => {
      const trimmed = text.trim();

      if (!trimmed) {
        return;
      }

      const current = input.trim();

      onChange(
        current
          ? `${current} ${trimmed}`
          : trimmed
      );
    },
    [input, onChange]
  );

  const formClass = hero
    ? `relative w-full transition-colors ${
        dragOver ? 'bg-brand/5' : ''
      }`
    : `relative border-t bg-background p-4 pb-[max(env(safe-area-inset-bottom),1rem)] transition-colors ${
        dragOver
          ? 'border-brand bg-brand/5'
          : 'border-border'
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
      {/* Drag & drop */}
      {dragOver && (
        <div
          aria-hidden="true"
          className="
            pointer-events-none
            absolute
            inset-2
            z-[60]
            flex
            items-center
            justify-center
            rounded-2xl
            border-2
            border-dashed
            border-brand/60
            bg-brand/5
          "
        >
          <span className="text-sm font-medium text-brand">
            Solte o arquivo para anexar
          </span>
        </div>
      )}

      <div
        className={
          hero
            ? 'w-full'
            : 'max-w-3xl mx-auto space-y-2'
        }
      >
        {/* =====================================================
            ANEXO — SOMENTE INLINE
        ====================================================== */}

        {!hero && attachment && (
          <AttachmentChip
            attachment={attachment}
            onRemove={() =>
              setAttachment(null)
            }
            disabled={isLoading}
          />
        )}

        {!hero &&
          uploading &&
          !attachment && (
            <div className="inline-flex h-8 items-center gap-2 rounded-full border border-border bg-muted px-3 text-xs text-muted-foreground">
              <Loader2
                className="h-3.5 w-3.5 animate-spin"
                aria-hidden="true"
              />

              Processando arquivo…
            </div>
          )}

        {/* =====================================================
            HERO
        ====================================================== */}

        {hero ? (
          <div
            className={`
  relative
  border
  border-border
  bg-card
  shadow-sm
  transition-all
  focus-within:ring-0
  focus-within:border-border
  ${
    !attachment && input.length < 45
      ? 'rounded-full'
      : 'rounded-3xl'
  }
`}
          >
            {/* Input oculto */}
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_ATTR}
              onChange={
                onFileInputChange
              }
              className="hidden"
            />

            {/* =================================================
                LINHA PRINCIPAL
                + | TEXTO | MIC | VOZ | ENVIAR
            ================================================== */}

            <div
              className="
                flex
                min-h-[58px]
                items-end
                gap-1
                px-2
                py-2
              "
            >
              {/* ===============================================
                  BOTÃO +
              ================================================ */}

              <div className="relative flex-shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    setAttachmentMenuOpen(
                      (open) => !open
                    )
                  }
                  disabled={
                    uploading ||
                    isLoading
                  }
                  aria-label="Adicionar"
                  aria-expanded={
                    attachmentMenuOpen
                  }
                  aria-haspopup="menu"
                  title="Adicionar"
                  className="
                    inline-flex
                    h-10
                    w-10
                    items-center
                    justify-center
                    rounded-full
                    border
                    border-border
                    bg-muted/40
                    text-muted-foreground
                    transition-all
                    duration-200

                    hover:border-brand/50
                    hover:bg-brand/10
                    hover:text-brand

                    active:scale-95

                    disabled:cursor-not-allowed
                    disabled:opacity-40
                  "
                >
                  <Plus
                    className={`
                      h-5
                      w-5
                      transition-transform
                      duration-200
                      ${
                        attachmentMenuOpen
                          ? 'rotate-45'
                          : ''
                      }
                    `}
                    aria-hidden="true"
                  />
                </button>

                {/* Menu */}
                {attachmentMenuOpen && (
                  <div
                    role="menu"
                    className="
                      absolute
                      left-0
                      top-12
                      z-50
                      w-[210px]
                      rounded-2xl
                      border
                      border-border
                      bg-popover
                      p-1.5
                      shadow-xl
                    "
                  >
                    <button
                      type="button"
                      role="menuitem"
                      disabled={
                        uploading ||
                        isLoading
                      }
                      onClick={() => {
                        setAttachmentMenuOpen(
                          false
                        );

                        fileInputRef.current?.click();
                      }}
                      className="
                        flex
                        w-full
                        items-center
                        gap-3
                        rounded-xl
                        px-2.5
                        py-2.5
                        text-left
                        transition-colors

                        hover:bg-accent

                        disabled:pointer-events-none
                        disabled:opacity-40
                      "
                    >
                      <span
                        className="
                          inline-flex
                          h-9
                          w-9
                          flex-shrink-0
                          items-center
                          justify-center
                          rounded-lg
                          bg-muted
                          text-muted-foreground
                        "
                      >
                        <Paperclip
                          className="h-4 w-4"
                          aria-hidden="true"
                        />
                      </span>

                      <span className="text-sm font-medium text-foreground">
                        Anexar arquivo
                      </span>
                    </button>
                  </div>
                )}
              </div>

              {/* ===============================================
                  TEXTAREA

                  rows={1}
                  começa baixo e cresce conforme o texto
              ================================================ */}

              <textarea
                ref={taRef}
                value={input}
                onChange={(e) =>
                  onChange(
                    e.target.value
                  )
                }
                onKeyDown={
                  handleKeyDown
                }
                placeholder={
                  placeholder ??
                  'Pergunte alguma coisa…'
                }
                rows={1}
                autoFocus
                className="
                  min-h-[40px]
                  max-h-[180px]
                  min-w-0
                  flex-1
                  resize-none
                  overflow-y-auto
                  bg-transparent
                  px-2
                  py-2
                  text-base
                  leading-6
                  text-foreground
                  placeholder-muted-foreground
                  outline-none
                "
              />

              {/* ===============================================
                  CONTROLES
              ================================================ */}

              <div
                className="
                  flex
                  flex-shrink-0
                  items-center
                  gap-0.5
                "
              >
                <MicRecorderButton
                  size="sm"
                  onTranscript={
                    handleTranscript
                  }
                  disabled={isLoading}
                />

                {onVoiceMode && (
                  <button
                    type="button"
                    onClick={
                      onVoiceMode
                    }
                    disabled={
                      isLoading
                    }
                    aria-label="Conversar por voz em tempo real"
                    title="Conversar por voz — fale com o assistente em tempo real"
                    className="
                      inline-flex
                      h-9
                      w-9
                      items-center
                      justify-center
                      rounded-full
                      text-muted-foreground
                      transition-colors

                      hover:bg-brand/10
                      hover:text-brand

                      active:scale-95

                      disabled:cursor-not-allowed
                      disabled:opacity-40
                    "
                  >
                    <AudioLines
                      className="h-4 w-4"
                      aria-hidden="true"
                    />
                  </button>
                )}

                {onTogglePersonalMode && (
                  <button
                    type="button"
                    onClick={
                      onTogglePersonalMode
                    }
                    aria-pressed={
                      !!personalMode
                    }
                    aria-label="Modo Pessoal — pergunte qualquer coisa, com busca ao vivo"
                    title="Modo Pessoal — pergunte qualquer coisa, com busca ao vivo"
                    className={
                      personalMode
                        ? `
                      inline-flex
                      h-9
                      w-9
                      items-center
                      justify-center
                      rounded-full
                      bg-brand/15
                      text-brand
                      transition-colors

                      hover:bg-brand/25

                      active:scale-95
                    `
                        : `
                      inline-flex
                      h-9
                      w-9
                      items-center
                      justify-center
                      rounded-full
                      text-muted-foreground
                      transition-colors

                      hover:bg-brand/10
                      hover:text-brand

                      active:scale-95
                    `
                    }
                  >
                    <Globe
                      className="h-4 w-4"
                      aria-hidden="true"
                    />
                  </button>
                )}

                {isLoading ? (
                  <button
                    type="button"
                    onClick={onStop}
                    aria-label="Parar geração"
                    title="Parar"
                    className="
                      inline-flex
                      h-10
                      w-10
                      items-center
                      justify-center
                      rounded-full
                      bg-muted
                      text-foreground
                      transition-colors

                      hover:bg-accent

                      active:scale-95
                    "
                  >
                    <StopCircle
                      className="h-4 w-4"
                      aria-hidden="true"
                    />
                  </button>
                ) : (
                  <button
                    type="submit"
                    aria-label="Enviar"
                    title="Enviar"
                    disabled={
                      (!input.trim() &&
                        !attachment) ||
                      uploading
                    }
                    className="
                      inline-flex
                      h-10
                      w-10
                      items-center
                      justify-center
                      rounded-full
                      bg-brand-gradient
                      text-black
                      brand-glow
                      transition-all
                      duration-300

                      hover:brightness-110

                      active:scale-95

                      disabled:cursor-not-allowed
                      disabled:opacity-40
                      disabled:shadow-none
                    "
                  >
                    <Send
                      className="h-4 w-4"
                      aria-hidden="true"
                    />
                  </button>
                )}
              </div>
            </div>

            {/* =================================================
                ANEXO DENTRO DO BOX

                Fica abaixo do texto e encostado à esquerda.
            ================================================== */}

            {(attachment ||
              uploading) && (
              <div className="px-3 pb-3 pt-1">
                {attachment && (
                  <AttachmentChip
                    attachment={
                      attachment
                    }
                    onRemove={() =>
                      setAttachment(null)
                    }
                    disabled={
                      isLoading
                    }
                  />
                )}

                {uploading &&
                  !attachment && (
                    <div
                      className="
                        inline-flex
                        h-8
                        items-center
                        gap-2
                        rounded-full
                        border
                        border-border
                        bg-muted
                        px-3
                        text-xs
                        text-muted-foreground
                      "
                    >
                      <Loader2
                        className="h-3.5 w-3.5 animate-spin"
                        aria-hidden="true"
                      />

                      Processando arquivo…
                    </div>
                  )}
              </div>
            )}
          </div>
        ) : (
          /* ===================================================
              INLINE
              Mantido com a estrutura original
          ==================================================== */

          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_ATTR}
              onChange={
                onFileInputChange
              }
              className="hidden"
            />

            {/* Anexo */}
            <button
              type="button"
              onClick={() =>
                fileInputRef.current?.click()
              }
              disabled={
                uploading ||
                isLoading
              }
              aria-label="Anexar arquivo"
              title="Anexar arquivo (PDF, DOCX, XLSX, PNG, JPG)"
              className="
                inline-flex
                h-11
                w-11
                flex-shrink-0
                items-center
                justify-center
                rounded-full
                border
                border-border
                bg-muted/40
                text-muted-foreground
                transition-all
                duration-300

                hover:bg-accent
                hover:text-foreground

                active:scale-95

                disabled:cursor-not-allowed
                disabled:opacity-40
              "
            >
              <Paperclip
                className="h-4 w-4"
                aria-hidden="true"
              />
            </button>

            {/* Microfone */}
            <MicRecorderButton
              size="lg"
              onTranscript={
                handleTranscript
              }
              disabled={isLoading}
            />

            {/* Voz */}
            {onVoiceMode && (
              <button
                type="button"
                onClick={
                  onVoiceMode
                }
                disabled={
                  isLoading
                }
                aria-label="Conversar por voz em tempo real"
                title="Conversar por voz — fale com o assistente em tempo real"
                className="
                  inline-flex
                  h-11
                  w-11
                  flex-shrink-0
                  items-center
                  justify-center
                  rounded-full
                  border
                  border-border
                  bg-muted/40
                  text-muted-foreground
                  transition-all
                  duration-300

                  hover:bg-brand/10
                  hover:text-brand

                  active:scale-95

                  disabled:cursor-not-allowed
                  disabled:opacity-40
                "
              >
                <AudioLines
                  className="h-4 w-4"
                  aria-hidden="true"
                />
              </button>
            )}

            {/* Modo Pessoal */}
            {onTogglePersonalMode && (
              <button
                type="button"
                onClick={
                  onTogglePersonalMode
                }
                aria-pressed={
                  !!personalMode
                }
                aria-label="Modo Pessoal — pergunte qualquer coisa, com busca ao vivo"
                title="Modo Pessoal — pergunte qualquer coisa, com busca ao vivo"
                className={
                  personalMode
                    ? `
                  inline-flex
                  h-11
                  w-11
                  flex-shrink-0
                  items-center
                  justify-center
                  rounded-full
                  border
                  border-brand/60
                  bg-brand/15
                  text-brand
                  transition-all
                  duration-300

                  hover:bg-brand/25

                  active:scale-95
                `
                    : `
                  inline-flex
                  h-11
                  w-11
                  flex-shrink-0
                  items-center
                  justify-center
                  rounded-full
                  border
                  border-border
                  bg-muted/40
                  text-muted-foreground
                  transition-all
                  duration-300

                  hover:bg-brand/10
                  hover:text-brand

                  active:scale-95
                `
                }
              >
                <Globe
                  className="h-4 w-4"
                  aria-hidden="true"
                />
              </button>
            )}

            {/* Campo */}
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) =>
                onChange(
                  e.target.value
                )
              }
              onKeyDown={
                handleKeyDown
              }
              placeholder={
                placeholder ??
                (attachment
                  ? 'Pergunte algo sobre o arquivo anexado…'
                  : 'Pergunte algo sobre teorias de procurement…')
              }
              rows={1}
              className="
                flex-1
                resize-none
                overflow-y-auto
                rounded-xl
                border
                border-border
                bg-muted/40
                px-4
                py-3
                text-sm
                text-foreground
                placeholder-muted-foreground
                outline-none
                transition-colors

                focus:border-brand
                focus:bg-muted/60
              "
            />

            {/* Enviar / parar */}
            {isLoading ? (
              <button
                type="button"
                onClick={onStop}
                aria-label="Parar geração"
                title="Parar"
                className="
                  inline-flex
                  h-11
                  w-11
                  flex-shrink-0
                  items-center
                  justify-center
                  rounded-full
                  border
                  border-border
                  bg-muted/40
                  text-muted-foreground
                  transition-all
                  duration-300

                  hover:bg-accent
                  hover:text-foreground

                  active:scale-95
                "
              >
                <StopCircle
                  className="h-4 w-4"
                  aria-hidden="true"
                />
              </button>
            ) : (
              <button
                type="submit"
                aria-label="Enviar"
                title="Enviar"
                disabled={
                  (!input.trim() &&
                    !attachment) ||
                  uploading
                }
                className="
                  inline-flex
                  h-11
                  w-11
                  flex-shrink-0
                  items-center
                  justify-center
                  rounded-full
                  bg-brand-gradient
                  text-black
                  brand-glow
                  transition-all
                  duration-300

                  hover:brightness-110

                  active:scale-95

                  disabled:cursor-not-allowed
                  disabled:opacity-40
                  disabled:shadow-none
                "
              >
                <Send
                  className="h-4 w-4"
                  aria-hidden="true"
                />
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
    <div
      className="
        inline-flex
        h-8
        max-w-full
        items-center
        gap-2
        rounded-full
        border
        border-brand/30
        bg-brand/10
        px-3
        text-xs
      "
    >
      <Paperclip
        className="
          h-3
          w-3
          flex-shrink-0
          text-brand
        "
        aria-hidden="true"
      />

      <span
        className="
          text-[10px]
          font-semibold
          uppercase
          tracking-wider
          text-brand
        "
      >
        {KIND_LABEL[attachment.kind]}
      </span>

      <span
        className="
          max-w-[200px]
          truncate
          text-foreground/80
        "
        title={attachment.filename}
      >
        {attachment.filename}
      </span>

      <span
        className="
          flex-shrink-0
          text-muted-foreground
        "
      >
        {fmtSize(
          attachment.sizeBytes
        )}
      </span>

      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label="Remover anexo"
        className="
          flex-shrink-0
          text-muted-foreground
          transition-colors

          hover:text-red-500

          disabled:opacity-40
        "
      >
        <X
          className="h-3.5 w-3.5"
          aria-hidden="true"
        />
      </button>
    </div>
  );
}