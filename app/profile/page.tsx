import { getServerSupabase } from '@/lib/db/supabase';
import Link from 'next/link';
import { Trash2, CreditCard, UserCircle, ImageIcon, Building2, FolderKanban } from 'lucide-react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { Header } from '../login/header';
import { BackButton } from '@/components/BackButton';
import { ProfileLogoUpload } from '@/components/profile/ProfileLogoUpload';
import { ProfileCompanyForm } from '@/components/profile/ProfileCompanyForm';
import { ProfileCategoriesList } from '@/components/profile/ProfileCategoriesList';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/profile');

  const supabase = getServerSupabase();
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  const statusLabel =
    subscription?.status === 'active'
      ? 'Ativo'
      : subscription?.status === 'trialing'
        ? 'Período de teste'
        : subscription?.status === 'past_due'
          ? 'Pagamento pendente'
          : subscription?.status === 'cancelled'
            ? 'Cancelado'
            : subscription?.status === 'expired'
              ? 'Expirado'
              : 'Free';

  const statusCls =
    subscription?.status === 'active'
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
      : subscription?.status === 'trialing'
        ? 'border-brand/40 bg-brand/10 text-brand'
        : subscription?.status === 'past_due' || subscription?.status === 'expired'
          ? 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-300'
          : 'border-border bg-muted text-muted-foreground';

  const daysLeft = subscription?.trial_end
    ? Math.max(
        0,
        Math.ceil(
          (new Date(subscription.trial_end).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24),
        ),
      )
    : null;

  return (
    <>
      <Header />
      <div className="min-h-screen bg-background text-foreground font-outfit antialiased">
        <main className="mx-auto max-w-3xl px-6 pt-24 pb-16 space-y-8">
          <BackButton />

          {/* Hero */}
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-black text-xl font-bold brand-glow">
              {(user.email?.[0] ?? '?').toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
                Meu perfil <span className="text-brand">.</span>
              </h1>
              <p className="text-sm text-muted-foreground truncate">
                {user.email ?? user.id}
              </p>
            </div>
          </div>

          {/* Plano */}
          <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-brand" aria-hidden="true" />
                <h2 className="text-base font-semibold">Seu plano</h2>
              </div>
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusCls}`}>
                {statusLabel}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Plano</div>
                <div className="mt-0.5 font-medium text-foreground capitalize">
                  {subscription?.plan ?? 'Free'}
                </div>
              </div>
              {daysLeft !== null && subscription?.status === 'trialing' && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Teste termina em</div>
                  <div className="mt-0.5 font-medium text-brand">{daysLeft} dia(s)</div>
                </div>
              )}
            </div>
            <Link
              href="/account/billing"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand/80 transition-colors"
            >
              Gerenciar assinatura →
            </Link>
          </section>

          {/* Foto / logo */}
          <ProfileSection
            icon={<ImageIcon className="h-4 w-4 text-brand" aria-hidden="true" />}
            title="Logo da empresa"
            desc="Incluído nos documentos gerados (.docx e .xlsx). PNG ou JPG, até 2 MB."
          >
            <ProfileLogoUpload />
          </ProfileSection>

          {/* Dados */}
          <ProfileSection
            icon={<Building2 className="h-4 w-4 text-brand" aria-hidden="true" />}
            title="Dados da empresa"
            desc="Usados automaticamente na capa do RFP, no banner da planilha e nas cláusulas."
          >
            <ProfileCompanyForm />
          </ProfileSection>

          {/* Categorias */}
          <ProfileSection
            icon={<FolderKanban className="h-4 w-4 text-brand" aria-hidden="true" />}
            title="Minhas categorias"
            desc={'Perfis de categoria que você cadastrou — use no chat ou em "Iniciar de um Perfil" nos assistentes.'}
          >
            <ProfileCategoriesList />
          </ProfileSection>

          {/* Conta — danger zone */}
          <section className="rounded-2xl border border-red-500/20 bg-red-500/[0.03] p-6 space-y-3">
            <div className="flex items-center gap-2">
              <UserCircle className="h-4 w-4 text-red-500" aria-hidden="true" />
              <h2 className="text-base font-semibold">Conta</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Encerrar sua conta remove permanentemente seus dados (conversas,
              execuções e perfil). Esta ação não pode ser desfeita.
            </p>
            <Link
              href="/account/delete"
              className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 text-red-600 dark:text-red-400 hover:bg-red-500/10 hover:border-red-500/50 px-4 py-2.5 text-sm font-medium transition-colors"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Excluir minha conta
            </Link>
          </section>
        </main>
      </div>
    </>
  );
}

function ProfileSection({
  icon,
  title,
  desc,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-base font-semibold">{title}</h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
      </div>
      {children}
    </section>
  );
}
