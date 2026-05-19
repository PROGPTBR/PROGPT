'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, RefreshCw, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfirmDelete } from '@/components/admin/ConfirmDelete';
import { TemplateEditor, type TemplateDraft } from '@/components/admin/TemplateEditor';

type TemplateRow = {
  id: string;
  assistant_type: 'rfp' | 'kraljic' | 'porter';
  name: string;
  description: string | null;
  body_md: string;
  created_at: string;
  updated_at: string;
};

const ASSISTANT_LABEL: Record<string, string> = {
  rfp: 'RFP',
  kraljic: 'Kraljic',
  porter: 'Porter',
};

export function TemplatesAdmin() {
  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<TemplateRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TemplateRow | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/templates');
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as { templates: TemplateRow[] };
      setRows(data.templates);
    } catch (err) {
      toast.error('Falha ao carregar templates', { description: String(err) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  async function handleSave(draft: TemplateDraft) {
    try {
      const url = editing
        ? `/api/admin/templates/${editing.id}`
        : '/api/admin/templates';
      const method = editing ? 'PATCH' : 'POST';
      // On create we honor the editor's selection; on edit the type
      // is immutable (UI disables the select) and we exclude it from
      // the PATCH body.
      const body = editing
        ? { name: draft.name, description: draft.description, body_md: draft.body_md }
        : draft;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      toast.success(editing ? 'Template atualizado' : 'Template criado');
      setEditorOpen(false);
      setEditing(null);
      await fetchRows();
    } catch (err) {
      toast.error('Falha ao salvar template', { description: String(err) });
    }
  }

  async function handleDelete(row: TemplateRow) {
    try {
      const res = await fetch(`/api/admin/templates/${row.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`status ${res.status}`);
      toast.success('Template removido');
      setConfirmDelete(null);
      await fetchRows();
    } catch (err) {
      toast.error('Falha ao remover', { description: String(err) });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Templates de assistentes</h2>
          <p className="text-xs text-muted-foreground">
            {rows.length} template{rows.length === 1 ? '' : 's'} disponíve{rows.length === 1 ? 'l' : 'is'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchRows}
            disabled={loading}
            title="Atualizar"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setEditorOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Novo template
          </Button>
        </div>
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="w-20">Tipo</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right w-20">Tamanho</TableHead>
              <TableHead className="w-32">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>
                  <span className="text-[10px] rounded px-1.5 py-0.5 bg-primary/10 text-primary uppercase">
                    {ASSISTANT_LABEL[r.assistant_type] ?? r.assistant_type}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground truncate max-w-[420px]">
                  {r.description ?? '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                  {(r.body_md.length / 1024).toFixed(1)} KB
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditing(r);
                        setEditorOpen(true);
                      }}
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setConfirmDelete(r)}
                      title="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                  Nenhum template ainda. Clique em &quot;Novo template&quot; para criar o primeiro.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <TemplateEditor
        open={editorOpen}
        initial={
          editing
            ? {
                assistant_type: editing.assistant_type,
                name: editing.name,
                description: editing.description ?? '',
                body_md: editing.body_md,
              }
            : null
        }
        onCancel={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
      />

      <ConfirmDelete
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title={`Excluir template "${confirmDelete?.name ?? ''}"`}
        description="Esta ação remove o template permanentemente. Runs já gerados continuam acessíveis (output já está persistido no DB)."
        onConfirm={() => {
          if (confirmDelete) void handleDelete(confirmDelete);
        }}
      />
    </div>
  );
}
