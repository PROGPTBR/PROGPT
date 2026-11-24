import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { getProfile, requireUser, NotAuthenticated } from '@/lib/auth';
import { AppShell } from '@/components/layout/AppShell';
import { AreaMedicaRoot } from '@/components/medico/AreaMedicaRoot';
import { soAreaMedica } from '@/lib/medico/acesso';
import { usuarioComAreaMedica } from '@/lib/medico/acesso-servidor';
import { ShellDoMedico } from '@/components/medico/ShellDoMedico';
import { estadoCompleto } from '@/lib/medico/integracoes';
import { hojeEmBrasilia } from '@/lib/vitrine/datas';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Área Médica' };

// Área Médica (sub-projeto 100): área particular. Quem não foi liberado
// recebe 404, como se a tela não existisse.
export default async function AreaMedicaPage({ searchParams }: { searchParams: { aba?: string; banco?: string; motivo?: string } }) {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof NotAuthenticated) redirect('/login?next=/area-medica');
    throw err;
  }
  if (!(await usuarioComAreaMedica(user))) notFound();
  // Entrou com a senha temporária: antes de tudo, cria a senha dele.
  if (user.user_metadata?.trocar_senha === true) redirect('/area-medica/primeira-senha');

  const perfil = await getProfile(user.id).catch(() => null);
  const conteudo = (
    <AreaMedicaRoot
      estadoInicial={await estadoCompleto(user.id)}
      hoje={hojeEmBrasilia()}
      abaInicial={searchParams.aba}
      contaDeMedico={soAreaMedica(perfil?.area_medica)}
      aviso={
        searchParams.banco === 'conectado'
          ? { ok: true, texto: 'Conta do BTG ligada. Os próximos créditos e débitos entram sozinhos.' }
          : searchParams.banco === 'erro'
            ? { ok: false, texto: (searchParams.motivo ?? 'Não foi possível ligar a conta do BTG.').slice(0, 200) }
            : undefined
      }
    />
  );

  // A conta de médico só tem a Área Médica: moldura própria, sem o menu do resto do sistema.
  if (soAreaMedica(perfil?.area_medica)) return <ShellDoMedico>{conteudo}</ShellDoMedico>;
  return <AppShell back={{ href: '/chat', label: 'Voltar ao chat' }}>{conteudo}</AppShell>;
}
