import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth';
import { CalculadoraErro, calculadoraLigada, classificacoes, ufs, versaoCalculadora } from '@/lib/reforma/calculadora';
import { atividadesSimples, simplesDisponivel } from '@/lib/reforma/simples';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Dados de base da Calculadora da Reforma: versão do motor oficial, UFs e as
// classificações tributárias (cClassTrib) da NF-e. Tudo em cache de 24 h.
export async function GET() {
  if (!(await getCurrentUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!calculadoraLigada()) return NextResponse.json({ error: 'desligada' }, { status: 503 });
  try {
    const [versao, listaUfs, lista, atividades] = await Promise.all([
      versaoCalculadora(),
      ufs(),
      classificacoes(),
      // Fornecedor do Simples: só com a nossa cópia da calculadora no ar. Falha
      // aqui não derruba a tela, só esconde a opção.
      simplesDisponivel()
        ? atividadesSimples('2027-06-01').catch((err) => {
            console.warn('[reforma] atividades do Simples indisponíveis:', String(err));
            return [];
          })
        : Promise.resolve([]),
    ]);
    return NextResponse.json({ versao, ufs: listaUfs, classificacoes: lista, simples: { atividades } });
  } catch (err) {
    console.error('[reforma] base falhou:', err);
    const status = err instanceof CalculadoraErro ? 502 : 500;
    return NextResponse.json(
      { error: 'indisponivel', message: 'A calculadora oficial da Receita não respondeu agora. Tente de novo em instantes.' },
      { status },
    );
  }
}
