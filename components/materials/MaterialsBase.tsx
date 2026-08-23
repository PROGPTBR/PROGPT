'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Package, Pencil, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { useMaterialsBase } from '@/hooks/useMaterialsBase';
import { MaterialsImportDialog } from './MaterialsImportDialog';
import type { SavedMaterial } from '@/lib/materials/base';

// "Minha base de materiais" — Batch L do backlog do diretor (ABC: "precisa
// carregar o banco de dados de materiais do cliente ... e que possa ser
// atualizado"). Espelha components/suppliers/SupplierBase.tsx.

function fmtPreco(preco: number | null, moeda: string | null): string | null {
  if (preco == null) return null;
  return `${moeda ?? 'BRL'} ${preco.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function MaterialsBase() {
  const { materials, loading, addManual, updateMaterial, deleteMaterial, previewImport, applyImport } =
    useMaterialsBase();
  const [q, setQ] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return materials;
    return materials.filter((m) =>
      [m.descricao, m.codigo, m.categoria, m.ncm].filter(Boolean).some((v) => v!.toLowerCase().includes(needle)),
    );
  }, [materials, q]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Minha base de materiais <span className="text-brand">.</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            {materials.length} {materials.length === 1 ? 'material' : 'materiais'} cadastrados ·
            importe da sua planilha ou cadastre à mão.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background hover:bg-accent text-foreground/80 px-5 h-10 text-sm font-medium transition-all duration-300 active:scale-95"
          >
            <Upload className="h-3.5 w-3.5" />
            Importar planilha
          </button>
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/5 hover:bg-brand/10 hover:border-brand/50 text-brand px-5 h-10 text-sm font-medium transition-all duration-300 active:scale-95"
          >
            {showAdd ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {showAdd ? 'Fechar' : 'Adicionar material'}
          </button>
        </div>
      </div>

      <MaterialsImportDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        preview={previewImport}
        onConfirm={applyImport}
      />

      {showAdd && (
        <AddMaterialForm
          onAdd={async (input) => {
            const created = await addManual(input);
            if (created) {
              toast.success('Material adicionado à base');
              setShowAdd(false);
            } else {
              toast.error('Não consegui adicionar. Confira a descrição.');
            }
          }}
        />
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por descrição, código, categoria, NCM…"
            className="w-full h-9 rounded-md bg-background border border-border pl-9 pr-3 text-sm outline-none focus:border-brand/50"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-brand" aria-hidden="true" />
          <p className="text-sm">Carregando sua base…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
          <Package className="h-10 w-10 opacity-40" aria-hidden="true" />
          <p className="text-sm max-w-sm">
            {materials.length === 0
              ? 'Sua base de materiais está vazia. Importe uma planilha ou adicione um material à mão.'
              : 'Nenhum material bate com a busca.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((m) => (
            <MaterialRow
              key={m.id}
              material={m}
              onSave={async (patch) => {
                const ok = await updateMaterial(m.id, patch);
                if (ok) toast.success('Material atualizado');
                else toast.error('Não consegui salvar.');
                return ok;
              }}
              onDelete={() => {
                void deleteMaterial(m.id);
                toast.success('Removido da base');
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MaterialRow({
  material: m,
  onSave,
  onDelete,
}: {
  material: SavedMaterial;
  onSave: (patch: {
    descricao: string;
    categoria: string | null;
    unidade: string | null;
    ncm: string | null;
    fornecedorPadraoCnpj: string | null;
    precoUltimo: number | null;
    moeda: string | null;
  }) => Promise<boolean>;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [descricao, setDescricao] = useState(m.descricao);
  const [categoria, setCategoria] = useState(m.categoria ?? '');
  const [unidade, setUnidade] = useState(m.unidade ?? '');
  const [ncm, setNcm] = useState(m.ncm ?? '');
  const [fornecedorCnpj, setFornecedorCnpj] = useState(m.fornecedorPadraoCnpj ?? '');
  const [preco, setPreco] = useState(m.precoUltimo != null ? String(m.precoUltimo) : '');
  const [moeda, setMoeda] = useState(m.moeda ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!descricao.trim()) return;
    setSaving(true);
    const ok = await onSave({
      descricao: descricao.trim(),
      categoria: categoria.trim() || null,
      unidade: unidade.trim() || null,
      ncm: ncm.trim() || null,
      fornecedorPadraoCnpj: fornecedorCnpj.replace(/\D/g, '') || null,
      precoUltimo: preco.trim() ? Number(preco.replace(',', '.')) : null,
      moeda: moeda.trim().toUpperCase() || null,
    });
    setSaving(false);
    if (ok) setEditing(false);
  }

  const precoLabel = fmtPreco(m.precoUltimo, m.moeda);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 md:p-5 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold tracking-tight text-foreground">{m.descricao}</h3>
            {m.codigo && (
              <span className="text-[10px] text-muted-foreground rounded bg-muted/50 px-1.5 py-0.5 font-mono">
                {m.codigo}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {m.categoria && (
              <span className="inline-flex items-center rounded bg-brand/10 text-brand px-1.5 py-0.5">
                {m.categoria}
              </span>
            )}
            {m.unidade && <span>un.: {m.unidade}</span>}
            {m.ncm && <span className="font-mono">NCM {m.ncm}</span>}
            {precoLabel && <span>{precoLabel}</span>}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            title="Editar"
            aria-label={`Editar ${m.descricao}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Remover da base"
            aria-label={`Remover ${m.descricao}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {editing && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-border">
          <Field label="Descrição" full>
            <input value={descricao} onChange={(e) => setDescricao(e.target.value)} className="editinput" />
          </Field>
          <Field label="Categoria">
            <input value={categoria} onChange={(e) => setCategoria(e.target.value)} className="editinput" />
          </Field>
          <Field label="Unidade">
            <input value={unidade} onChange={(e) => setUnidade(e.target.value)} className="editinput" />
          </Field>
          <Field label="NCM">
            <input value={ncm} onChange={(e) => setNcm(e.target.value)} className="editinput" />
          </Field>
          <Field label="CNPJ fornecedor padrão">
            <input
              value={fornecedorCnpj}
              onChange={(e) => setFornecedorCnpj(e.target.value)}
              className="editinput"
            />
          </Field>
          <Field label="Preço (último)">
            <input value={preco} onChange={(e) => setPreco(e.target.value)} className="editinput" />
          </Field>
          <Field label="Moeda">
            <input value={moeda} onChange={(e) => setMoeda(e.target.value)} maxLength={3} className="editinput" />
          </Field>
          <div className="sm:col-span-2 flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-brand-gradient text-black px-5 h-9 text-sm font-medium hover:brightness-110 active:scale-95 transition-all disabled:opacity-60"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Salvar
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="inline-flex items-center rounded-full border border-border px-5 h-9 text-sm font-medium text-foreground/80 hover:bg-accent transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        :global(.editinput) {
          width: 100%;
          height: 2.25rem;
          border-radius: 0.375rem;
          background: hsl(var(--background));
          border: 1px solid hsl(var(--border));
          padding: 0 0.625rem;
          font-size: 0.8125rem;
          color: hsl(var(--foreground));
          outline: none;
        }
        :global(.editinput:focus) {
          border-color: hsl(var(--brand, 199 89% 48%) / 0.5);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block space-y-1 ${full ? 'sm:col-span-2' : ''}`}>
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function AddMaterialForm({
  onAdd,
}: {
  onAdd: (input: {
    codigo: string | null;
    descricao: string;
    categoria: string | null;
    unidade: string | null;
    ncm: string | null;
  }) => Promise<void>;
}) {
  const [codigo, setCodigo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('');
  const [unidade, setUnidade] = useState('');
  const [ncm, setNcm] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!descricao.trim()) return;
    setBusy(true);
    await onAdd({
      codigo: codigo.trim() || null,
      descricao: descricao.trim(),
      categoria: categoria.trim() || null,
      unidade: unidade.trim() || null,
      ncm: ncm.trim() || null,
    });
    setBusy(false);
    setCodigo('');
    setDescricao('');
    setCategoria('');
    setUnidade('');
    setNcm('');
  }

  return (
    <div className="rounded-2xl border border-brand/30 bg-brand/[0.03] p-4 md:p-5 space-y-3">
      <div className="text-sm font-medium">Novo material</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Descrição *" full>
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} className="editinput2" />
        </Field>
        <Field label="Código / SKU (opcional)">
          <input value={codigo} onChange={(e) => setCodigo(e.target.value)} className="editinput2" />
        </Field>
        <Field label="Categoria">
          <input value={categoria} onChange={(e) => setCategoria(e.target.value)} className="editinput2" />
        </Field>
        <Field label="Unidade">
          <input value={unidade} onChange={(e) => setUnidade(e.target.value)} className="editinput2" />
        </Field>
        <Field label="NCM">
          <input value={ncm} onChange={(e) => setNcm(e.target.value)} className="editinput2" />
        </Field>
      </div>
      <button
        type="button"
        onClick={submit}
        disabled={busy || !descricao.trim()}
        className="inline-flex items-center gap-2 rounded-full bg-brand-gradient text-black px-5 h-9 text-sm font-medium hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
      >
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Adicionar à base
      </button>

      <style jsx>{`
        :global(.editinput2) {
          width: 100%;
          height: 2.25rem;
          border-radius: 0.375rem;
          background: hsl(var(--background));
          border: 1px solid hsl(var(--border));
          padding: 0 0.625rem;
          font-size: 0.8125rem;
          color: hsl(var(--foreground));
          outline: none;
        }
        :global(.editinput2:focus) {
          border-color: hsl(var(--brand, 199 89% 48%) / 0.5);
        }
      `}</style>
    </div>
  );
}
