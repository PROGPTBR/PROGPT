'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MarkdownEditor } from '@/components/admin/MarkdownEditor';
import { UpdateEmailPreview } from '@/components/admin/UpdateEmailPreview';
import {
  slugifyUpdateTitle,
  UPDATE_CATEGORY_LABELS,
  type ProductUpdate,
  type ProductUpdateInput,
  type UpdateCategory,
  type UpdateStatus,
} from '@/lib/updates/types';

type Draft = Omit<ProductUpdateInput, 'published_at'> & { published_at: string };

type Props = {
  open: boolean;
  initial: ProductUpdate | null;
  onCancel: () => void;
  onSave: (draft: ProductUpdateInput) => Promise<void>;
};

function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function emptyDraft(): Draft {
  return {
    title: '',
    slug: '',
    category: 'new_feature',
    summary: '',
    content_md: '',
    image_url: null,
    video_url: null,
    media_caption: null,
    published_at: toLocalInput(new Date().toISOString()),
    status: 'draft',
  };
}

export function UpdateEditor({ open, initial, onCancel, onSave }: Props) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const slugEdited = useRef(false);

  useEffect(() => {
    if (!open) return;
    slugEdited.current = initial !== null;
    setDraft(
      initial
        ? {
            title: initial.title,
            slug: initial.slug,
            category: initial.category,
            summary: initial.summary,
            content_md: initial.content_md,
            image_url: initial.image_url,
            video_url: initial.video_url,
            media_caption: initial.media_caption,
            published_at: toLocalInput(initial.published_at),
            status: initial.status,
          }
        : emptyDraft(),
    );
  }, [initial, open]);

  if (!open) return null;

  const valid =
    draft.title.trim().length > 0 &&
    draft.slug.trim().length > 0 &&
    draft.summary.trim().length > 0 &&
    draft.published_at.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col rounded-lg border border-border bg-card shadow-xl">
        <div className="border-b border-border p-4">
          <h3 className="text-base font-semibold">
            {initial ? 'Editar atualização' : 'Nova atualização'}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            O conteúdo usa Markdown, o mesmo formato dos templates e resultados do PROGPT.
          </p>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Título">
              <Input
                autoFocus
                value={draft.title}
                maxLength={160}
                onChange={(event) => {
                  const title = event.target.value;
                  setDraft((current) => ({
                    ...current,
                    title,
                    slug: slugEdited.current ? current.slug : slugifyUpdateTitle(title),
                  }));
                }}
              />
            </Field>
            <Field label="Slug único" hint="Letras minúsculas, números e hífens.">
              <Input
                value={draft.slug}
                maxLength={160}
                onChange={(event) => {
                  slugEdited.current = true;
                  setDraft((current) => ({ ...current, slug: slugifyUpdateTitle(event.target.value) }));
                }}
              />
            </Field>
            <Field label="Categoria">
              <select
                value={draft.category}
                onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value as UpdateCategory }))}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {Object.entries(UPDATE_CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select
                value={draft.status}
                onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as UpdateStatus }))}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="draft">Rascunho</option>
                <option value="published">Publicado</option>
              </select>
            </Field>
            <Field label="Data de publicação" hint="Publicações futuras aparecem automaticamente quando a data chegar.">
              <Input
                type="datetime-local"
                value={draft.published_at}
                onChange={(event) => setDraft((current) => ({ ...current, published_at: event.target.value }))}
              />
            </Field>
            <Field label="Imagem opcional" hint="URL https ou caminho em /public, iniciado por /.">
              <Input
                value={draft.image_url ?? ''}
                placeholder="/atualizacoes/imagem.png"
                onChange={(event) => setDraft((current) => ({ ...current, image_url: event.target.value || null }))}
              />
            </Field>
            <Field label="URL de vídeo opcional" hint="URL https ou caminho em /public, iniciado por /.">
              <Input
                value={draft.video_url ?? ''}
                placeholder="/atualizacoes/video.mp4"
                onChange={(event) => setDraft((current) => ({ ...current, video_url: event.target.value || null }))}
              />
            </Field>
            <Field label="Legenda da mídia opcional">
              <Input
                value={draft.media_caption ?? ''}
                maxLength={240}
                placeholder="Descrição breve da imagem ou do vídeo"
                onChange={(event) => setDraft((current) => ({ ...current, media_caption: event.target.value || null }))}
              />
            </Field>
          </div>

          <Field label="Resumo" hint={`${draft.summary.length}/600 caracteres`}>
            <textarea
              value={draft.summary}
              maxLength={600}
              rows={3}
              onChange={(event) => setDraft((current) => ({ ...current, summary: event.target.value }))}
              className="w-full resize-y rounded-md border border-input bg-background p-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>

          <Field label="Conteúdo formatado">
            <MarkdownEditor
              value={draft.content_md}
              onChange={(content_md) => setDraft((current) => ({ ...current, content_md }))}
              minHeightClass="min-h-[280px]"
              showPreview
              placeholder={'## Detalhes\n\n- O que mudou\n- Como usar'}
            />
          </Field>

          <UpdateEmailPreview
            title={draft.title}
            summary={draft.summary}
            slug={draft.slug}
            category={draft.category}
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-border p-4">
          <Button variant="outline" onClick={onCancel} disabled={saving}>Cancelar</Button>
          <Button
            disabled={!valid || saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave({
                  ...draft,
                  title: draft.title.trim(),
                  slug: draft.slug.trim(),
                  summary: draft.summary.trim(),
                  image_url: draft.image_url || null,
                  video_url: draft.video_url || null,
                  media_caption: draft.media_caption || null,
                  published_at: new Date(draft.published_at).toISOString(),
                });
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? 'Salvando…' : initial ? 'Salvar alterações' : 'Criar atualização'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{label}</span>
        {hint && <span className="text-[10px]">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
