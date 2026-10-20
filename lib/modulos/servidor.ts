import { getServerSupabase } from '@/lib/db/supabase';
import { lerDesativados } from './catalogo';

// Módulos desligados para a empresa (org) de um usuário. Service-role com
// filtro explícito pelo id do usuário. Fail-open: se a leitura falhar, nada é
// bloqueado (desligar módulo é personalização, não controle de segurança; o
// acesso continua protegido por login e assinatura).

export async function getModulosDesativados(userId: string): Promise<string[]> {
  try {
    const svc = getServerSupabase();
    const { data: profile } = await svc.from('profiles').select('org_id').eq('id', userId).maybeSingle();
    if (!profile?.org_id) return [];
    const { data: org } = await svc.from('orgs').select('org_settings').eq('id', profile.org_id).maybeSingle();
    return lerDesativados(org?.org_settings);
  } catch {
    return [];
  }
}

export async function moduloBloqueado(userId: string, moduloId: string): Promise<boolean> {
  return (await getModulosDesativados(userId)).includes(moduloId);
}
