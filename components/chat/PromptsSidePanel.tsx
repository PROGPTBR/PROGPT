'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import Link from 'next/link';

import {
  ArrowRight,
  BookOpen,
  Loader2,
  Search,
  X,
} from 'lucide-react';

import type { PublicPrompt } from '@/lib/prompts/types';

type Props = {
  onClose: () => void;
  onSelectPrompt?: (content: string) => void;
};

export function PromptsSidePanel({
  onClose,
  onSelectPrompt,
}: Props) {
  const [prompts, setPrompts] =
    useState<PublicPrompt[]>([]);

  const [search, setSearch] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPrompts() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          '/api/prompts',
          {
            cache: 'no-store',
          }
        );

        if (!response.ok) {
          throw new Error(
            'Falha ao carregar prompts'
          );
        }

        const data =
          (await response.json()) as {
            prompts?: PublicPrompt[];
          };

        if (cancelled) {
          return;
        }

        setPrompts(
          data.prompts ?? []
        );
      } catch {
        if (cancelled) {
          return;
        }

        setError(
          'Não foi possível carregar os prompts.'
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPrompts();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredPrompts =
    useMemo(() => {
      const term =
        search
          .trim()
          .toLowerCase();

      if (!term) {
        return prompts;
      }

      return prompts.filter(
        (prompt) => {
          const searchableText = [
            prompt.title,
            prompt.summary,
            prompt.category,
            ...(prompt.tags ?? []),
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          return searchableText.includes(
            term
          );
        }
      );
    }, [
      prompts,
      search,
    ]);

  function selectPrompt(
    prompt: PublicPrompt
  ) {
    const content =
      prompt.content?.trim();

    if (!content) {
      return;
    }

    if (onSelectPrompt) {
      onSelectPrompt(content);
      return;
    }

    try {
      window.sessionStorage.setItem(
        'progpt_chat_prefill',
        content
      );

      window.location.href =
        '/chat';
    } catch {
      /* ignore */
    }
  }

  return (
    <aside
      className="
        dark
        flex
        h-full
        w-[22rem]
        max-w-[92vw]
        shrink-0
        flex-col
        overflow-hidden

        border-r
        border-border

        bg-card
        text-foreground

        md:m-2
        md:ml-0
        md:h-[calc(100vh-1rem)]
        md:rounded-2xl
        md:border
        md:shadow-panel

        dark:md:ring-1
        dark:md:ring-white/10
      "
    >
      {/* =====================================================
          CABEÇALHO
      ====================================================== */}

      <div
        className="
          flex
          shrink-0
          items-center
          justify-between
          gap-3

          border-b
          border-border

          px-4
          py-4
        "
      >
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="
              flex
              h-9
              w-9
              shrink-0
              items-center
              justify-center

              rounded-xl

              bg-brand/10
              text-brand
            "
          >
            <BookOpen
              className="h-4 w-4"
              aria-hidden="true"
            />
          </div>

          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-foreground">
              Biblioteca de Prompts
            </h2>

            <p className="text-xs text-muted-foreground">
              Prompts prontos para Procurement
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar Biblioteca de Prompts"
          title="Fechar"
          className="
            flex
            h-9
            w-9
            shrink-0
            items-center
            justify-center

            rounded-lg

            text-muted-foreground

            transition-colors

            hover:bg-accent
            hover:text-foreground
          "
        >
          <X
            className="h-4 w-4"
            aria-hidden="true"
          />
        </button>
      </div>

      {/* =====================================================
          INTRODUÇÃO + BUSCA
      ====================================================== */}

      <div className="shrink-0 px-4 pb-3 pt-4">
        <p className="text-sm font-semibold text-foreground">
          Escolha um prompt para começar
        </p>

        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Clique em um prompt para levá-lo diretamente ao chat.
        </p>

        <div className="relative mt-3">
          <Search
            className="
              pointer-events-none
              absolute
              left-3
              top-1/2
              h-4
              w-4
              -translate-y-1/2
              text-muted-foreground
            "
            aria-hidden="true"
          />

          <input
            type="search"
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
            placeholder="Buscar prompt..."
            className="
              h-10
              w-full

              rounded-xl

              border
              border-border

              bg-background/40

              pl-9
              pr-3

              text-sm
              text-foreground

              outline-none

              transition-colors

              placeholder:text-muted-foreground

              focus:border-brand/50
            "
          />
        </div>
      </div>

      {/* =====================================================
          LISTA DE PROMPTS
      ====================================================== */}

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2
              className="h-5 w-5 animate-spin text-brand"
              aria-hidden="true"
            />
          </div>
        ) : error ? (
          <div
            className="
              rounded-xl
              border
              border-border
              bg-muted/20
              p-4
              text-sm
              text-muted-foreground
            "
          >
            {error}
          </div>
        ) : filteredPrompts.length ===
          0 ? (
          <div
            className="
              rounded-xl
              border
              border-border
              bg-muted/20
              p-4
              text-sm
              text-muted-foreground
            "
          >
            Nenhum prompt encontrado.
          </div>
        ) : (
          <div className="space-y-2">
            {filteredPrompts.map(
              (prompt) => (
                <button
                  key={prompt.id}
                  type="button"
                  onClick={() =>
                    selectPrompt(
                      prompt
                    )
                  }
                  className="
                    group
                    block
                    w-full

                    rounded-xl

                    border
                    border-border

                    bg-background/20

                    px-3
                    py-3

                    text-left

                    transition-all

                    hover:border-brand/40
                    hover:bg-brand/5
                  "
                >
                  <div className="flex items-start gap-3">
                    {/* Ícone */}
                    <div
                      className="
                        mt-0.5

                        flex
                        h-9
                        w-9
                        shrink-0
                        items-center
                        justify-center

                        rounded-xl

                        border
                        border-brand/20

                        bg-brand/10

                        text-brand
                      "
                    >
                      <BookOpen
                        className="h-4 w-4"
                        aria-hidden="true"
                      />
                    </div>

                    {/* Conteúdo */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className="
                            line-clamp-2
                            text-sm
                            font-semibold
                            leading-5
                            text-foreground
                          "
                        >
                          {prompt.title}
                        </span>

                        {prompt.prompt_number !=
                          null && (
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            #
                            {
                              prompt.prompt_number
                            }
                          </span>
                        )}
                      </div>

                      {/* Resumo */}
                      {prompt.summary && (
                        <p
                          className="
                            mt-1
                            line-clamp-2
                            text-xs
                            leading-5
                            text-muted-foreground
                          "
                        >
                          {
                            prompt.summary
                          }
                        </p>
                      )}

                      {/* Categoria */}
                      {prompt.category && (
                        <span
                          className="
                            mt-2
                            inline-flex
                            max-w-full

                            truncate

                            rounded-full

                            bg-muted

                            px-2
                            py-1

                            text-[10px]
                            text-muted-foreground
                          "
                        >
                          {
                            prompt.category
                          }
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            )}
          </div>
        )}
      </div>

      {/* =====================================================
          RODAPÉ
      ====================================================== */}

      <div className="shrink-0 border-t border-border p-3">
        <Link
          href="/prompts"
          className="
            group

            flex
            items-center
            justify-between

            rounded-xl

            px-3
            py-2.5

            text-sm
            font-medium
            text-brand

            transition-colors

            hover:bg-brand/10
          "
        >
          <span>
            Ver todos os prompts
          </span>

          <ArrowRight
            className="
              h-4
              w-4

              transition-transform

              group-hover:translate-x-0.5
            "
            aria-hidden="true"
          />
        </Link>
      </div>
    </aside>
  );
}