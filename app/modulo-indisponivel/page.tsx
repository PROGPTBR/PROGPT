import Link from 'next/link';
import { Lock } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { MODULO_IDS, rotuloDoModulo } from '@/lib/modulos/catalogo';
import { LEGAL_CONTACT_EMAIL } from '@/lib/legal/constants';

export const dynamic = 'force-dynamic';

// Destino do middleware quando a tela pertence a um módulo desligado para a
// empresa do usuário (orgs.org_settings.modulos_desativados).
export default function ModuloIndisponivelPage({
  searchParams,
}: {
  searchParams: { m?: string };
}) {
  const id = searchParams.m && MODULO_IDS.has(searchParams.m) ? searchParams.m : null;
  const nome = id ? rotuloDoModulo(id) : 'Este recurso';

  return (
    <AppShell width="narrow" back={{ href: '/chat', label: 'Voltar ao chat' }}>
      <div className="mx-auto mt-10 max-w-lg rounded-2xl border bg-card p-8 text-center">
        <span className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-muted">
          <Lock className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        </span>
        <h1 className="text-xl font-semibold tracking-tight">{nome} não está no plano da sua empresa</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Os módulos disponíveis são definidos para cada empresa. Para incluir este, fale com o
          responsável pela conta ou com o comercial em{' '}
          <span className="select-all font-medium text-foreground">{LEGAL_CONTACT_EMAIL}</span>.
        </p>
        <Link
          href="/assistants"
          className="mt-6 inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Ver os assistentes disponíveis
        </Link>
      </div>
    </AppShell>
  );
}
