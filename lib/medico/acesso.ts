// Área Médica (sub-projeto 100): área particular, só para quem a 2B Supply
// liberar (decisão do Alexandre e do dono, 2026-11-24: "só quem tem aquele
// acesso é quem a gente der"). Liberação por pessoa, não por domínio.
// Para liberar um médico que contratou: acrescente o e-mail aqui.

export const EMAILS_AREA_MEDICA: readonly string[] = ['alexandre@b2supply.com'];

export function areaMedicaLiberada(email: string | null | undefined, superAdmin = false): boolean {
  if (superAdmin) return true;
  const e = (email ?? '').trim().toLowerCase();
  return !!e && EMAILS_AREA_MEDICA.includes(e);
}
