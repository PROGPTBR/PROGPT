import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth';
import { CalculadoraErro, calculadoraLigada, classificacoes, ufs, versaoCalculadora } from '@/lib/reforma/calculadora';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Dados de base da Calculadora da Reforma: versão do motor oficial, UFs e as
// classificações tributárias (cClassTrib) da NF-e. Tudo em cache de 24 h.
export async function GET() {
  if (!(await getCurrentUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!calculadoraLigada()) return NextResponse.json({ error: 'desligada' }, { status: 503 });
  try {
    const [versao, listaUfs, lista] = await Promise.all([versaoCalculadora(), ufs(), classificacoes()]);
    return NextResponse.json({ versao, ufs: listaUfs, classificacoes: lista });
  } catch (err) {
    console.error('[reforma] base falhou:', err);
    const status = err instanceof CalculadoraErro ? 502 : 500;
    return NextResponse.json(
      { error: 'indisponivel', message: 'A calculadora oficial da Receita não respondeu agora. Tente de novo em instantes.' },
      { status },
    );
  }
}
