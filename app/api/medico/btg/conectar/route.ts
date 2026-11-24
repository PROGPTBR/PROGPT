import { NextResponse } from 'next/server';

import { medicoOuErro } from '@/lib/medico/acesso-servidor';
import { btgConfigurado, cnpjLimpo, criarState, urlDeAutorizacao } from '@/lib/medico/btg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/medico/btg/conectar?cnpj=: manda o médico para o login do BTG, onde
// ele autoriza a LEITURA da conta. Devolve a URL (a tela redireciona).
export async function GET(req: Request) {
  const u = await medicoOuErro();
  if (u instanceof NextResponse) return u;
  if (!btgConfigurado()) {
    return NextResponse.json({ error: 'sem_btg', message: 'A ligação com o BTG ainda não foi liberada no servidor.' }, { status: 503 });
  }
  const cnpj = cnpjLimpo(new URL(req.url).searchParams.get('cnpj') ?? '');
  if (!cnpj) return NextResponse.json({ error: 'invalid_body', message: 'Informe o CNPJ da conta no BTG.' }, { status: 400 });
  return NextResponse.json({ url: urlDeAutorizacao(criarState(u.id, cnpj)) }, { headers: { 'Cache-Control': 'private, no-store' } });
}
