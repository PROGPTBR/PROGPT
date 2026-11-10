'use client';

import { useEffect, useState } from 'react';
import { Monitor, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  EMAIL_PREVIEW_OPTIONS,
  type EmailPreviewTemplateId,
} from '@/lib/email/preview-options';
import type { UpdateCategory } from '@/lib/updates/types';

type Props = {
  title: string;
  summary: string;
  slug: string;
  category: UpdateCategory;
};

type Viewport = 'desktop' | 'mobile';

export function UpdateEmailPreview({ title, summary, slug, category }: Props) {
  const [viewport, setViewport] = useState<Viewport>('desktop');
  const [template, setTemplate] = useState<EmailPreviewTemplateId>('update');
  const [html, setHtml] = useState('');
  const [subject, setSubject] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(false);
      try {
        const response = await fetch('/api/admin/updates/email-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          signal: controller.signal,
          body: JSON.stringify({
            template,
            update: {
              title: title.trim() || 'Título da atualização',
              summary: summary.trim() || 'Resumo da atualização para apresentar a novidade aos usuários.',
              slug: slug.trim() || 'nova-atualizacao',
              category,
            },
          }),
        });
        if (!response.ok) throw new Error(`status ${response.status}`);
        const body = (await response.json()) as { html: string; subject: string };
        setHtml(body.html);
        setSubject(body.subject);
      } catch (requestError) {
        if (!(requestError instanceof DOMException && requestError.name === 'AbortError')) {
          setError(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [category, slug, summary, template, title]);

  return (
    <section className="rounded-lg border border-border bg-muted/10">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3">
        <div>
          <h4 className="text-sm font-semibold">Prévia dos e-mails</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Somente visualização. Nenhum e-mail será enviado.
          </p>
        </div>
        <div className="flex rounded-md border border-border bg-background p-1" aria-label="Tamanho da prévia">
          <Button
            type="button"
            size="sm"
            variant={viewport === 'desktop' ? 'secondary' : 'ghost'}
            aria-pressed={viewport === 'desktop'}
            onClick={() => setViewport('desktop')}
            className="h-7 gap-1.5 px-2.5"
          >
            <Monitor className="h-3.5 w-3.5" /> Desktop
          </Button>
          <Button
            type="button"
            size="sm"
            variant={viewport === 'mobile' ? 'secondary' : 'ghost'}
            aria-pressed={viewport === 'mobile'}
            onClick={() => setViewport('mobile')}
            className="h-7 gap-1.5 px-2.5"
          >
            <Smartphone className="h-3.5 w-3.5" /> Celular
          </Button>
        </div>
      </div>

      <div className="grid gap-3 border-b border-border px-4 py-3 sm:grid-cols-[minmax(220px,320px)_1fr] sm:items-end">
        <label className="block text-xs font-medium text-foreground">
          Template
          <select
            value={template}
            onChange={(event) => setTemplate(event.target.value as EmailPreviewTemplateId)}
            className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none focus:ring-2 focus:ring-ring"
          >
            {EMAIL_PREVIEW_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="pb-0.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Assunto:</span>{' '}
          {subject || 'Gerando prévia…'}
        </div>
      </div>

      <div className="overflow-x-auto bg-muted/30 p-4">
        <div
          className="mx-auto overflow-hidden rounded-md border border-border bg-[#050b18] shadow-sm transition-[width] duration-200"
          style={{ width: viewport === 'desktop' ? 620 : 375, maxWidth: '100%' }}
        >
          {loading && !html ? (
            <div className="flex h-[520px] items-center justify-center text-sm text-slate-500">
              Gerando prévia…
            </div>
          ) : error ? (
            <div className="flex h-[260px] items-center justify-center p-6 text-center text-sm text-red-600">
              Não foi possível gerar a prévia.
            </div>
          ) : (
            <iframe
              title={`Prévia do e-mail em ${viewport === 'desktop' ? 'desktop' : 'celular'}`}
              srcDoc={html}
              sandbox=""
              className="block h-[680px] w-full border-0 bg-[#050b18]"
            />
          )}
        </div>
      </div>
    </section>
  );
}
