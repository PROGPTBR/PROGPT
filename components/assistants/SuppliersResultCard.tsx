'use client';

import { Building2, ExternalLink, Mail, MapPin, Phone, Users } from 'lucide-react';
import type { SupplierResult } from '@/lib/suppliers/types';

type Props = {
  supplier: SupplierResult;
};

function formatCnpj(cnpj: string): string {
  const d = cnpj.replace(/\D/g, '');
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
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

export function SuppliersResultCard({ supplier: s }: Props) {
  const cap = formatCapital(s.capital_social);
  const googleQuery = encodeURIComponent(
    `${s.razao_social} ${s.municipio ?? ''} ${s.uf ?? ''}`,
  );

  return (
    <div className="group flex flex-col rounded-2xl border border-border bg-card hover:bg-accent/30 hover:border-brand/30 transition-all duration-300 p-5 space-y-3">
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold tracking-tight text-foreground line-clamp-2 leading-snug">
            {s.razao_social}
          </h3>
          {s.porte && (
            <span className="shrink-0 rounded-full bg-brand/10 border border-brand/30 px-2 py-0.5 text-[10px] font-medium text-brand">
              {PORTE_LABEL[s.porte] ?? s.porte}
            </span>
          )}
        </div>
        {s.nome_fantasia && s.nome_fantasia !== s.razao_social && (
          <div className="text-xs text-muted-foreground line-clamp-1">
            {s.nome_fantasia}
          </div>
        )}
        <div className="text-[11px] font-mono text-muted-foreground">
          {formatCnpj(s.cnpj)}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {s.cnae_primario && (
          <span
            className="rounded-md bg-muted/60 px-2 py-0.5 text-[10px] font-mono text-foreground/80"
            title="CNAE primário"
          >
            {s.cnae_primario}
          </span>
        )}
        {(s.cnaes_secundarios ?? []).slice(0, 2).map((c) => (
          <span
            key={c}
            className="rounded-md bg-muted/30 px-2 py-0.5 text-[10px] font-mono text-muted-foreground"
            title="CNAE secundário"
          >
            {c}
          </span>
        ))}
        {(s.cnaes_secundarios?.length ?? 0) > 2 && (
          <span className="text-[10px] text-muted-foreground">
            +{(s.cnaes_secundarios?.length ?? 0) - 2}
          </span>
        )}
      </div>

      <div className="space-y-1.5 text-xs">
        {(s.municipio || s.uf) && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
            <span>
              {[s.municipio, s.uf].filter(Boolean).join(' · ')}
            </span>
          </div>
        )}
        {s.faixa_funcionarios && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
            <span>{s.faixa_funcionarios} funcionários</span>
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
        {s.telefone ? (
          <a
            href={`tel:${s.telefone.replace(/\D/g, '')}`}
            className="flex items-center gap-1.5 text-xs text-foreground hover:text-brand transition-colors"
          >
            <Phone className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
            <span>{s.telefone}</span>
          </a>
        ) : null}
        {s.email ? (
          <a
            href={`mailto:${s.email}`}
            className="flex items-center gap-1.5 text-xs text-foreground hover:text-brand transition-colors break-all"
          >
            <Mail className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
            <span>{s.email}</span>
          </a>
        ) : null}
        {!s.telefone && !s.email && (
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
    </div>
  );
}
