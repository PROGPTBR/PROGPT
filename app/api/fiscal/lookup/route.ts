import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { fetchFiscalSnapshot } from '@/lib/fiscal/snapshot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/fiscal/lookup — sub-projeto 36 (fase 2).
// Consulta leve de CNPJ (cadastro + score de risco) pro botão "Consultar CNPJ"
// do form da Análise Financeira. Auth + rate-limit do chat. Fail-soft: sempre
// 200; o client decide o que mostrar a partir de enabled/available.

const Body = z.object({ cnpj: z.string().trim().min(11).max(20) });

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

  let cnpj: string;
  try {
    cnpj = Body.parse(await req.json()).cnpj;
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const snap = await fetchFiscalSnapshot(cnpj);
  return NextResponse.json({
    enabled: snap.enabled,
    available: snap.available,
    razaoSocial: snap.cnpjData?.razao_social ?? null,
    nomeFantasia: snap.cnpjData?.nome_fantasia ?? null,
    situacao: snap.cnpjData?.situacao_cadastral ?? null,
    naturezaJuridica: snap.cnpjData?.natureza_juridica ?? null,
    municipio: snap.cnpjData?.endereco?.municipio ?? null,
    uf: snap.cnpjData?.endereco?.uf ?? null,
    score: snap.risk?.score ?? null,
    risco: snap.risk?.risco ?? null,
    recomendacao: snap.risk?.recomendacao ?? null,
  });
}
