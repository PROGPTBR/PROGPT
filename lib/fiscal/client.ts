// Cliente do mcp-fiscal-brasil (serviço REST FastAPI no Railway).
// Padrão de wrapper espelhado em lib/billing/asaas.ts (timeout, error class,
// getConfig). Contrato em docs/product/fiscal-api-contract.md.
//
// Fail-soft por design: se FISCAL_API_URL não estiver setada, a feature está
// desligada — `isFiscalEnabled()` retorna false e os call sites pulam o
// enriquecimento. As funções tipadas lançam FiscalError em erro/timeout/HTTP;
// os call sites tratam (try/catch) para nunca derrubar o fluxo principal.
//
// NUNCA logar payload cru de resposta fiscal (disciplina LGPD da casa).

import { cached } from './cache';
import type {
  CnpjData,
  CompareRegimesInput,
  ComplianceReport,
  SupplierRiskScore,
  TaxRegimeComparison,
} from './types';

const TIMEOUT_MS = 20_000; // compliance agrega várias fontes upstream

export class FiscalError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: unknown,
  ) {
    super(message);
    this.name = 'FiscalError';
  }
}

/** True quando o serviço fiscal está configurado (FISCAL_API_URL setada). */
export function isFiscalEnabled(): boolean {
  return !!process.env.FISCAL_API_URL?.trim();
}

function getBaseUrl(): string {
  const url = process.env.FISCAL_API_URL?.trim();
  if (!url) {
    throw new FiscalError('FISCAL_API_URL env var missing', 0, null);
  }
  return url.replace(/\/+$/, ''); // sem barra final
}

/** Só dígitos — o serviço aceita CNPJ formatado ou não, mas normalizamos. */
function onlyDigits(s: string): string {
  return s.replace(/\D/g, '');
}

async function fiscalGetOnce<T>(path: string): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method: 'GET',
    headers: { Accept: 'application/json', 'User-Agent': 'PROGPT/1.0' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }

  if (!res.ok) {
    throw new FiscalError(`Fiscal GET ${path} failed: ${res.status}`, res.status, parsed);
  }
  return parsed as T;
}

// 1 retry pra absorver o COLD START do serviço no Railway: o container dorme
// quando ocioso; a 1ª request o acorda e pode estourar o timeout, mas a 2ª (já
// quente) responde rápido. Retry em timeout/erro de rede e 5xx; NÃO em 4xx
// (CNPJ inválido) nem em config ausente (status 0).
async function fiscalGet<T>(path: string): Promise<T> {
  try {
    return await fiscalGetOnce<T>(path);
  } catch (err) {
    const retriable = err instanceof FiscalError ? err.status >= 500 : true;
    if (!retriable) throw err;
    await new Promise((r) => setTimeout(r, 1200));
    return fiscalGetOnce<T>(path);
  }
}

// ── Endpoints tipados (cacheados por 24h por CNPJ) ──────────────────────────

export function consultarCnpj(cnpj: string): Promise<CnpjData> {
  const d = onlyDigits(cnpj);
  return cached(`cnpj:${d}`, () => fiscalGet<CnpjData>(`/v1/cnpj/${d}`));
}

export function consultarSimples(cnpj: string): Promise<unknown> {
  const d = onlyDigits(cnpj);
  return cached(`simples:${d}`, () => fiscalGet(`/v1/simples/${d}`));
}

export function riskScoreSupplier(
  cnpj: string,
  estrito = false,
): Promise<SupplierRiskScore> {
  const d = onlyDigits(cnpj);
  const qs = estrito ? '?estrito=true' : '';
  return cached(`supplier:${d}:${estrito}`, () =>
    fiscalGet<SupplierRiskScore>(`/v1/agentic/supplier/${d}${qs}`),
  );
}

export function analyzeCnpjCompliance(cnpj: string): Promise<ComplianceReport> {
  const d = onlyDigits(cnpj);
  return cached(`compliance:${d}`, () =>
    fiscalGet<ComplianceReport>(`/v1/agentic/compliance/${d}`),
  );
}

export function compareTaxRegimes(
  input: CompareRegimesInput,
): Promise<TaxRegimeComparison> {
  const qs = new URLSearchParams({
    faturamento_anual: String(input.faturamentoAnual),
    setor: input.setor,
  });
  if (input.folhaPagamentoAnual != null) {
    qs.set('folha_pagamento_anual', String(input.folhaPagamentoAnual));
  }
  // Não cacheado: cenário é paramétrico (não por CNPJ).
  return fiscalGet<TaxRegimeComparison>(`/v1/agentic/regimes?${qs.toString()}`);
}

/** Healthcheck — true se o serviço responde 200 em /health. */
export async function fiscalHealthcheck(): Promise<boolean> {
  try {
    await fiscalGet('/health');
    return true;
  } catch {
    return false;
  }
}
