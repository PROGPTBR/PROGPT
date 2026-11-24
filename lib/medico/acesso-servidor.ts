import { NextResponse } from 'next/server';

import { getCurrentUser, getProfile } from '@/lib/auth';
import { areaMedicaLiberada, soAreaMedica } from './acesso';

/** O usuário tem a Área Médica (tipo de conta, super admin ou lista de e-mails). */
export async function usuarioComAreaMedica(user: { id: string; email?: string | null }): Promise<boolean> {
  if (areaMedicaLiberada(user.email)) return true;
  const profile = await getProfile(user.id).catch(() => null);
  return areaMedicaLiberada(user.email, profile?.super_admin === true, profile?.area_medica);
}

/** Para as rotas: devolve o usuário liberado ou a resposta de erro (404 esconde a área de quem não tem). */
export async function medicoOuErro(): Promise<{ id: string; email?: string | null } | NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await usuarioComAreaMedica(user))) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return user;
}

/**
 * Para as rotas do RESTO do sistema (chat, assistentes): a conta de médico não
 * usa. Devolve a resposta 403 para ela, ou null para seguir.
 */
export async function recusarContaDeMedico(userId: string): Promise<NextResponse | null> {
  // Se a leitura do perfil falhar, segue: as telas já são fechadas pelo middleware.
  let tipo: string | null | undefined;
  try {
    tipo = (await getProfile(userId))?.area_medica;
  } catch {
    return null;
  }
  if (!soAreaMedica(tipo as never)) return null;
  return NextResponse.json({ error: 'so_area_medica', message: 'Esta conta é da Área Médica.' }, { status: 403 });
}
