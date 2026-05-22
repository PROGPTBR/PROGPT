import { getReceitaSql } from './receita-db';
import type { CnaeInfo } from './types';

// Lookup helpers para `cnae_taxonomy` (1331 rows, IBGE 2.3).
//
// Cache em memória do server por código (TTL 1h) — taxonomia praticamente
// nunca muda, evita roundtrip pra DB externa em renderizações repetidas
// do mesmo card de fornecedor.

const CACHE_TTL_MS = 60 * 60 * 1000;

type CacheEntry = { value: CnaeInfo | null; expires: number };
const byCodeCache = new Map<string, CacheEntry>();

export async function getCnaeByCode(code: string): Promise<CnaeInfo | null> {
  const now = Date.now();
  const cached = byCodeCache.get(code);
  if (cached && cached.expires > now) return cached.value;

  const sql = getReceitaSql();
  try {
    const rows = await sql<
      Array<{
        codigo: string;
        denominacao: string;
        divisao_descricao: string | null;
        grupo_descricao: string | null;
      }>
    >`
      select codigo, denominacao, divisao_descricao, grupo_descricao
      from cnae_taxonomy
      where codigo = ${code}
      limit 1
    `;
    const value: CnaeInfo | null = rows[0]
      ? {
          code: rows[0].codigo,
          name: rows[0].denominacao,
          divisao: rows[0].divisao_descricao,
          grupo: rows[0].grupo_descricao,
        }
      : null;
    byCodeCache.set(code, { value, expires: now + CACHE_TTL_MS });
    return value;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[suppliers/cnae-lookup] getCnaeByCode failed:', msg);
    return null;
  }
}

export async function searchCnaesByText(
  query: string,
  limit = 10,
): Promise<CnaeInfo[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const sql = getReceitaSql();
  try {
    const pattern = `%${trimmed.replace(/[%_]/g, '\\$&')}%`;
    const rows = await sql<
      Array<{
        codigo: string;
        denominacao: string;
        divisao_descricao: string | null;
        grupo_descricao: string | null;
      }>
    >`
      select codigo, denominacao, divisao_descricao, grupo_descricao
      from cnae_taxonomy
      where denominacao ilike ${pattern} or codigo ilike ${pattern}
      order by length(denominacao) asc
      limit ${limit}
    `;
    return rows.map((r) => ({
      code: r.codigo,
      name: r.denominacao,
      divisao: r.divisao_descricao,
      grupo: r.grupo_descricao,
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[suppliers/cnae-lookup] searchCnaesByText failed:', msg);
    return [];
  }
}

// Testes mockam o cache pra evitar contaminação entre cases.
export function _clearCnaeCacheForTests(): void {
  byCodeCache.clear();
}
