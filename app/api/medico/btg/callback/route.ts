import { NextResponse } from 'next/server';

import { configuredAppUrl } from '@/lib/app-url';
import { getCurrentUser } from '@/lib/auth';
import { usuarioComAreaMedica } from '@/lib/medico/acesso-servidor';
import { BtgErro, btgConfigurado, concluirConexao, lerState, redirectUri } from '@/lib/medico/btg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/medico/btg/callback: volta do login do BTG. Só conclui se quem
// voltou é o mesmo usuário que pediu a ligação (state assinado + sessão).
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  // Volta para o mesmo domínio em que o retorno está cadastrado no BTG.
  const base = (() => {
    try {
      return new URL(redirectUri()).origin;
    } catch {
      return configuredAppUrl();
    }
  })();
  const voltar = (banco: string, motivo?: string) =>
    NextResponse.redirect(`${base}/area-medica?aba=banco&banco=${banco}${motivo ? `&motivo=${encodeURIComponent(motivo)}` : ''}`);

  const user = await getCurrentUser();
  const state = lerState(params.get('state'));
  const code = params.get('code');
  if (!btgConfigurado() || !user || !state || state.userId !== user.id || !(await usuarioComAreaMedica(user))) {
    return voltar('erro', 'A autorização expirou ou não é desta conta. Tente conectar de novo.');
  }
  if (!code) return voltar('erro', 'O BTG não concluiu a autorização.');

  try {
    await concluirConexao(user.id, state.cnpj, code);
    return voltar('conectado');
  } catch (err) {
    console.error('[medico/btg] callback:', err instanceof Error ? err.message : err);
    return voltar('erro', err instanceof BtgErro ? err.message : 'Não foi possível concluir a ligação com o BTG.');
  }
}
