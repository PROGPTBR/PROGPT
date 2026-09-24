'use client';

import { useState } from 'react';

import {
  Banknote,
  Building2,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileWarning,
  FolderPlus,
  FolderCheck,
  Landmark,
  Mail,
  MapPin,
  Phone,
  ShieldAlert,
  Star,
  Users,
} from 'lucide-react';

import type {
  GroupedSupplier,
  SupplierResult,
} from '@/lib/suppliers/types';

import type {
  SupplierEnrichment,
} from '@/lib/suppliers/enrichment';

import {
  certidoesLinks,
} from '@/lib/assistants/certidoes-links';

import {
  isPrimaryActivity,
  yearsInMarket,
} from '@/lib/suppliers/ranking';

// ============================================================
// PROPS
// ============================================================

type Props = {
  group: GroupedSupplier;

  /** CNAE que originou a busca — pra badge "atividade principal/secundária". */
  cnae: string;

  enrichment?: SupplierEnrichment;

  /** Já está na "Minha base de fornecedores"? */
  savedToBase?: boolean;

  /** Salvar este fornecedor na base. */
  onSaveToBase?: () => void;
};

// ============================================================
// RISCO
// ============================================================

const RISK_LABEL: Record<
  string,
  string
> = {
  baixo: 'baixo',
  medio: 'médio',
  alto: 'alto',
  critico: 'crítico',
};

// ============================================================
// SELOS DAS BASES DO GOVERNO
// ============================================================

function EnrichmentSelos({
  enrichment,
}: {
  enrichment?: SupplierEnrichment;
}) {
  if (!enrichment) {
    return null;
  }

  const {
    fiscal,
    historico,
    sancoes,
  } = enrichment;

  if (
    !fiscal.available &&
    !historico.consultado &&
    !sancoes.temSancao
  ) {
    return null;
  }

  const ativa =
    fiscal.situacao === 'ATIVA';

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* SANÇÕES */}

      {sancoes.temSancao && (
        <span
          className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold border bg-red-600/10 border-red-600/40 text-red-600 dark:text-red-400"
          title={`Sanção ativa no CEIS/CNEP (Portal da Transparência) — ${sancoes.total} registro${
            sancoes.total === 1
              ? ''
              : 's'
          }`}
        >
          <ShieldAlert
            className="h-2.5 w-2.5"
            aria-hidden="true"
          />

          ⛔ Sanção CEIS/CNEP
        </span>
      )}

      {/* SITUAÇÃO FISCAL */}

      {fiscal.available && (
        <span
          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium border ${
            ativa
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
          }`}
          title="Situação cadastral na Receita"
        >
          {fiscal.situacao ??
            '—'}
        </span>
      )}

      {/* RISCO */}

      {fiscal.available &&
        fiscal.score != null && (
          <span
            className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium bg-muted/60 border border-border text-foreground/80"
            title="Score de risco fiscal"
          >
            risco{' '}
            {RISK_LABEL[
              fiscal.risco ?? ''
            ] ?? fiscal.risco}{' '}
            · {fiscal.score}/100
          </span>
        )}

      {/* GOVERNO */}

      {historico.consultado &&
        historico.forneceAoGoverno && (
          <span
            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium border bg-brand/10 border-brand/30 text-brand"
            title={`${historico.totalItens} contrato(s) público(s) nos últimos ${historico.periodoMeses} meses (Compras.gov.br/PNCP)${
              historico.ufs.length >
              0
                ? ` · ${historico.ufs.join(
                    ', ',
                  )}`
                : ''
            }`}
          >
            <Landmark
              className="h-2.5 w-2.5"
              aria-hidden="true"
            />

            Fornece pro governo ·{' '}
            {historico.totalItens}
          </span>
        )}
    </div>
  );
}

// ============================================================
// FORMATAR CNPJ
// ============================================================

function formatCnpj(
  cnpj: string,
): string {
  const d =
    cnpj.replace(/\D/g, '');

  if (d.length !== 14) {
    return cnpj;
  }

  return `${d.slice(
    0,
    2,
  )}.${d.slice(
    2,
    5,
  )}.${d.slice(
    5,
    8,
  )}/${d.slice(
    8,
    12,
  )}-${d.slice(12, 14)}`;
}

function formatCnpjBasico(
  b: string,
): string {
  if (b.length !== 8) {
    return b;
  }

  return `${b.slice(
    0,
    2,
  )}.${b.slice(
    2,
    5,
  )}.${b.slice(5, 8)}`;
}

// ============================================================
// FORMATAR CAPITAL
// ============================================================

function formatCapital(
  v: number | null,
): string | null {
  if (
    v === null ||
    !Number.isFinite(v)
  ) {
    return null;
  }

  if (v >= 1_000_000) {
    return `R$ ${(
      v / 1_000_000
    ).toLocaleString('pt-BR', {
      maximumFractionDigits: 1,
    })}M`;
  }

  if (v >= 1000) {
    return `R$ ${(
      v / 1000
    ).toLocaleString('pt-BR', {
      maximumFractionDigits: 0,
    })}k`;
  }

  return `R$ ${v.toLocaleString(
    'pt-BR',
  )}`;
}

// ============================================================
// TELEFONE
// ============================================================
//
// Exemplos:
//
// 1130946600
// -> (11) 3094-6600
//
// 11987654321
// -> (11) 98765-4321
//
// 551130946600
// -> (11) 3094-6600
//
// O texto mostrado é formatado, mas o href continua sendo:
//
// tel:+551130946600
// ============================================================

function normalizePhone(
  phone:
    | string
    | null
    | undefined,
): string {
  if (!phone) {
    return '';
  }

  let digits =
    phone.replace(/\D/g, '');

  // Remove prefixo internacional 00.
  if (
    digits.startsWith(
      '0055',
    )
  ) {
    digits =
      digits.slice(4);
  }

  // Remove o código 55 caso já exista.
  if (
    digits.startsWith('55') &&
    digits.length > 11
  ) {
    digits =
      digits.slice(2);
  }

  return digits;
}

function formatPhone(
  phone:
    | string
    | null
    | undefined,
): string {
  if (!phone) {
    return '';
  }

  const digits =
    normalizePhone(phone);

  // CELULAR
  // 11987654321
  // -> (11) 98765-4321

  if (digits.length === 11) {
    return digits.replace(
      /^(\d{2})(\d{5})(\d{4})$/,
      '($1) $2-$3',
    );
  }

  // FIXO
  // 1130946600
  // -> (11) 3094-6600

  if (digits.length === 10) {
    return digits.replace(
      /^(\d{2})(\d{4})(\d{4})$/,
      '($1) $2-$3',
    );
  }

  // Caso venha algo fora do padrão,
  // mantém o valor original.
  return phone;
}

function phoneHref(
  phone:
    | string
    | null
    | undefined,
): string {
  if (!phone) {
    return '#';
  }

  const digits =
    normalizePhone(phone);

  // Número brasileiro completo
  // com DDD.
  if (
    digits.length === 10 ||
    digits.length === 11
  ) {
    return `tel:+55${digits}`;
  }

  // Fallback para dados
  // fora do padrão.
  return `tel:${phone.replace(
    /\D/g,
    '',
  )}`;
}

// ============================================================
// PORTE
// ============================================================

const PORTE_LABEL: Record<
  string,
  string
> = {
  ME: 'Micro',
  EPP: 'Pequena',
  DEMAIS: 'Média/Grande',
};

const MAX_CNAE_BADGES = 4;

// ============================================================
// MATRIZ
// ============================================================

function pickMatriz(
  units: SupplierResult[],
): SupplierResult {
  // CNPJ ordem '0001' identifica a matriz formal.
  //
  // Se não existir no resultset, pega a unidade
  // com maior capital social.

  const matriz =
    units.find(
      (u) =>
        u.cnpj.slice(
          8,
          12,
        ) === '0001',
    );

  if (matriz) {
    return matriz;
  }

  return [...units].sort(
    (a, b) =>
      (b.capital_social ??
        0) -
      (a.capital_social ??
        0),
  )[0]!;
}

// ============================================================
// CNAES
// ============================================================

function collectCnaes(
  units: SupplierResult[],
): string[] {
  const set =
    new Set<string>();

  for (const u of units) {
    if (u.cnae_primario) {
      set.add(
        u.cnae_primario,
      );
    }

    for (const c of
      u.cnaes_secundarios ??
      []) {
      set.add(c);
    }
  }

  return Array.from(set);
}

// ============================================================
// UFS
// ============================================================

function collectUfs(
  units: SupplierResult[],
): string[] {
  const set =
    new Set<string>();

  for (const u of units) {
    if (u.uf) {
      set.add(u.uf);
    }
  }

  return Array.from(
    set,
  ).sort();
}

// ============================================================
// CARD
// ============================================================

export function SuppliersResultCard({
  group,
  cnae,
  enrichment,
  savedToBase,
  onSaveToBase,
}: Props) {
  const [
    expanded,
    setExpanded,
  ] = useState(false);

  const matriz =
    pickMatriz(group.units);

  const allCnaes =
    collectCnaes(
      group.units,
    );

  const ufs =
    collectUfs(
      group.units,
    );

  const isMultiUnit =
    group.units.length > 1;

  const primaryMatch =
    isPrimaryActivity(
      group,
      cnae,
    );

  const anos =
    yearsInMarket(
      group.aberturaAno,
      new Date().getFullYear(),
    );

  const cap =
    formatCapital(
      matriz.capital_social,
    );

  const googleQuery =
    encodeURIComponent(
      `${matriz.razao_social} ${
        matriz.municipio ??
        ''
      } ${matriz.uf ?? ''}`,
    );

  const financialHref =
    `/assistants/financial?cnpj=${encodeURIComponent(
      matriz.cnpj,
    )}&nome=${encodeURIComponent(
      matriz.razao_social,
    )}`;

  const documentos =
    certidoesLinks(
      matriz.uf,
    );

  return (
    <div className="group flex flex-col rounded-2xl border border-border bg-card hover:border-brand/30 transition-all duration-300 p-5 space-y-3">
      {/* =====================================================
          CABEÇALHO
      ===================================================== */}

      <div className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold tracking-tight text-foreground line-clamp-2 leading-snug">
            {
              matriz.razao_social
            }
          </h3>

          <div className="flex shrink-0 items-center gap-1.5">
            {matriz.porte && (
              <span className="rounded-full bg-brand/10 border border-brand/30 px-2 py-0.5 text-[10px] font-medium text-brand">
                {PORTE_LABEL[
                  matriz.porte
                ] ??
                  matriz.porte}
              </span>
            )}

            {onSaveToBase && (
              <button
                type="button"
                onClick={
                  onSaveToBase
                }
                disabled={
                  savedToBase
                }
                title={
                  savedToBase
                    ? 'Já está na sua base'
                    : 'Salvar na minha base'
                }
                aria-label={
                  savedToBase
                    ? 'Já está na sua base'
                    : 'Salvar na minha base'
                }
                className={`inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors ${
                  savedToBase
                    ? 'border-brand/30 bg-brand/10 text-brand cursor-default'
                    : 'border-border text-muted-foreground hover:text-brand hover:bg-brand/10 hover:border-brand/30'
                }`}
              >
                {savedToBase ? (
                  <FolderCheck
                    className="h-3.5 w-3.5"
                    aria-hidden="true"
                  />
                ) : (
                  <FolderPlus
                    className="h-3.5 w-3.5"
                    aria-hidden="true"
                  />
                )}
              </button>
            )}
          </div>
        </div>

        {/* NOME FANTASIA */}

        {matriz.nome_fantasia &&
          matriz.nome_fantasia !==
            matriz.razao_social && (
            <div className="text-xs text-muted-foreground line-clamp-1">
              {
                matriz.nome_fantasia
              }
            </div>
          )}

        {/* CNPJ BASE */}

        <div className="text-[11px] font-mono text-muted-foreground">
          CNPJ base{' '}
          {formatCnpjBasico(
            group.cnpjBasico,
          )}
        </div>

        {/* ATIVIDADE */}

        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium border ${
              primaryMatch
                ? 'bg-brand/10 border-brand/30 text-brand'
                : 'bg-muted/50 border-border text-muted-foreground'
            }`}
            title={
              primaryMatch
                ? 'O CNAE buscado é a atividade PRINCIPAL desta empresa'
                : 'O CNAE buscado é uma atividade secundária desta empresa'
            }
          >
            {primaryMatch && (
              <Star
                className="h-2.5 w-2.5"
                aria-hidden="true"
              />
            )}

            {primaryMatch
              ? 'Atividade principal'
              : 'Atividade secundária'}
          </span>
        </div>

        <EnrichmentSelos
          enrichment={
            enrichment
          }
        />
      </div>

      {/* =====================================================
          CNAES
      ===================================================== */}

      <div className="flex flex-wrap gap-1.5">
        {allCnaes
          .slice(
            0,
            MAX_CNAE_BADGES,
          )
          .map(
            (
              c,
              idx,
            ) => (
              <span
                key={c}
                className={`rounded-md px-2 py-0.5 text-[10px] font-mono ${
                  idx === 0
                    ? 'bg-brand/10 text-brand'
                    : 'bg-muted/40 text-foreground/70'
                }`}
                title={
                  idx === 0
                    ? 'CNAE primário (matriz)'
                    : 'CNAE secundário'
                }
              >
                {c}
              </span>
            ),
          )}

        {allCnaes.length >
          MAX_CNAE_BADGES && (
          <span className="text-[10px] text-muted-foreground self-center">
            +
            {allCnaes.length -
              MAX_CNAE_BADGES}
          </span>
        )}
      </div>

      {/* =====================================================
          DADOS
      ===================================================== */}

      <div className="space-y-1.5 text-xs">
        {/* LOCALIZAÇÃO */}

        {ufs.length > 0 && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin
              className="h-3 w-3 flex-shrink-0"
              aria-hidden="true"
            />

            <span>
              {isMultiUnit
                ? `${group.units.length} unidades · ${ufs.join(
                    ', ',
                  )}`
                : `${
                    matriz.municipio ??
                    ''
                  }${
                    matriz.municipio &&
                    matriz.uf
                      ? ' · '
                      : ''
                  }${
                    matriz.uf ??
                    ''
                  }`}
            </span>
          </div>
        )}

        {/* FUNCIONÁRIOS */}

        {matriz.faixa_funcionarios && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Users
              className="h-3 w-3 flex-shrink-0"
              aria-hidden="true"
            />

            <span>
              {
                matriz.faixa_funcionarios
              }{' '}
              funcionários
            </span>
          </div>
        )}

        {/* CAPITAL */}

        {cap && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Building2
              className="h-3 w-3 flex-shrink-0"
              aria-hidden="true"
            />

            <span>
              Capital social{' '}
              {cap}
            </span>
          </div>
        )}

        {/* TEMPO DE MERCADO */}

        {group.aberturaAno !=
          null && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <CalendarClock
              className="h-3 w-3 flex-shrink-0"
              aria-hidden="true"
            />

            <span>
              No mercado desde{' '}
              {
                group.aberturaAno
              }

              {anos != null &&
              anos >= 1
                ? ` · ${anos} anos`
                : ''}
            </span>
          </div>
        )}
      </div>

      {/* =====================================================
          CONTATOS
      ===================================================== */}

      <div className="pt-2 border-t border-border space-y-1.5">
        {/* TELEFONE */}

        {matriz.telefone ? (
          <a
            href={phoneHref(
              matriz.telefone,
            )}
            className="flex items-center gap-1.5 text-xs text-foreground hover:text-brand transition-colors"
          >
            <Phone
              className="h-3 w-3 flex-shrink-0"
              aria-hidden="true"
            />

            <span>
              {formatPhone(
                matriz.telefone,
              )}
            </span>
          </a>
        ) : null}

        {/* EMAIL */}

        {matriz.email ? (
          <a
            href={`mailto:${matriz.email}`}
            className="flex items-center gap-1.5 text-xs text-foreground hover:text-brand transition-colors break-all"
          >
            <Mail
              className="h-3 w-3 flex-shrink-0"
              aria-hidden="true"
            />

            <span>
              {matriz.email}
            </span>
          </a>
        ) : null}

        {/* SEM CONTATO */}

        {!matriz.telefone &&
          !matriz.email && (
            <a
              href={`https://www.google.com/search?q=${googleQuery}`}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-brand transition-colors"
            >
              <ExternalLink
                className="h-3 w-3 flex-shrink-0"
                aria-hidden="true"
              />

              Buscar contato no
              Google
            </a>
          )}
      </div>

      {/* =====================================================
          DETALHES
      ===================================================== */}

      <button
        type="button"
        onClick={() =>
          setExpanded(
            (v) => !v,
          )
        }
        className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border bg-background hover:bg-accent hover:border-brand/30 h-8 px-3 text-xs font-medium text-foreground/80 transition-all duration-200 active:scale-95 self-start"
      >
        {expanded ? (
          <>
            <ChevronUp
              className="h-3 w-3"
              aria-hidden="true"
            />

            Ocultar detalhes
          </>
        ) : (
          <>
            <ChevronDown
              className="h-3 w-3"
              aria-hidden="true"
            />

            Detalhes

            {isMultiUnit
              ? ` · ${group.units.length} unidades`
              : ''}

            {allCnaes.length >
            MAX_CNAE_BADGES
              ? ` · ${allCnaes.length} CNAEs`
              : ''}
          </>
        )}
      </button>

      {/* =====================================================
          DETALHES EXPANDIDOS
      ===================================================== */}

      {expanded && (
        <div className="space-y-3 pt-2 border-t border-border">
          {/* UNIDADES */}

          {isMultiUnit && (
            <div className="space-y-2">
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Unidades / Filiais
              </div>

              <div className="space-y-2">
                {group.units.map(
                  (u) => (
                    <UnitRow
                      key={
                        u.cnpj
                      }
                      unit={u}
                    />
                  ),
                )}
              </div>
            </div>
          )}

          {/* CNPJ */}

          {!isMultiUnit && (
            <div className="space-y-2">
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                CNPJ
              </div>

              <div className="text-[11px] font-mono text-foreground">
                {formatCnpj(
                  matriz.cnpj,
                )}
              </div>
            </div>
          )}

          {/* CNAES */}

          <div className="space-y-2">
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Todos os CNAEs
              registrados (
              {allCnaes.length})
            </div>

            <div className="flex flex-wrap gap-1">
              {allCnaes.map(
                (c) => (
                  <span
                    key={c}
                    className="rounded-md bg-muted/40 px-2 py-0.5 text-[10px] font-mono text-foreground/80"
                  >
                    {c}
                  </span>
                ),
              )}
            </div>
          </div>

          {/* ENRIQUECIMENTO */}

          {enrichment && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Análise mínima
                (Receita +
                Compras.gov.br/PNCP
                + Portal da
                Transparência)
              </div>

              <div className="text-[11px] text-foreground/80">
                {
                  enrichment.resumo
                }
              </div>
            </div>
          )}

          {/* DOCUMENTAÇÃO */}

          <div className="space-y-2">
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Documentação
            </div>

            <div className="flex flex-col gap-1">
              {documentos.map(
                (d) => (
                  <a
                    key={
                      d.label
                    }
                    href={
                      d.url
                    }
                    target="_blank"
                    rel="noreferrer noopener"
                    title={
                      d.nota
                    }
                    className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-brand transition-colors"
                  >
                    <FileWarning
                      className="h-3 w-3 flex-shrink-0"
                      aria-hidden="true"
                    />

                    <span className="truncate">
                      {
                        d.label
                      }
                    </span>
                  </a>
                ),
              )}
            </div>
          </div>

          {/* FINANCEIRO */}

          <a
            href={
              financialHref
            }
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-brand hover:text-brand/80 transition-colors"
            title="Abre a Análise Financeira com CNPJ e razão social pré-preenchidos"
          >
            <Banknote
              className="h-3 w-3 flex-shrink-0"
              aria-hidden="true"
            />

            Analisar saúde
            financeira
          </a>
        </div>
      )}
    </div>
  );
}

// ============================================================
// UNIDADE / FILIAL
// ============================================================

function UnitRow({
  unit,
}: {
  unit: SupplierResult;
}) {
  const isMatriz =
    unit.cnpj.slice(
      8,
      12,
    ) === '0001';

  return (
    <div className="rounded-lg border border-border bg-background/40 p-2.5 space-y-1">
      {/* CNPJ */}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-[11px] font-mono text-foreground">
          {formatCnpj(
            unit.cnpj,
          )}
        </div>

        {isMatriz && (
          <span className="rounded-full bg-brand/10 border border-brand/30 px-1.5 py-0.5 text-[9px] font-medium text-brand uppercase tracking-wider">
            Matriz
          </span>
        )}
      </div>

      {/* LOCALIZAÇÃO + CNAE */}

      <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
        <span>
          {unit.municipio ??
            ''}

          {unit.municipio &&
          unit.uf
            ? ' · '
            : ''}

          {unit.uf ?? ''}
        </span>

        {unit.cnae_primario && (
          <span className="font-mono text-foreground/70">
            {
              unit.cnae_primario
            }
          </span>
        )}
      </div>

      {/* CONTATOS */}

      {(unit.telefone ||
        unit.email) && (
        <div className="flex items-center gap-3 text-[11px] flex-wrap">
          {/* TELEFONE */}

          {unit.telefone && (
            <a
              href={phoneHref(
                unit.telefone,
              )}
              className="inline-flex items-center gap-1 text-foreground/80 hover:text-brand transition-colors"
            >
              <Phone
                className="h-2.5 w-2.5"
                aria-hidden="true"
              />

              {formatPhone(
                unit.telefone,
              )}
            </a>
          )}

          {/* EMAIL */}

          {unit.email && (
            <a
              href={`mailto:${unit.email}`}
              className="inline-flex items-center gap-1 text-foreground/80 hover:text-brand break-all transition-colors"
            >
              <Mail
                className="h-2.5 w-2.5"
                aria-hidden="true"
              />

              {unit.email}
            </a>
          )}
        </div>
      )}
    </div>
  );
}