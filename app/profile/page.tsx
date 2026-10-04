import Link from 'next/link';
import { ChevronRight, CreditCard, Trash2 } from 'lucide-react';
import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth';
import { AppShell } from '@/components/layout/AppShell';
import { BackButton } from '@/components/BackButton';
import { ProfileLogoUpload } from '@/components/profile/ProfileLogoUpload';
import { ProfileCompanyForm } from '@/components/profile/ProfileCompanyForm';
import { ProfileCategoriesList } from '@/components/profile/ProfileCategoriesList';

export const dynamic = 'force-dynamic';

// Meu perfil — simplificado para clientes leigos (sub-projeto 72). A tela faz
// UMA coisa: os dados da empresa que entram nos documentos. Por isso:
//   - a seção "Seu plano" saiu (repetia a tela de Assinatura; o cancelamento
//     do período de teste, que só existia aqui, foi para lá);
//   - os passos são numerados (logo → dados) e cada um diz para que serve;
//   - assinatura e exclusão de conta viram atalhos discretos no rodapé.
export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/profile');

  return (
    <AppShell width="narrow">
      <div className="space-y-6">
        <BackButton />

        <header data-tour="perfil-topo" className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-xl font-bold text-black brand-glow">
            {(user.email?.[0] ?? '?').toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Meu perfil</h1>
            <p className="text-sm text-muted-foreground">
              Preencha uma vez: o logo e os dados da sua empresa entram sozinhos nos documentos que o PROGPT gera.
            </p>
          </div>
        </header>

        <div data-tour="perfil-logo">
          <Passo numero={1} titulo="Logo da empresa" descricao="Aparece na capa dos documentos e das planilhas. PNG ou JPG, até 2 MB.">
            <ProfileLogoUpload />
          </Passo>
        </div>

        <div data-tour="perfil-dados">
          <Passo
            numero={2}
            titulo="Dados da empresa"
            descricao="Nome, contato e apresentação usados nos documentos — por exemplo, na capa e na carta de abertura do RFP."
          >
            <ProfileCompanyForm />
          </Passo>
        </div>

        <Passo
          titulo="Minhas categorias"
          descricao='Os perfis de categoria que você já montou. Use no chat ou em "Iniciar de um Perfil" nos assistentes, sem digitar tudo de novo.'
        >
          <ProfileCategoriesList />
        </Passo>

        <nav aria-label="Outras opções da conta" className="flex flex-col gap-1 border-t border-border pt-4 sm:flex-row sm:justify-between">
          <Link
            href="/account/billing"
            className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <CreditCard className="h-4 w-4" aria-hidden="true" />
            Plano e pagamento
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href="/account/delete"
            className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Excluir minha conta
          </Link>
        </nav>
      </div>
    </AppShell>
  );
}

function Passo({
  numero,
  titulo,
  descricao,
  children,
}: {
  numero?: number;
  titulo: string;
  descricao: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        {numero !== undefined && (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/15 text-sm font-semibold text-brand">
            {numero}
          </span>
        )}
        <div className="space-y-0.5">
          <h2 className="text-base font-semibold">{titulo}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{descricao}</p>
        </div>
      </div>
      {children}
    </section>
  );
}
