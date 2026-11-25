import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { requireUser, NotAuthenticated } from '@/lib/auth';
import { usuarioComAreaMedica } from '@/lib/medico/acesso-servidor';
import { Guia } from '@/components/medico/Guia';
import { ShellDoMedico } from '@/components/medico/ShellDoMedico';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Como usar | Área Médica' };

// Guia de uso da Área Médica (sub-projeto 115): o vídeo e o passo a passo,
// na linguagem de quem nunca usou um sistema. Imprime como PDF.
export default async function GuiaPage() {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof NotAuthenticated) redirect('/medicos?next=%2Farea-medica%2Fguia');
    throw err;
  }
  if (!(await usuarioComAreaMedica(user))) notFound();
  return (
    <ShellDoMedico>
      <Guia />
    </ShellDoMedico>
  );
}
