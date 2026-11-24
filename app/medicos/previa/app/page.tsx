import { notFound } from 'next/navigation';

import { AreaMedicaRoot } from '@/components/medico/AreaMedicaRoot';
import { ShellDoMedico } from '@/components/medico/ShellDoMedico';
import { estadoDeExemplo } from '@/lib/medico/exemplo';
import { hojeEmBrasilia } from '@/lib/vitrine/datas';

export const dynamic = 'force-dynamic';

// Prévia LOCAL do app com dados de exemplo em memória, para ver e ajustar o
// visual sem login. Só existe em desenvolvimento: em produção responde 404.
export default function PreviaDoApp({ searchParams }: { searchParams: { aba?: string } }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const hoje = hojeEmBrasilia();
  return (
    <ShellDoMedico>
      <AreaMedicaRoot
        contaDeMedico
        hoje={hoje}
        abaInicial={searchParams.aba}
        estadoInicial={{ ...estadoDeExemplo(hoje), integracoes: { whatsapp: true, email_envio: true, email_entrada: null, super_admin: false, btg: true } }}
      />
    </ShellDoMedico>
  );
}
