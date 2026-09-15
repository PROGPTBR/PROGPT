'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// /plataforma/operacoes — CRUD de orgs (tenants) + atribuição de template.
// Fase 1 (fundação "Plataforma"): sem RLS org-scoped nas tabelas de domínio
// ainda — este console só gerencia a linha em `orgs` + o snapshot em
// `orgs.org_settings` copiado de `plataforma_templates.config`.

type Org = {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'inactive';
  template_id: string | null;
  org_settings: Record<string, unknown>;
  created_at: string;
  userCount: number;
};

type PlataformaTemplate = { id: string; name: string; slug: string };

export function OperacoesRoot() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [templates, setTemplates] = useState<PlataformaTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [orgsRes, templatesRes] = await Promise.all([
        fetch('/api/plataforma/orgs'),
        fetch('/api/plataforma/templates'),
      ]);
      if (orgsRes.ok) {
        const data = (await orgsRes.json()) as { orgs: Org[] };
        setOrgs(data.orgs);
      }
      if (templatesRes.ok) {
        const data = (await templatesRes.json()) as { templates: PlataformaTemplate[] };
        setTemplates(data.templates);
      }
    } catch (err) {
      toast.error('Falha ao carregar orgs', { description: String(err) });
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
    setCreating(true);
    try {
      const res = await fetch('/api/plataforma/orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          templateId: templateId || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(
          data.error === 'slug_taken' ? 'Slug já em uso' : 'Falha ao criar org',
        );
        return;
      }
      toast.success('Org criada');
      setName('');
      setSlug('');
      setTemplateId('');
      void load();
    } catch (err) {
      toast.error('Falha ao criar org', { description: String(err) });
    } finally {
      setCreating(false);
    }
  }

  async function toggleStatus(org: Org) {
    const next = org.status === 'active' ? 'inactive' : 'active';
    try {
      const res = await fetch(`/api/plataforma/orgs/${org.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setOrgs((prev) => prev.map((o) => (o.id === org.id ? { ...o, status: next } : o)));
    } catch (err) {
      toast.error('Falha ao atualizar org', { description: String(err) });
    }
  }

  async function assignTemplate(org: Org, tId: string) {
    if (!tId) return;
    try {
      const res = await fetch(`/api/plataforma/orgs/${org.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: tId }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      toast.success('Template atribuído');
      void load();
    } catch (err) {
      toast.error('Falha ao atribuir template', { description: String(err) });
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Operações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Orgs (tenants) da plataforma PROGPT. Cada org é isolada por usuário via{' '}
          <code>profiles.org_id</code> — a Fase 2 estende isso pra dados compartilhados por org.
        </p>
      </div>

      <form
        onSubmit={handleCreate}
        className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-card p-4"
      >
        <div>
          <label className="text-xs font-medium block mb-1">Nome</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Cliente X" />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Slug</label>
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="cliente-x" />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Template (opcional)</label>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="rounded-md border border-input bg-background p-2 text-sm h-9"
          >
            <option value="">Nenhum</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={creating || name.trim().length < 2 || slug.trim().length < 2}>
          Criar org
        </Button>
      </form>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Usuários</TableHead>
              <TableHead>Template</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {orgs.map((org) => (
              <TableRow key={org.id}>
                <TableCell className="font-medium">{org.name}</TableCell>
                <TableCell className="text-muted-foreground">{org.slug}</TableCell>
                <TableCell>
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                      org.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {org.status === 'active' ? 'Ativa' : 'Inativa'}
                  </span>
                </TableCell>
                <TableCell>{org.userCount}</TableCell>
                <TableCell>
                  <select
                    value={org.template_id ?? ''}
                    onChange={(e) => assignTemplate(org, e.target.value)}
                    className="rounded-md border border-input bg-background p-1.5 text-xs"
                  >
                    <option value="">Sem template</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" onClick={() => toggleStatus(org)}>
                    {org.status === 'active' ? 'Desativar' : 'Ativar'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
