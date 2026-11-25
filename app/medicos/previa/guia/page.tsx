import { notFound } from 'next/navigation';

import { Guia } from '@/components/medico/Guia';
import { ShellDoMedico } from '@/components/medico/ShellDoMedico';

export const dynamic = 'force-dynamic';

// Prévia LOCAL do guia, sem login: serve para gerar o PDF e conferir o visual.
export default function PreviaDoGuia() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <ShellDoMedico>
      <Guia />
    </ShellDoMedico>
  );
}
