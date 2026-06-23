// Snapshot fiscal LEVE (cadastro + score de risco) por CNPJ. Usado fora da
// homologação: pelo lookup do form da Análise Financeira e pela injeção do
// bloco fiscal no relatório financeiro. Sem compliance/sanções/reputacional
// (mantém rápido/barato). Fail-soft: nunca lança.

import { isFiscalEnabled, consultarCnpj, riskScoreSupplier } from './client';
import type { CnpjData, SupplierRiskScore } from './types';

export type FiscalSnapshot = {
  enabled: boolean;
  available: boolean;
  cnpjData: CnpjData | null;
  risk: SupplierRiskScore | null;
  error?: string;
};

export async function fetchFiscalSnapshot(cnpj: string): Promise<FiscalSnapshot> {
  const snap: FiscalSnapshot = {
    enabled: isFiscalEnabled(),
    available: false,
    cnpjData: null,
    risk: null,
  };
  if (!snap.enabled) return snap;

  const [cnpjR, riskR] = await Promise.allSettled([
    consultarCnpj(cnpj),
    riskScoreSupplier(cnpj),
  ]);
  if (cnpjR.status === 'fulfilled') snap.cnpjData = cnpjR.value;
  if (riskR.status === 'fulfilled') snap.risk = riskR.value;
  snap.available = !!(snap.cnpjData || snap.risk);
  if (!snap.available) {
    const err =
      cnpjR.status === 'rejected'
        ? cnpjR.reason
        : riskR.status === 'rejected'
          ? riskR.reason
          : null;
    snap.error = err instanceof Error ? err.message : String(err ?? 'indisponível');
  }
  return snap;
}
