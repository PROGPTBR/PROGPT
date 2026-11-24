// Área Médica (sub-projetos 100 e 105): área particular, só para quem a 2B
// Supply liberar. O acesso vem de três lugares:
//  - o tipo de conta no perfil (`profiles.area_medica`), dado pelo super admin
//    na aba Integrações ao convidar o médico. É o caminho normal;
//  - super admin da 2B Supply;
//  - a lista abaixo (equipe que apresenta o produto).
//
// 'medico' = conta que só enxerga a Área Médica: sem chat, sem assistentes,
// sem a assinatura do plano de compras. 'equipe' = conta comum que também
// enxerga a Área Médica.

export const EMAILS_AREA_MEDICA: readonly string[] = ['alexandre@b2supply.com'];

export type TipoAreaMedica = '' | 'medico' | 'equipe';

export function areaMedicaLiberada(email: string | null | undefined, superAdmin = false, tipo: TipoAreaMedica | null | undefined = ''): boolean {
  if (superAdmin || tipo === 'medico' || tipo === 'equipe') return true;
  const e = (email ?? '').trim().toLowerCase();
  return !!e && EMAILS_AREA_MEDICA.includes(e);
}

/** Conta que só usa a Área Médica: todo o resto do sistema fica fechado para ela. */
export function soAreaMedica(tipo: TipoAreaMedica | null | undefined): boolean {
  return tipo === 'medico';
}

/** Telas que a conta de médico pode abrir (além das públicas). */
export function caminhoDoMedico(pathname: string): boolean {
  return pathname === '/area-medica' || pathname.startsWith('/area-medica/');
}
