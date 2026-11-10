'use client';

import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfirmDelete } from '@/components/admin/ConfirmDelete';
import { UpdateEditor } from '@/components/admin/UpdateEditor';
import {
  UPDATE_CATEGORY_LABELS,
  type ProductUpdate,
  type ProductUpdateInput,
} from '@/lib/updates/types';

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
});

export function UpdatesAdmin() {
  const [rows, setRows] = useState<ProductUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState<ProductUpdate | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ProductUpdate | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const response = await fetch('/api/admin/updates', { cache: 'no-store' });
      if (!response.ok) throw new Error(`status ${response.status}`);
      const body = (await response.json()) as { updates: ProductUpdate[] };
      setRows(body.updates);
    } catch (error) {
      setLoadError(true);
      toast.error('Não foi possível carregar as atualizações', { description: String(error) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  async function saveUpdate(input: ProductUpdateInput) {
    const response = await fetch(
      editing ? `/api/admin/updates/${editing.id}` : '/api/admin/updates',
      {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      },
    );

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (response.status === 409 && body.error === 'slug_conflict') {
        toast.error('Este slug já está em uso. Escolha outro.');
        throw new Error('slug_conflict');
      }
      toast.error('Não foi possível salvar a atualização');
      throw new Error(body.error ?? `status ${response.status}`);
    }

    toast.success(editing ? 'Atualização salva' : 'Atualização criada');
    setEditorOpen(false);
    setEditing(null);
    await fetchRows();
  }

  async function removeUpdate(row: ProductUpdate) {
    const response = await fetch(`/api/admin/updates/${row.id}`, { method: 'DELETE' });
    if (!response.ok) {
      toast.error('Não foi possível excluir a atualização');
      return;
    }
    toast.success('Atualização excluída');
    setConfirmDelete(null);
    await fetchRows();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Atualizações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie as novidades exibidas na página pública.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchRows} disabled={loading} title="Atualizar lista">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setEditorOpen(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" /> Nova atualização
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Publicação</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-28">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  Carregando atualizações…
                </TableCell>
              </TableRow>
            )}
            {!loading && loadError && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center">
                  <p className="text-sm text-destructive">Falha ao carregar a lista.</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={fetchRows}>Tentar novamente</Button>
                </TableCell>
              </TableRow>
            )}
            {!loading && !loadError && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  Nenhuma atualização cadastrada. Crie a primeira publicação.
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => {
              const scheduled = row.status === 'published' && new Date(row.published_at).getTime() > Date.now();
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="max-w-md">
                      <div className="font-medium">{row.title}</div>
                      <div className="truncate text-xs text-muted-foreground">/{row.slug}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="rounded bg-primary/10 px-2 py-1 text-xs text-primary">
                      {UPDATE_CATEGORY_LABELS[row.category]}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {dateFormatter.format(new Date(row.published_at))}
                  </TableCell>
                  <TableCell>
                    <span className={`rounded px-2 py-1 text-xs ${row.status === 'published' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                      {scheduled ? 'Agendado' : row.status === 'published' ? 'Publicado' : 'Rascunho'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        title="Editar"
                        onClick={() => {
                          setEditing(row);
                          setEditorOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="destructive" title="Excluir" onClick={() => setConfirmDelete(row)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <UpdateEditor
        open={editorOpen}
        initial={editing}
        onCancel={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
        onSave={saveUpdate}
      />

      <ConfirmDelete
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title={`Excluir "${confirmDelete?.title ?? ''}"?`}
        description="A publicação será removida permanentemente da área pública. Esta ação não pode ser desfeita."
        onConfirm={() => confirmDelete ? removeUpdate(confirmDelete) : undefined}
      />
    </div>
  );
}
