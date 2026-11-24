import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { requireUser, NotAuthenticated } from '@/lib/auth';
import { AppShell } from '@/components/layout/AppShell';
import { AreaMedicaRoot } from '@/components/medico/AreaMedicaRoot';
import { usuarioComAreaMedica } from '@/lib/medico/acesso-servidor';
import { carregarEstado } from '@/lib/medico/service';
import { hojeEmBrasilia } from '@/lib/vitrine/datas';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Área Médica | 2BSUPPLY.IA' };

// Área Médica (sub-projeto 100): área particular. Quem não foi liberado
// recebe 404, como se a tela não existisse.
export default async function AreaMedicaPage() {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof NotAuthenticated) redirect('/login?next=/area-medica');
    throw err;
  }
  if (!(await usuarioComAreaMedica(user))) notFound();

  return (
    <AppShell back={{ href: '/chat', label: 'Voltar ao chat' }}>
      <AreaMedicaRoot estadoInicial={await carregarEstado(user.id)} hoje={hojeEmBrasilia()} />
    </AppShell>
  );
}
