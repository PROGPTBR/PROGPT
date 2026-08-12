'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Building2,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useSupplierBase } from '@/hooks/useSupplierBase';
import {
  SUPPLIER_STATUSES,
  SUPPLIER_STATUS_LABEL,
  SUPPLIER_STATUS_STYLE,
  type SavedSupplier,
  type SupplierStatus,
} from '@/lib/suppliers/base';

function formatCnpj(cnpj: string | null): string | null {
  if (!cnpj) return null;
  const d = cnpj.replace(/\D/g, '');
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

export function SupplierBase() {
  const { suppliers, loading, addManual, updateSupplier, deleteSupplier } =
    useSupplierBase();
  const [statusFilter, setStatusFilter] = useState<'all' | SupplierStatus>('all');
  const [q, setQ] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return suppliers.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (!needle) return true;
      return [s.razaoSocial, s.nomeFantasia, s.categoria, s.cnae, s.municipio, s.uf, s.cnpj]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(needle));
    });
  }, [suppliers, statusFilter, q]);

  const counts = useMemo(() => {
    const m = new Map<SupplierStatus, number>();
    for (const s of suppliers) m.set(s.status, (m.get(s.status) ?? 0) + 1);
    return m;
  }, [suppliers]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Minha base de fornecedores <span className="text-brand">.</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            {suppliers.length} {suppliers.length === 1 ? 'fornecedor' : 'fornecedores'} na
            carteira · salve da Busca de Fornecedores ou cadastre à mão.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/5 hover:bg-brand/10 hover:border-brand/50 text-brand px-5 h-10 text-sm font-medium transition-all duration-300 active:scale-95"
        >
          {showAdd ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showAdd ? 'Fechar' : 'Adicionar fornecedor'}
        </button>
      </div>

      {showAdd && (
        <AddSupplierForm
          onAdd={async (input) => {
            const created = await addManual(input);
            if (created) {
              toast.success('Fornecedor adicionado à base');
              setShowAdd(false);
            } else {
              toast.error('Não consegui adicionar. Confira a razão social.');
            }
          }}
        />
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome, categoria, CNAE, cidade…"
            className="w-full h-9 rounded-md bg-background border border-border pl-9 pr-3 text-sm outline-none focus:border-brand/50"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          <FilterChip
            active={statusFilter === 'all'}
            onClick={() => setStatusFilter('all')}
            label={`Todos · ${suppliers.length}`}
          />
          {SUPPLIER_STATUSES.map((st) => {
            const c = counts.get(st) ?? 0;
            if (c === 0) return null;
            return (
              <FilterChip
                key={st}
                active={statusFilter === st}
                onClick={() => setStatusFilter(st)}
                label={`${SUPPLIER_STATUS_LABEL[st]} · ${c}`}
              />
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-brand" aria-hidden="true" />
          <p className="text-sm">Carregando sua base…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
          <Building2 className="h-10 w-10 opacity-40" aria-hidden="true" />
          <p className="text-sm max-w-sm">
            {suppliers.length === 0
              ? 'Sua base está vazia. Vá na Busca de Fornecedores e clique em "Salvar na base", ou adicione um fornecedor à mão aqui.'
              : 'Nenhum fornecedor bate com o filtro.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => (
            <SupplierRow
              key={s.id}
              supplier={s}
              onStatus={(status) => void updateSupplier(s.id, { status })}
              onSave={async (patch) => {
                const ok = await updateSupplier(s.id, patch);
                if (ok) toast.success('Fornecedor atualizado');
                else toast.error('Não consegui salvar.');
                return ok;
              }}
              onDelete={() => {
                void deleteSupplier(s.id);
                toast.success('Removido da base');
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-2.5 h-7 text-xs font-medium transition-all duration-150 active:scale-95 ${
        active
          ? 'bg-brand/10 border border-brand/30 text-brand'
          : 'bg-background border border-border text-foreground/70 hover:bg-accent'
      }`}
    >
      {label}
    </button>
  );
}

function StatusBadge({ status }: { status: SupplierStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium border ${SUPPLIER_STATUS_STYLE[status]}`}
    >
      {SUPPLIER_STATUS_LABEL[status]}
    </span>
  );
}

function SupplierRow({
  supplier: s,
  onStatus,
  onSave,
  onDelete,
}: {
  supplier: SavedSupplier;
  onStatus: (status: SupplierStatus) => void;
  onSave: (patch: {
    categoria: string | null;
    telefone: string | null;
    email: string | null;
    rating: number | null;
    notas: string | null;
  }) => Promise<boolean>;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [categoria, setCategoria] = useState(s.categoria ?? '');
  const [telefone, setTelefone] = useState(s.telefone ?? '');
  const [email, setEmail] = useState(s.email ?? '');
  const [notas, setNotas] = useState(s.notas ?? '');
  const [rating, setRating] = useState<number | null>(s.rating);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const ok = await onSave({
      categoria: categoria.trim() || null,
      telefone: telefone.trim() || null,
      email: email.trim() || null,
      rating,
      notas: notas.trim() || null,
    });
    setSaving(false);
    if (ok) setEditing(false);
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 md:p-5 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              {s.razaoSocial}
            </h3>
            <StatusBadge status={s.status} />
            {s.origem === 'busca' && (
              <span className="text-[10px] text-muted-foreground rounded bg-muted/50 px-1.5 py-0.5">
                da busca
              </span>
            )}
          </div>
          {s.nomeFantasia && s.nomeFantasia !== s.razaoSocial && (
            <div className="text-xs text-muted-foreground">{s.nomeFantasia}</div>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {formatCnpj(s.cnpj) && (
              <span className="font-mono">{formatCnpj(s.cnpj)}</span>
            )}
            {s.cnae && <span className="font-mono">CNAE {s.cnae}</span>}
            {(s.municipio || s.uf) && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" aria-hidden="true" />
                {s.municipio ?? ''}
                {s.municipio && s.uf ? ' · ' : ''}
                {s.uf ?? ''}
              </span>
            )}
            {s.categoria && (
              <span className="inline-flex items-center rounded bg-brand/10 text-brand px-1.5 py-0.5">
                {s.categoria}
              </span>
            )}
            {s.rating != null && <span>★ {s.rating}/5</span>}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label className="sr-only" htmlFor={`status-${s.id}`}>
            Status de {s.razaoSocial}
          </label>
          <select
            id={`status-${s.id}`}
            value={s.status}
            onChange={(e) => onStatus(e.target.value as SupplierStatus)}
            className="h-8 rounded-md bg-background border border-border px-2 text-xs text-foreground outline-none focus:border-brand/50"
          >
            {SUPPLIER_STATUSES.map((st) => (
              <option key={st} value={st}>
                {SUPPLIER_STATUS_LABEL[st]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            title="Editar"
            aria-label={`Editar ${s.razaoSocial}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Remover da base"
            aria-label={`Remover ${s.razaoSocial}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Contatos rápidos (quando não editando) */}
      {!editing && (s.telefone || s.email) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs pt-1 border-t border-border">
          {s.telefone && (
            <a
              href={`tel:${s.telefone.replace(/\D/g, '')}`}
              className="inline-flex items-center gap-1.5 text-foreground hover:text-brand transition-colors"
            >
              <Phone className="h-3 w-3" aria-hidden="true" />
              {s.telefone}
            </a>
          )}
          {s.email && (
            <a
              href={`mailto:${s.email}`}
              className="inline-flex items-center gap-1.5 text-foreground hover:text-brand transition-colors break-all"
            >
              <Mail className="h-3 w-3" aria-hidden="true" />
              {s.email}
            </a>
          )}
        </div>
      )}
      {!editing && s.notas && (
        <p className="text-xs text-muted-foreground whitespace-pre-wrap pt-1 border-t border-border">
          {s.notas}
        </p>
      )}

      {editing && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-border">
          <Field label="Categoria">
            <input
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder="Ex.: Embalagens"
              className="editinput"
            />
          </Field>
          <Field label="Rating (0–5)">
            <select
              value={rating ?? ''}
              onChange={(e) => setRating(e.target.value === '' ? null : Number(e.target.value))}
              className="editinput"
            >
              <option value="">—</option>
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Telefone">
            <input
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className="editinput"
            />
          </Field>
          <Field label="Email">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="editinput"
            />
          </Field>
          <Field label="Notas" full>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder="Anotações internas, condições, contato…"
              className="editinput resize-y"
            />
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
        :global(textarea.editinput) {
          height: auto;
          padding: 0.5rem 0.625rem;
        }
        :global(.editinput:focus) {
          border-color: hsl(var(--brand, 199 89% 48%) / 0.5);
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`block space-y-1 ${full ? 'sm:col-span-2' : ''}`}>
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function AddSupplierForm({
  onAdd,
}: {
  onAdd: (input: {
    razaoSocial: string;
    cnpj: string | null;
    categoria: string | null;
    uf: string | null;
    municipio: string | null;
    telefone: string | null;
    email: string | null;
  }) => Promise<void>;
}) {
  const [razao, setRazao] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [categoria, setCategoria] = useState('');
  const [uf, setUf] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!razao.trim()) return;
    setBusy(true);
    await onAdd({
      razaoSocial: razao.trim(),
      cnpj: cnpj.trim() || null,
      categoria: categoria.trim() || null,
      uf: uf.trim().toUpperCase().slice(0, 2) || null,
      municipio: municipio.trim() || null,
      telefone: telefone.trim() || null,
      email: email.trim() || null,
    });
    setBusy(false);
    setRazao('');
    setCnpj('');
    setCategoria('');
    setUf('');
    setMunicipio('');
    setTelefone('');
    setEmail('');
  }

  return (
    <div className="rounded-2xl border border-brand/30 bg-brand/[0.03] p-4 md:p-5 space-y-3">
      <div className="text-sm font-medium">Novo fornecedor</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Razão social / nome *">
          <input value={razao} onChange={(e) => setRazao(e.target.value)} className="editinput2" />
        </Field>
        <Field label="CNPJ (opcional)">
          <input value={cnpj} onChange={(e) => setCnpj(e.target.value)} className="editinput2" />
        </Field>
        <Field label="Categoria">
          <input value={categoria} onChange={(e) => setCategoria(e.target.value)} className="editinput2" />
        </Field>
        <div className="grid grid-cols-[4rem_1fr] gap-2">
          <Field label="UF">
            <input value={uf} onChange={(e) => setUf(e.target.value)} maxLength={2} className="editinput2" />
          </Field>
          <Field label="Município">
            <input value={municipio} onChange={(e) => setMunicipio(e.target.value)} className="editinput2" />
          </Field>
        </div>
        <Field label="Telefone">
          <input value={telefone} onChange={(e) => setTelefone(e.target.value)} className="editinput2" />
        </Field>
        <Field label="Email">
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="editinput2" />
        </Field>
      </div>
      <button
        type="button"
        onClick={submit}
        disabled={busy || !razao.trim()}
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
