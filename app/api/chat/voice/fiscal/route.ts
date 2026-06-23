import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { fetchFiscalSnapshot, type FiscalSnapshot } from '@/lib/fiscal/snapshot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/chat/voice/fiscal — sub-projeto 36 (fase 4).
// Executor da tool `consultar_dados_fiscais` da sessão de voz realtime: o
// modelo passa um CNPJ, devolvemos um RESUMO FALÁVEL curto (situação + risco)
// pro modelo narrar. Auth + rate-limit do chat. Fail-soft: sempre 200 com
// `resumo` (após auth/rate-limit) pra a IA ter sempre o que dizer.

const Body = z.object({ cnpj: z.string().trim().min(11).max(20) });

const RISK_LABEL: Record<string, string> = {
  baixo: 'baixo',
  medio: 'médio',
  alto: 'alto',
  critico: 'crítico',
};

function buildResumo(snap: FiscalSnapshot, cnpj: string): string {
  if (!snap.enabled) return 'A consulta de dados fiscais não está disponível no momento.';
  if (!snap.available) return `Não encontrei dados na base fiscal para o CNPJ ${cnpj}.`;
  const parts: string[] = [];
  if (snap.cnpjData) {
    parts.push(
      `${snap.cnpjData.razao_social}, situação cadastral ${snap.cnpjData.situacao_cadastral.toLowerCase()}`,
    );
  }
  if (snap.risk) {
    parts.push(
      `score de risco fiscal ${snap.risk.score} de 100, risco ${RISK_LABEL[snap.risk.risco] ?? snap.risk.risco}, recomendação ${snap.risk.recomendacao.replace(/_/g, ' ')}`,
    );
  }
  return parts.length ? `${parts.join('. ')}.` : 'Consulta sem detalhes disponíveis.';
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

  let cnpj: string;
  try {
    cnpj = Body.parse(await req.json()).cnpj;
  } catch {
    return NextResponse.json(
      { resumo: 'Não consegui identificar um CNPJ válido. Pode repetir os números?' },
      { status: 200 },
    );
  }

  const snap = await fetchFiscalSnapshot(cnpj);
  return NextResponse.json({ resumo: buildResumo(snap, cnpj) });
}
