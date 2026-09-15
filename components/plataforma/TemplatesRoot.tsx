'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// /plataforma/templates — CRUD de plataforma_templates (blueprints de
// config de org, copiados pra orgs.org_settings no provisionamento). Editor
// de `config` é um textarea JSON cru na Fase 1 — sem UI rica por
// sub-tabela como o CRM-2Mimobi tem; evolui quando o schema de config
// estabilizar na prática.

type PlataformaTemplate = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
};

export function TemplatesRoot() {
  const [templates, setTemplates] = useState<PlataformaTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [configText, setConfigText] = useState('{}');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editConfigText, setEditConfigText] = useState('{}');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/plataforma/templates');
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as { templates: PlataformaTemplate[] };
      setTemplates(data.templates);
    } catch (err) {
      toast.error('Falha ao carregar templates', { description: String(err) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2 || slug.trim().length < 2) return;
    let config: Record<string, unknown>;
    try {
      config = JSON.parse(configText || '{}');
    } catch {
      toast.error('Config precisa ser um JSON válido');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/plataforma/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim(),
          config,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(data.error === 'slug_taken' ? 'Slug já em uso' : 'Falha ao criar template');
        return;
      }
      toast.success('Template criado');
      setName('');
      setSlug('');
      setDescription('');
      setConfigText('{}');
      void load();
    } catch (err) {
      toast.error('Falha ao criar template', { description: String(err) });
    } finally {
      setCreating(false);
    }
  }

  function startEdit(t: PlataformaTemplate) {
    setEditingId(t.id);
    setEditConfigText(JSON.stringify(t.config, null, 2));
  }

  async function saveEdit(id: string) {
    let config: Record<string, unknown>;
    try {
      config = JSON.parse(editConfigText || '{}');
    } catch {
      toast.error('Config precisa ser um JSON válido');
      return;
    }
    try {
      const res = await fetch(`/api/plataforma/templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      toast.success('Template atualizado');
      setEditingId(null);
      void load();
    } catch (err) {
      toast.error('Falha ao salvar', { description: String(err) });
    }
  }

  async function remove(id: string) {
    try {
      const res = await fetch(`/api/plataforma/templates/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error(`status ${res.status}`);
      toast.success('Template removido');
      void load();
    } catch (err) {
      toast.error('Falha ao remover', { description: String(err) });
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Templates de Plataforma</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Blueprints de configuração copiados pra uma org no momento do provisionamento (ver
          Operações). Não confundir com a biblioteca de templates de assistente em{' '}
          <code>/admin/templates</code>.
        </p>
      </div>

      <form
        onSubmit={handleCreate}
        className="space-y-3 rounded-md border border-border bg-card p-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium block mb-1">Nome</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Padrão" />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Slug</label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="padrao" />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Descrição</label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Opcional"
          />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Config (JSON)</label>
          <textarea
            value={configText}
            onChange={(e) => setConfigText(e.target.value)}
            className="w-full rounded-md border border-input bg-background p-2 text-xs font-mono min-h-[100px]"
          />
        </div>
        <Button type="submit" disabled={creating || name.trim().length < 2 || slug.trim().length < 2}>
          Criar template
        </Button>
      </form>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div key={t.id} className="rounded-md border border-border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="font-medium text-sm">{t.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.slug} {t.description ? `· ${t.description}` : ''}
                  </div>
                </div>
                <div className="flex gap-2">
                  {editingId === t.id ? (
                    <>
                      <Button size="sm" onClick={() => saveEdit(t.id)}>
                        Salvar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                        Cancelar
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={() => startEdit(t)}>
                        Editar config
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => remove(t.id)}>
                        Remover
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {editingId === t.id ? (
                <textarea
                  value={editConfigText}
                  onChange={(e) => setEditConfigText(e.target.value)}
                  className="w-full rounded-md border border-input bg-background p-2 text-xs font-mono min-h-[120px]"
                />
              ) : (
                <pre className="text-xs bg-background/60 rounded p-2 overflow-x-auto">
                  {JSON.stringify(t.config, null, 2)}
                </pre>
              )}
            </div>
          ))}
          {templates.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum template criado ainda.</p>
          )}
        </div>
      )}
    </div>
  );
}
