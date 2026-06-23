import { NextResponse } from 'next/server';
import { requireAdmin, NotAdmin } from '@/lib/auth';
import {
  isFiscalEnabled,
  fiscalHealthcheck,
  riskScoreSupplier,
  FiscalError,
} from '@/lib/fiscal/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/admin/fiscal-health — diagnóstico admin do serviço fiscal.
// Determinístico: diz se FISCAL_API_URL está setada, o host (pra detectar
// internal vs public), se /health responde e se uma consulta real funciona.
// Admin-only → 404 pra non-admin (não revela o endpoint).
export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof NotAdmin) return new NextResponse('Not Found', { status: 404 });
    throw err;
  }

  const enabled = isFiscalEnabled();
  let host: string | null = null;
  try {
    host = new URL(process.env.FISCAL_API_URL ?? '').host;
  } catch {
    host = null;
  }

  let healthcheck = false;
  let probe: { ok: boolean; status?: number; error?: string } = { ok: false };
  if (enabled) {
    healthcheck = await fiscalHealthcheck();
    try {
      const r = await riskScoreSupplier('00000000000191'); // Banco do Brasil
      probe = { ok: !!r.cnpj };
    } catch (err) {
      probe = {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        ...(err instanceof FiscalError ? { status: err.status } : {}),
      };
    }
  }

  return NextResponse.json({ enabled, host, healthcheck, probe });
}
