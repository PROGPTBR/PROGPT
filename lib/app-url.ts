const CANONICAL_APP_URL = 'https://progpt.com.br';
const RETIRED_HOSTS = new Set(['app.2bsupply.com.br']);

export function configuredAppUrl(): string {
  const configured = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (!configured) return CANONICAL_APP_URL;

  try {
    const url = new URL(configured);
    if (RETIRED_HOSTS.has(url.hostname.toLowerCase())) return CANONICAL_APP_URL;
    return url.origin;
  } catch {
    return CANONICAL_APP_URL;
  }
}

export function isRetiredAppHost(host: string): boolean {
  return RETIRED_HOSTS.has((host.split(':', 1)[0] ?? '').toLowerCase());
}

export { CANONICAL_APP_URL };
