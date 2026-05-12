'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowRight, ArrowDown, ArrowUp, GitMerge, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type ThemeRow = {
  theme: string;
  status: 'canonical' | 'candidate';
  count: number;
  inConstant: boolean;
};

export function ThemesAdmin() {
  const [rows, setRows] = useState<ThemeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [renameSource, setRenameSource] = useState<ThemeRow | null>(null);
  const [renameTarget, setRenameTarget] = useState('');
  const [mergeSource, setMergeSource] = useState<ThemeRow | null>(null);
  const [mergeTarget, setMergeTarget] = useState('');
  const [acting, setActing] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/themes');
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as { themes: ThemeRow[] };
      setRows(data.themes);
    } catch (err) {
      toast.error('Falha ao carregar temas', { description: String(err) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const totals = useMemo(() => {
    let canonical = 0;
    let candidate = 0;
    let articles = 0;
    let emptyCanonical = 0;
    for (const r of rows) {
      articles += r.count;
      if (r.status === 'canonical') {
        canonical++;
        if (r.count === 0) emptyCanonical++;
      } else candidate++;
    }
    return { canonical, candidate, articles, emptyCanonical };
  }, [rows]);

  async function handlePromote(theme: string) {
    setActing(true);
    try {
      const res = await fetch('/api/admin/themes/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as { promoted?: number };
      toast.success(`Promovido a canônico — ${data.promoted ?? 0} artigos`);
      await fetchRows();
    } catch (err) {
      toast.error('Falha ao promover', { description: String(err) });
    } finally {
      setActing(false);
    }
  }

  async function handleDemote(theme: string) {
    setActing(true);
    try {
      const res = await fetch('/api/admin/themes/demote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { detail?: string };
        throw new Error(data.detail ?? `status ${res.status}`);
      }
      const data = (await res.json()) as { demoted?: number };
      toast.success(`Demovido para candidato — ${data.demoted ?? 0} artigos`);
      await fetchRows();
    } catch (err) {
      toast.error('Falha ao demover', { description: String(err) });
    } finally {
      setActing(false);
    }
  }

  async function callRename(from: string, to: string, verb: 'mesclado' | 'renomeado') {
    setActing(true);
    try {
      const res = await fetch('/api/admin/themes/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          detail?: string;
          error?: string;
        };
        throw new Error(data.detail ?? data.error ?? `status ${res.status}`);
      }
      const data = (await res.json()) as { moved?: number; newStatus?: string };
      toast.success(
        `Tema ${verb} → "${to}" — ${data.moved ?? 0} artigos · status ${data.newStatus}`,
      );
      await fetchRows();
      return true;
    } catch (err) {
      toast.error('Falha ao atualizar tema', { description: String(err) });
      return false;
    } finally {
      setActing(false);
    }
  }

  async function handleRename() {
    if (!renameSource) return;
    const target = renameTarget.trim();
    if (target.length === 0 || target === renameSource.theme) {
      setRenameSource(null);
      return;
    }
    // If the typed target collides with an existing populated theme, surface
    // it as "mesclado" — same operation, accurate verb in the toast.
    const collision = rows.find((r) => r.theme === target && r.theme !== renameSource.theme);
    const verb = collision && collision.count > 0 ? 'mesclado' : 'renomeado';
    const ok = await callRename(renameSource.theme, target, verb);
    if (ok) {
      setRenameSource(null);
      setRenameTarget('');
    }
  }

  async function handleMerge() {
    if (!mergeSource || !mergeTarget) return;
    if (mergeTarget === mergeSource.theme) {
      setMergeSource(null);
      return;
    }
    const ok = await callRename(mergeSource.theme, mergeTarget, 'mesclado');
    if (ok) {
      setMergeSource(null);
      setMergeTarget('');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Temas</h2>
          <p className="text-xs text-muted-foreground">
            {totals.canonical} canônicos · {totals.candidate} candidatos · {totals.articles} artigos
            {totals.emptyCanonical > 0 && ` · ${totals.emptyCanonical} canônicos vazios`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchRows} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tema</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="text-right w-20">Artigos</TableHead>
              <TableHead className="w-[360px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.theme}>
                <TableCell className="font-medium">
                  {r.theme}
                  {r.inConstant && (
                    <span
                      className="ml-2 text-[10px] rounded px-1 py-0.5 bg-muted text-muted-foreground"
                      title="Faz parte de CANONICAL_THEMES — protegido contra demote"
                    >
                      no constant
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {r.status === 'canonical' ? (
                    <span className="text-[10px] rounded px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200">
                      canônico
                    </span>
                  ) : (
                    <span className="text-[10px] rounded px-1.5 py-0.5 bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200">
                      candidato
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm">{r.count}</TableCell>
                <TableCell>
                  <div className="flex gap-1.5 flex-wrap">
                    {r.count > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={acting}
                        onClick={() => {
                          setMergeSource(r);
                          setMergeTarget('');
                        }}
                        title="Mesclar com tema existente (escolher do dropdown)"
                      >
                        <GitMerge className="h-3.5 w-3.5 mr-1" />
                        Mesclar
                      </Button>
                    )}
                    {r.count > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={acting}
                        onClick={() => {
                          setRenameSource(r);
                          setRenameTarget('');
                        }}
                        title="Renomear para um nome NOVO (texto livre)"
                      >
                        <ArrowRight className="h-3.5 w-3.5 mr-1" />
                        Renomear
                      </Button>
                    )}
                    {r.status === 'candidate' && r.count > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={acting}
                        onClick={() => handlePromote(r.theme)}
                        title="Marcar como canônico"
                      >
                        <ArrowUp className="h-3.5 w-3.5 mr-1" />
                        Promover
                      </Button>
                    )}
                    {r.status === 'canonical' && !r.inConstant && r.count > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={acting}
                        onClick={() => handleDemote(r.theme)}
                        title="Voltar para candidato"
                      >
                        <ArrowDown className="h-3.5 w-3.5 mr-1" />
                        Demover
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {renameSource && (
        <RenameMergeModal
          source={renameSource}
          allRows={rows}
          target={renameTarget}
          onTargetChange={setRenameTarget}
          onCancel={() => {
            setRenameSource(null);
            setRenameTarget('');
          }}
          onConfirm={handleRename}
          busy={acting}
        />
      )}

      {mergeSource && (
        <MergeWithExistingModal
          source={mergeSource}
          allRows={rows}
          target={mergeTarget}
          onTargetChange={setMergeTarget}
          onCancel={() => {
            setMergeSource(null);
            setMergeTarget('');
          }}
          onConfirm={handleMerge}
          busy={acting}
        />
      )}
    </div>
  );
}

function RenameMergeModal({
  source,
  allRows,
  target,
  onTargetChange,
  onCancel,
  onConfirm,
  busy,
}: {
  source: ThemeRow;
  allRows: ThemeRow[];
  target: string;
  onTargetChange: (s: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  const trimmed = target.trim();
  const collision = allRows.find((r) => r.theme === trimmed && r.theme !== source.theme);
  const intent: 'noop' | 'rename' | 'merge' = !trimmed
    ? 'noop'
    : trimmed === source.theme
      ? 'noop'
      : collision
        ? 'merge'
        : 'rename';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-card border border-border shadow-xl">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold">Renomear tema</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Mover os {source.count} artigos de <strong>{source.theme}</strong> para um nome novo
            (ou um existente).
          </p>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Novo nome do tema</label>
            <Input
              autoFocus
              value={target}
              onChange={(e) => onTargetChange(e.target.value)}
              placeholder="Ex: Gestão da Cadeia de Suprimentos"
            />
          </div>
          <div className="text-xs">
            {intent === 'noop' && (
              <span className="text-muted-foreground">
                Digite um nome diferente para prosseguir.
              </span>
            )}
            {intent === 'rename' && (
              <span className="text-emerald-700 dark:text-emerald-300">
                ✓ Cria o tema <strong>{trimmed}</strong> (novo) movendo todos os artigos.
              </span>
            )}
            {intent === 'merge' && collision && (
              <span className="text-amber-700 dark:text-amber-300">
                ⚠ Mescla com tema existente <strong>{trimmed}</strong> ({collision.count}{' '}
                artigos · {collision.status}). Após a ação, ambos terão{' '}
                {collision.count + source.count} artigos sob esse nome.
              </span>
            )}
          </div>
          <div className="rounded bg-muted/50 p-2 text-[11px] text-muted-foreground">
            Status final será derivado server-side: <em>canônico</em> se o novo nome estiver em
            CANONICAL_THEMES, senão <em>candidato</em>.
          </div>
        </div>
        <div className="p-4 border-t border-border flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={busy || intent === 'noop'}>
            {intent === 'merge' ? 'Mesclar' : 'Renomear'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MergeWithExistingModal({
  source,
  allRows,
  target,
  onTargetChange,
  onCancel,
  onConfirm,
  busy,
}: {
  source: ThemeRow;
  allRows: ThemeRow[];
  target: string;
  onTargetChange: (s: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  // Build dropdown groups: canonical first (constant alphabetical, then non-
  // constant by count), then candidates with count > 0. Source is excluded
  // (can't merge into self).
  const canonicalConstant = allRows
    .filter((r) => r.theme !== source.theme && r.inConstant)
    .sort((a, b) => a.theme.localeCompare(b.theme, 'pt-BR'));
  const canonicalExtra = allRows
    .filter((r) => r.theme !== source.theme && r.status === 'canonical' && !r.inConstant)
    .sort((a, b) => b.count - a.count);
  const candidates = allRows
    .filter((r) => r.theme !== source.theme && r.status === 'candidate' && r.count > 0)
    .sort((a, b) => b.count - a.count);

  const targetRow = allRows.find((r) => r.theme === target);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-card border border-border shadow-xl">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold">Mesclar com tema existente</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Mover os {source.count} artigos de <strong>{source.theme}</strong> para um tema já
            existente.
          </p>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label
              htmlFor="merge-target"
              className="text-xs text-muted-foreground block mb-1"
            >
              Tema de destino
            </label>
            <select
              id="merge-target"
              autoFocus
              value={target}
              onChange={(e) => onTargetChange(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">— escolha um tema —</option>
              {canonicalConstant.length > 0 && (
                <optgroup label="Canônicos (no constant)">
                  {canonicalConstant.map((r) => (
                    <option key={r.theme} value={r.theme}>
                      {r.theme} {r.count > 0 ? `(${r.count})` : '(vazio)'}
                    </option>
                  ))}
                </optgroup>
              )}
              {canonicalExtra.length > 0 && (
                <optgroup label="Canônicos extras">
                  {canonicalExtra.map((r) => (
                    <option key={r.theme} value={r.theme}>
                      {r.theme} ({r.count})
                    </option>
                  ))}
                </optgroup>
              )}
              {candidates.length > 0 && (
                <optgroup label="Candidatos">
                  {candidates.map((r) => (
                    <option key={r.theme} value={r.theme}>
                      {r.theme} ({r.count})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          {targetRow && (
            <div className="text-xs">
              <span className="text-amber-700 dark:text-amber-300">
                ⚠ Mescla com tema <strong>{targetRow.theme}</strong> ({targetRow.count} artigos ·{' '}
                {targetRow.status}). Após a ação, {targetRow.count + source.count} artigos ficarão
                sob esse nome.
              </span>
            </div>
          )}
          <div className="rounded bg-muted/50 p-2 text-[11px] text-muted-foreground">
            Status do destino é preservado (canônico continua canônico). Apenas os artigos do
            tema origem são movidos.
          </div>
        </div>
        <div className="p-4 border-t border-border flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={busy || !target}>
            Mesclar
          </Button>
        </div>
      </div>
    </div>
  );
}
