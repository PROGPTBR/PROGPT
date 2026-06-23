// Cliente das APIs públicas brasileiras de compras + indicadores (govdata).
// Chama as APIs subjacentes que o mcp-brasil encapsula — TODAS abertas, sem
// chave: PNCP (consulta), Compras.gov.br (dados abertos), BACEN (SGS).
// NÃO rodamos o servidor mcp-brasil nem um cliente MCP — só HTTP fino.
//
// Padrão fail-soft espelhado em lib/fiscal/client.ts (timeout, retry de cold
// start, error class). Contrato em docs/product/govdata-api-contract.md.
//
// Default-ON: como as APIs são públicas e grátis, a feature liga sozinha.
// GOVDATA_ENABLED='false' é o kill-switch. Cada base aceita override por env
// (PNCP_API_URL/COMPRAS_API_URL/BACEN_API_URL) — útil pra apontar pra um proxy
// se a API gov estiver instável. As funções tipadas (fases 1-3) lançam
// GovDataError em erro; os call sites tratam (try/catch) pra nunca derrubar o
// fluxo principal.
//
// NUNCA logar payload cru (disciplina LGPD da casa, mesmo sendo dado público de PJ).

const TIMEOUT_MS = 20_000; // APIs gov às vezes lentas/instáveis

export type GovBase = 'pncp' | 'compras' | 'bacen';

const DEFAULT_BASE: Record<GovBase, string> = {
  pncp: 'https://pncp.gov.br/api/consulta',
  compras: 'https://dadosabertos.compras.gov.br',
  bacen: 'https://api.bcb.gov.br/dados',
};

const ENV_KEY: Record<GovBase, string> = {
  pncp: 'PNCP_API_URL',
  compras: 'COMPRAS_API_URL',
  bacen: 'BACEN_API_URL',
};

export class GovDataError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: unknown,
  ) {
    super(message);
    this.name = 'GovDataError';
  }
}

/** Kill-switch. Default ON (APIs públicas grátis); GOVDATA_ENABLED='false' desliga tudo. */
export function isGovDataEnabled(): boolean {
  return process.env.GOVDATA_ENABLED?.trim().toLowerCase() !== 'false';
}

/** URL base de uma fonte: env override (com default https://) ou default público. */
export function govBaseUrl(base: GovBase): string {
  const raw = process.env[ENV_KEY[base]]?.trim() || DEFAULT_BASE[base];
  // Tolera valor SEM esquema (ex.: "proxy.local") — default https. Sem isso o
  // fetch falha com "Failed to parse URL".
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withScheme.replace(/\/+$/, ''); // sem barra final
}

type Params = Record<string, string | number | boolean | undefined | null>;

function buildUrl(base: GovBase, path: string, params?: Params): string {
  const url = `${govBaseUrl(base)}${path}`;
  if (!params) return url;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  const q = qs.toString();
  return q ? `${url}?${q}` : url;
}

async function govGetOnce<T>(url: string): Promise<T> {
  const res = await fetch(url, {
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
    throw new GovDataError(`GovData GET ${url} failed: ${res.status}`, res.status, parsed);
  }
  return parsed as T;
}

/**
 * GET fail-soft numa das APIs públicas. 1 retry em 5xx/timeout/erro de rede
 * (absorve instabilidade/lentidão das APIs gov); NÃO faz retry em 4xx nem
 * quando a feature está desligada (GOVDATA_ENABLED='false', status 0).
 */
export async function govGet<T>(base: GovBase, path: string, params?: Params): Promise<T> {
  if (!isGovDataEnabled()) {
    throw new GovDataError('govdata disabled (GOVDATA_ENABLED=false)', 0, null);
  }
  const url = buildUrl(base, path, params);
  try {
    return await govGetOnce<T>(url);
  } catch (err) {
    const retriable = err instanceof GovDataError ? err.status >= 500 : true;
    if (!retriable) throw err;
    await new Promise((r) => setTimeout(r, 1200));
    return govGetOnce<T>(url);
  }
}

/** Healthcheck simples por base — true se `path` responde sem erro. */
export async function govHealthcheck(base: GovBase, path: string): Promise<boolean> {
  try {
    await govGet(base, path);
    return true;
  } catch {
    return false;
  }
}
