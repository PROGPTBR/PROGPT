import { supabaseBrowser } from '@/lib/db/supabase-browser';
import type { Row, ColumnProfile } from './analyze';
import type { PanelConfig } from './panels';

// Persistência dos dashboards montados pelo usuário. DB-first (tabela
// `dashboards`, RLS owner-only, CRUD pelo browser client como as sessões) com
// FALLBACK em localStorage — assim o recurso funciona mesmo antes de a migration
// 0044 ser aplicada, e "sobe" pro banco automaticamente quando ela estiver lá.

export type SavedDashboardInput = {
  id?: string;
  name: string;
  sourceName: string | null;
  columns: ColumnProfile[];
  rows: Row[];
  panels: PanelConfig[];
};

export type SavedDashboard = SavedDashboardInput & { id: string; updatedAt: string };
export type DashboardListItem = { id: string; name: string; sourceName: string | null; updatedAt: string; local?: boolean };

const LS_KEY = 'progpt_dashboards_v1';
const ROW_CAP = 5000;
const isLocalId = (id: string) => id.startsWith('local_');

// ─── localStorage (fallback) ───────────────────────────────────────────────

function lsAll(): SavedDashboard[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(LS_KEY) || '[]') as SavedDashboard[];
  } catch {
    return [];
  }
}
function lsWrite(all: SavedDashboard[]) {
  window.localStorage.setItem(LS_KEY, JSON.stringify(all));
}
function lsSave(input: SavedDashboardInput): SavedDashboard {
  const all = lsAll();
  const now = new Date().toISOString();
  const id = input.id && isLocalId(input.id) ? input.id : `local_${now}_${Math.floor(performance.now?.() ?? 0)}`;
  const rec: SavedDashboard = { ...input, id, updatedAt: now };
  const idx = all.findIndex((d) => d.id === id);
  if (idx >= 0) all[idx] = rec;
  else all.unshift(rec);
  lsWrite(all);
  return rec;
}

// ─── API pública ────────────────────────────────────────────────────────────

export async function listDashboards(): Promise<DashboardListItem[]> {
  const local = lsAll().map((d) => ({ id: d.id, name: d.name, sourceName: d.sourceName, updatedAt: d.updatedAt, local: true }));
  try {
    const sb = supabaseBrowser();
    const { data, error } = await sb
      .from('dashboards')
      .select('id, name, source_name, updated_at')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    const remote = (data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      name: r.name as string,
      sourceName: (r.source_name as string) ?? null,
      updatedAt: r.updated_at as string,
    }));
    // DB + qualquer coisa que só existe local ainda.
    return [...remote, ...local].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return local;
  }
}

export async function saveDashboard(input: SavedDashboardInput): Promise<SavedDashboard> {
  const rows = input.rows.slice(0, ROW_CAP);
  const clean: SavedDashboardInput = { ...input, rows };
  const payload = {
    name: clean.name,
    source_name: clean.sourceName,
    columns: clean.columns,
    rows,
    panels: clean.panels,
    updated_at: new Date().toISOString(),
  };
  try {
    const sb = supabaseBrowser();
    if (input.id && !isLocalId(input.id)) {
      const { data, error } = await sb.from('dashboards').update(payload).eq('id', input.id).select('id, updated_at').single();
      if (error) throw error;
      return { ...clean, id: (data as { id: string }).id, updatedAt: (data as { updated_at: string }).updated_at };
    }
    const { data, error } = await sb.from('dashboards').insert(payload).select('id, updated_at').single();
    if (error) throw error;
    return { ...clean, id: (data as { id: string }).id, updatedAt: (data as { updated_at: string }).updated_at };
  } catch {
    return lsSave(clean);
  }
}

export async function loadDashboard(id: string): Promise<SavedDashboard | null> {
  if (isLocalId(id)) return lsAll().find((d) => d.id === id) ?? null;
  try {
    const sb = supabaseBrowser();
    const { data, error } = await sb.from('dashboards').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const r = data as Record<string, unknown>;
    return {
      id: r.id as string,
      name: r.name as string,
      sourceName: (r.source_name as string) ?? null,
      columns: (r.columns as ColumnProfile[]) ?? [],
      rows: (r.rows as Row[]) ?? [],
      panels: (r.panels as PanelConfig[]) ?? [],
      updatedAt: r.updated_at as string,
    };
  } catch {
    return lsAll().find((d) => d.id === id) ?? null;
  }
}

export async function deleteDashboard(id: string): Promise<void> {
  if (isLocalId(id)) {
    lsWrite(lsAll().filter((d) => d.id !== id));
    return;
  }
  try {
    const sb = supabaseBrowser();
    const { error } = await sb.from('dashboards').delete().eq('id', id);
    if (error) throw error;
  } catch {
    lsWrite(lsAll().filter((d) => d.id !== id));
  }
}
