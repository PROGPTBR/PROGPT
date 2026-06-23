import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import {
  fetchFiscalSnapshot,
  snapshotToBadge,
  type FiscalBadge,
} from '@/lib/fiscal/snapshot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/suppliers/enrich — sub-projeto 36 (fase 3).
// Selo fiscal sob demanda pros cards da busca de fornecedores. Consulta
// por-CNPJ (o serviço não tem lote) com cap de concorrência pra não estourar
// o rate-limit das fontes. Auth + rate-limit do chat. Fail-soft.

const MAX_CNPJS = 30;
const CONCURRENCY = 4;

const Body = z.object({ cnpjs: z.array(z.string()).min(1).max(MAX_CNPJS) });

function onlyDigits(s: string): string {
  return s.replace(/\D/g, '');
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export async function POST(req: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const rl = await checkChatRateLimit();
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', retry_after_secs: rl.retryAfterSecs },
      { status: 429 },
    );
  }

  let cnpjs: string[];
  try {
    cnpjs = Body.parse(await req.json()).cnpjs;
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const unique = [...new Set(cnpjs.map(onlyDigits).filter((d) => d.length === 14))];
  const results: Record<string, FiscalBadge> = {};
  await mapWithConcurrency(unique, CONCURRENCY, async (d) => {
    const snap = await fetchFiscalSnapshot(d);
    results[d] = snapshotToBadge(snap);
  });

  return NextResponse.json({ results });
}
