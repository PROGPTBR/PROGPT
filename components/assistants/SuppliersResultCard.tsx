'use client';

import { useState } from 'react';
import {
  Building2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Mail,
  MapPin,
  Phone,
  Users,
} from 'lucide-react';
import type { GroupedSupplier, SupplierResult } from '@/lib/suppliers/types';

type Props = {
  group: GroupedSupplier;
};

function formatCnpj(cnpj: string): string {
  const d = cnpj.replace(/\D/g, '');
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

function formatCnpjBasico(b: string): string {
  if (b.length !== 8) return b;
  return `${b.slice(0, 2)}.${b.slice(2, 5)}.${b.slice(5, 8)}`;
}

function formatCapital(v: number | null): string | null {
  if (v === null || !Number.isFinite(v)) return null;
  if (v >= 1_000_000)
    return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}M`;
  if (v >= 1000)
    return `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}k`;
  return `R$ ${v.toLocaleString('pt-BR')}`;
}

const PORTE_LABEL: Record<string, string> = {
  ME: 'Micro',
  EPP: 'Pequena',
  DEMAIS: 'Média/Grande',
};

const MAX_CNAE_BADGES = 4;

function pickMatriz(units: SupplierResult[]): SupplierResult {
  // CNPJ ordem '0001' identifica a matriz formal; se não existir no
  // resultset (matriz pode ter CNAE diferente e não bater no filtro),
  // pega a unidade com maior capital social.
  const matriz = units.find((u) => u.cnpj.slice(8, 12) === '0001');
  if (matriz) return matriz;
  return [...units].sort(
    (a, b) => (b.capital_social ?? 0) - (a.capital_social ?? 0),
  )[0]!;
}

function collectCnaes(units: SupplierResult[]): string[] {
  const set = new Set<string>();
  for (const u of units) {
    if (u.cnae_primario) set.add(u.cnae_primario);
    for (const c of u.cnaes_secundarios ?? []) set.add(c);
  }
  return Array.from(set);
}

function collectUfs(units: SupplierResult[]): string[] {
  const set = new Set<string>();
  for (const u of units) {
    if (u.uf) set.add(u.uf);
  }
  return Array.from(set).sort();
}

export function SuppliersResultCard({ group }: Props) {
  const [expanded, setExpanded] = useState(false);

  const matriz = pickMatriz(group.units);
  const allCnaes = collectCnaes(group.units);
  const ufs = collectUfs(group.units);
  const isMultiUnit = group.units.length > 1;

  const cap = formatCapital(matriz.capital_social);
  const googleQuery = encodeURIComponent(
    `${matriz.razao_social} ${matriz.municipio ?? ''} ${matriz.uf ?? ''}`,
  );

  return (
    <div className="group flex flex-col rounded-2xl border border-border bg-card hover:border-brand/30 transition-all duration-300 p-5 space-y-3">
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold tracking-tight text-foreground line-clamp-2 leading-snug">
            {matriz.razao_social}
          </h3>
          {matriz.porte && (
            <span className="shrink-0 rounded-full bg-brand/10 border border-brand/30 px-2 py-0.5 text-[10px] font-medium text-brand">
              {PORTE_LABEL[matriz.porte] ?? matriz.porte}
            </span>
          )}
        </div>
        {matriz.nome_fantasia &&
          matriz.nome_fantasia !== matriz.razao_social && (
            <div className="text-xs text-muted-foreground line-clamp-1">
              {matriz.nome_fantasia}
            </div>
          )}
        <div className="text-[11px] font-mono text-muted-foreground">
          CNPJ base {formatCnpjBasico(group.cnpjBasico)}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {allCnaes.slice(0, MAX_CNAE_BADGES).map((c, idx) => (
          <span
            key={c}
            className={`rounded-md px-2 py-0.5 text-[10px] font-mono ${
              idx === 0
                ? 'bg-brand/10 text-brand'
                : 'bg-muted/40 text-foreground/70'
            }`}
            title={idx === 0 ? 'CNAE primário (matriz)' : 'CNAE secundário'}
          >
            {c}
          </span>
        ))}
        {allCnaes.length > MAX_CNAE_BADGES && (
          <span className="text-[10px] text-muted-foreground self-center">
            +{allCnaes.length - MAX_CNAE_BADGES}
          </span>
        )}
      </div>

      <div className="space-y-1.5 text-xs">
        {ufs.length > 0 && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
            <span>
              {isMultiUnit
                ? `${group.units.length} unidades · ${ufs.join(', ')}`
                : `${matriz.municipio ?? ''}${matriz.municipio && matriz.uf ? ' · ' : ''}${matriz.uf ?? ''}`}
            </span>
          </div>
        )}
        {matriz.faixa_funcionarios && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
            <span>{matriz.faixa_funcionarios} funcionários</span>
          </div>
        )}
        {cap && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Building2 className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
            <span>Capital social {cap}</span>
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-border space-y-1.5">
        {matriz.telefone ? (
          <a
            href={`tel:${matriz.telefone.replace(/\D/g, '')}`}
            className="flex items-center gap-1.5 text-xs text-foreground hover:text-brand transition-colors"
          >
            <Phone className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
            <span>{matriz.telefone}</span>
          </a>
        ) : null}
        {matriz.email ? (
          <a
            href={`mailto:${matriz.email}`}
            className="flex items-center gap-1.5 text-xs text-foreground hover:text-brand transition-colors break-all"
          >
            <Mail className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
            <span>{matriz.email}</span>
          </a>
        ) : null}
        {!matriz.telefone && !matriz.email && (
          <a
            href={`https://www.google.com/search?q=${googleQuery}`}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-brand transition-colors"
          >
            <ExternalLink className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
            Buscar contato no Google
          </a>
        )}
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border bg-background hover:bg-accent hover:border-brand/30 h-8 px-3 text-xs font-medium text-foreground/80 transition-all duration-200 active:scale-95 self-start"
      >
        {expanded ? (
          <>
            <ChevronUp className="h-3 w-3" aria-hidden="true" />
            Ocultar detalhes
          </>
        ) : (
          <>
            <ChevronDown className="h-3 w-3" aria-hidden="true" />
            Detalhes
            {isMultiUnit ? ` · ${group.units.length} unidades` : ''}
            {allCnaes.length > MAX_CNAE_BADGES
              ? ` · ${allCnaes.length} CNAEs`
              : ''}
          </>
        )}
      </button>

      {expanded && (
        <div className="space-y-3 pt-2 border-t border-border">
          {isMultiUnit && (
            <div className="space-y-2">
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Unidades / Filiais
              </div>
              <div className="space-y-2">
                {group.units.map((u) => (
                  <UnitRow key={u.cnpj} unit={u} />
                ))}
              </div>
            </div>
          )}
          {!isMultiUnit && (
            <div className="space-y-2">
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                CNPJ
              </div>
              <div className="text-[11px] font-mono text-foreground">
                {formatCnpj(matriz.cnpj)}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Todos os CNAEs registrados ({allCnaes.length})
            </div>
            <div className="flex flex-wrap gap-1">
              {allCnaes.map((c) => (
                <span
                  key={c}
                  className="rounded-md bg-muted/40 px-2 py-0.5 text-[10px] font-mono text-foreground/80"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UnitRow({ unit }: { unit: SupplierResult }) {
  const isMatriz = unit.cnpj.slice(8, 12) === '0001';
  return (
    <div className="rounded-lg border border-border bg-background/40 p-2.5 space-y-1">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-[11px] font-mono text-foreground">
          {formatCnpj(unit.cnpj)}
        </div>
        {isMatriz && (
          <span className="rounded-full bg-brand/10 border border-brand/30 px-1.5 py-0.5 text-[9px] font-medium text-brand uppercase tracking-wider">
            Matriz
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
        <span>
          {unit.municipio ?? ''}
          {unit.municipio && unit.uf ? ' · ' : ''}
          {unit.uf ?? ''}
        </span>
        {unit.cnae_primario && (
          <span className="font-mono text-foreground/70">
            {unit.cnae_primario}
          </span>
        )}
      </div>
      {(unit.telefone || unit.email) && (
        <div className="flex items-center gap-3 text-[11px] flex-wrap">
          {unit.telefone && (
            <a
              href={`tel:${unit.telefone.replace(/\D/g, '')}`}
              className="inline-flex items-center gap-1 text-foreground/80 hover:text-brand"
            >
              <Phone className="h-2.5 w-2.5" aria-hidden="true" />
              {unit.telefone}
            </a>
          )}
          {unit.email && (
            <a
              href={`mailto:${unit.email}`}
              className="inline-flex items-center gap-1 text-foreground/80 hover:text-brand break-all"
            >
              <Mail className="h-2.5 w-2.5" aria-hidden="true" />
              {unit.email}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
