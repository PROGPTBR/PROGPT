import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth';
import { PrimeiraSenha } from '@/components/medico/PrimeiraSenha';
import { ShellDoMedico } from '@/components/medico/ShellDoMedico';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Crie a sua senha | Área Médica' };

// Primeiro acesso com senha temporária (sub-projeto 106).
export default async function PrimeiraSenhaPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/medicos?next=%2Farea-medica');
  if (user.user_metadata?.trocar_senha !== true) redirect('/area-medica');
  return (
    <ShellDoMedico>
      <PrimeiraSenha />
    </ShellDoMedico>
  );
}
