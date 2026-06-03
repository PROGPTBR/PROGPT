'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabaseBrowser } from '@/lib/db/supabase-browser';
import type { Prompt } from '@/lib/prompts/types';

type Draft = {
  title: string;
  summary: string;
  content: string;
  category: string;
  tagsText: string;
  is_published: boolean;
};

const EMPTY_DRAFT: Draft = {
  title: '',
  summary: '',
  content: '',
  category: 'Geral',
  tagsText: '',
  is_published: true,
};

function toDraft(p: Prompt): Draft {
  return {
    title: p.title,
    summary: p.summary,
    content: p.content,
    category: p.category,
    tagsText: p.tags.join(', '),
    is_published: p.is_published,
  };
}

function parseTags(text: string): string[] {
  return text
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .slice(0, 30);
}

export function PromptsAdmin() {
  const [rows, setRows] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const sb = supabaseBrowser();
    const { data, error } = await sb
      .from('prompts')
      .select(
        'id, prompt_number, title, summary, content, category, tags, is_published, source, created_at, updated_at',
      )
      .order('category', { ascending: true })
      .order('prompt_number', { ascending: true, nullsFirst: false });
    if (error) {
      toast.error('Falha ao carregar prompts', { description: error.message });
    } else {
      setRows((data ?? []) as Prompt[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [rows, search]);

  function selectRow(p: Prompt) {
    setCreating(false);
    setSelectedId(p.id);
    setDraft(toDraft(p));
  }

  function startCreate() {
    setCreating(true);
    setSelectedId(null);
    setDraft(EMPTY_DRAFT);
  }

  const valid = draft.title.trim().length >= 3 && draft.content.trim().length >= 1;

  async function save() {
    if (!valid) return;
    setSaving(true);
    const payload = {
      title: draft.title.trim(),
      summary: draft.summary.trim(),
      content: draft.content,
      category: draft.category.trim() || 'Geral',
      tags: parseTags(draft.tagsText),
      is_published: draft.is_published,
    };
    try {
      const res = creating
        ? await fetch('/api/admin/prompts', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/admin/prompts/${selectedId}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          });
      if (!res.ok) {
        toast.error('Falha ao salvar', { description: `status ${res.status}` });
        return;
      }
      toast.success(creating ? 'Prompt criado' : 'Prompt atualizado');
      setCreating(false);
      await fetchRows();
      if (creating) {
        const json = (await res.json().catch(() => ({}))) as { id?: string };
        if (json.id) setSelectedId(json.id);
      }
    } catch (err) {
      toast.error('Erro de rede', { description: String(err) });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!selectedId) return;
    if (!confirm('Excluir este prompt? Esta ação não pode ser desfeita.')) return;
    const res = await fetch(`/api/admin/prompts/${selectedId}`, { method: 'DELETE' });
    if (!res.ok) {
      toast.error('Falha ao excluir');
      return;
    }
    toast.success('Prompt excluído');
    setSelectedId(null);
    setDraft(EMPTY_DRAFT);
    await fetchRows();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Prompts</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} prompts · curadoria da Biblioteca de Prompts.
          </p>
        </div>
        <Button size="sm" onClick={startCreate}>
          <Plus className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
          Novo prompt
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_1.4fr] gap-0 rounded-md border border-border overflow-hidden bg-card min-h-[480px]">
        {/* Lista */}
        <div className="border-b md:border-b-0 md:border-r border-border flex flex-col max-h-[680px]">
          <div className="p-2 border-b border-border">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por título, categoria ou tag…"
              className="h-9 text-sm"
            />
          </div>
          <ul className="flex-1 overflow-y-auto divide-y divide-border">
            {loading ? (
              <li className="p-4 text-sm text-muted-foreground">Carregando…</li>
            ) : filtered.length === 0 ? (
              <li className="p-4 text-sm text-muted-foreground">Nenhum prompt.</li>
            ) : (
              filtered.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => selectRow(p)}
                    aria-current={p.id === selectedId ? 'true' : undefined}
                    className={`w-full text-left px-3 py-2.5 transition-colors ${
                      p.id === selectedId ? 'bg-primary/10' : 'hover:bg-accent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate flex-1">
                        {p.title}
                      </span>
                      {!p.is_published && (
                        <span className="text-[10px] rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 px-2 py-0.5 flex-shrink-0">
                          oculto
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {p.category}
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>

        {/* Editor */}
        <div className="p-4 max-h-[680px] overflow-y-auto">
          {!creating && !selectedId ? (
            <div className="h-full flex items-center justify-center text-center">
              <p className="text-sm text-muted-foreground">
                Selecione um prompt ou clique em “Novo prompt”.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <Field label="Título">
                <Input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  maxLength={200}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Categoria">
                  <Input
                    value={draft.category}
                    onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                    maxLength={60}
                  />
                </Field>
                <Field label="Tags (separadas por vírgula)">
                  <Input
                    value={draft.tagsText}
                    onChange={(e) => setDraft({ ...draft, tagsText: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Resumo">
                <Input
                  value={draft.summary}
                  onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
                  maxLength={500}
                />
              </Field>
              <Field label="Conteúdo (o prompt em si)">
                <textarea
                  value={draft.content}
                  onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                  className="w-full min-h-[260px] rounded-md border border-input bg-background p-2 text-sm font-mono outline-none focus:border-brand"
                />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.is_published}
                  onChange={(e) => setDraft({ ...draft, is_published: e.target.checked })}
                />
                Publicado (visível na biblioteca)
              </label>
              <div className="flex items-center gap-2 pt-2">
                <Button onClick={save} disabled={!valid || saving} size="sm">
                  <Save className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                  {creating ? 'Criar' : 'Salvar'}
                </Button>
                {!creating && selectedId && (
                  <Button onClick={remove} variant="outline" size="sm">
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                    Excluir
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium block mb-1">{label}</label>
      {children}
    </div>
  );
}
