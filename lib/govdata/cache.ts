// Cache em memória com TTL por chave (consulta + params). Mesmo padrão de
// lib/fiscal/cache.ts. Dados de compras públicas / indicadores econômicos mudam
// devagar; TTL 24h evita martelar as APIs gov em re-consultas. Process-local
// (reinicia a cada deploy) — suficiente.

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24h

type Entry<T> = { value: T; expires: number };

const store = new Map<string, Entry<unknown>>();

/** Retorna o valor cacheado se ainda válido; senão chama `fetcher`, cacheia e retorna. */
export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS,
  now: number = Date.now(),
): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expires > now) {
    return hit.value as T;
  }
  const value = await fetcher();
  store.set(key, { value, expires: now + ttlMs });
  return value;
}

/** Limpa o cache (uso em testes). */
export function clearGovDataCache(): void {
  store.clear();
}
