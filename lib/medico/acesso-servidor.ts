import { NextResponse } from 'next/server';

import { getCurrentUser, getProfile } from '@/lib/auth';
import { areaMedicaLiberada } from './acesso';

/** O usuário tem a Área Médica (lista de e-mails ou super admin). */
export async function usuarioComAreaMedica(user: { id: string; email?: string | null }): Promise<boolean> {
  if (areaMedicaLiberada(user.email)) return true;
  const profile = await getProfile(user.id).catch(() => null);
  return areaMedicaLiberada(user.email, profile?.super_admin === true);
}

/** Para as rotas: devolve o usuário liberado ou a resposta de erro (404 esconde a área de quem não tem). */
export async function medicoOuErro(): Promise<{ id: string; email?: string | null } | NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await usuarioComAreaMedica(user))) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return user;
}
