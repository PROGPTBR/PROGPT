import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { requireUser, NotAuthenticated } from '@/lib/auth';
import { FormularioDeInicio } from '@/components/medico/FormularioDeInicio';
import { ShellDoMedico } from '@/components/medico/ShellDoMedico';
import { usuarioComAreaMedica } from '@/lib/medico/acesso-servidor';
import { estadoCompleto } from '@/lib/medico/integracoes';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Para começar | Área Médica' };

// Formulário de início (sub-projeto 117): o que só o médico sabe, em passos.
export default async function InicioPage() {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof NotAuthenticated) redirect('/medicos?next=%2Farea-medica%2Finicio');
    throw err;
  }
  if (!(await usuarioComAreaMedica(user))) notFound();
  if (user.user_metadata?.trocar_senha === true) redirect('/area-medica/primeira-senha');
  return (
    <ShellDoMedico>
      <FormularioDeInicio estadoInicial={await estadoCompleto(user.id)} />
    </ShellDoMedico>
  );
}
