import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { getProfile } from '@/lib/auth';
import { fluxoLiberado, MENSAGEM_SOB_DEMANDA } from './acesso';

/** O usuário usa o Fluxo de verdade (lista de e-mails ou super admin). */
export async function usuarioComFluxo(user: Pick<User, 'id' | 'email'>): Promise<boolean> {
  if (fluxoLiberado(user.email)) return true;
  const profile = await getProfile(user.id).catch(() => null);
  return fluxoLiberado(user.email, profile?.super_admin === true);
}

/** Resposta padrão das rotas do Fluxo para quem só tem a vitrine. */
export function respostaSobDemanda() {
  return NextResponse.json({ error: 'sob_demanda', message: MENSAGEM_SOB_DEMANDA }, { status: 403 });
}
