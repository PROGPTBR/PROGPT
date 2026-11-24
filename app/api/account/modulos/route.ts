import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getModulosDesativados } from '@/lib/modulos/servidor';
import { usuarioComAreaMedica } from '@/lib/medico/acesso-servidor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/account/modulos: módulos desligados para a empresa de quem está
// logado. Os menus do navegador usam para esconder o que a empresa não tem.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const desativados = await getModulosDesativados(user.id);
  // A Área Médica é particular: para quem não foi liberado, o menu a trata
  // como módulo desligado (a página e as rotas conferem de novo no servidor).
  if (!desativados.includes('area_medica') && !(await usuarioComAreaMedica(user).catch(() => false))) {
    desativados.push('area_medica');
  }
  return NextResponse.json({ desativados }, { headers: { 'Cache-Control': 'private, no-store' } });
}
