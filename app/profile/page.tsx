import { getServerSupabase } from '@/lib/db/supabase';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { ProfileLogoUpload } from '@/components/profile/ProfileLogoUpload';
import { ProfileCompanyForm } from '@/components/profile/ProfileCompanyForm';
import { ProfileCategoriesList } from '@/components/profile/ProfileCategoriesList';
import { BrandLogo } from '@/components/brand/BrandLogo';

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
  subscription?.plan?.toLowerCase() === 'free'
    ? 'Período de teste'
    : subscription?.status === 'active'
    ? 'Ativo'
    : subscription?.status === 'canceled'
    ? 'Cancelado'
    : subscription?.status === 'past_due'
    ? 'Pagamento pendente'
    : subscription?.status === 'trialing'
    ? 'Período de teste'
    : subscription?.status ?? '-';

    const statusColor =
  subscription?.plan?.toLowerCase() === 'free'
    ? 'text-foreground'
    : subscription?.status === 'active'
    ? 'text-green-500'
    : subscription?.status === 'canceled'
    ? 'text-red-500'
    : 'text-yellow-500';

    const daysLeft = subscription?.current_period_end
  ? Math.max(
      0,
      Math.ceil(
        (new Date(subscription.current_period_end).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24)
      )
    )
  : null;


  return (
    <div className="relative min-h-screen bg-background text-foreground font-outfit antialiased overflow-x-hidden">
      {/* Decorative cyan glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-1/4 h-96 w-96 rounded-full bg-brand/8 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 -left-20 h-80 w-80 rounded-full bg-brand/5 blur-3xl"
      />

      {/* Header */}
      <header className="relative z-10 border-b border-border bg-card/40 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/chat" className="inline-flex items-center">
            <BrandLogo size="md" priority />
          </Link>
          <Link
            href="/chat"
            className="inline-flex items-center gap-1.5 text-base text-muted-foreground hover:text-brand transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Voltar para o chat
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10 max-w-3xl mx-auto px-6 py-10 space-y-10">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">
            Meu perfil <span className="text-brand">.</span>
          </h1>
          <p className="text-base text-muted-foreground mt-1.5">
            Logado como{' '}
            <span className="font-medium text-brand">
              {user.email ?? user.id}
            </span>
          </p>
        </div>
           <section className="space-y-3">
          <div>
        <h2 className="text-foreground font-medium text-2xl"> Seu Plano</h2>
            <p className="text-base text-muted-foreground mt-1 leading-relaxed">
              Confira os detalhes da sua assinatura.
            </p>
</div>


<div className="rounded-xl border border-border bg-card/40 p-5" >
  <div className="space-y-2 text-base">
    <p>
      <span className="text-muted-foreground">Plano:</span>{' '}
      <span className="text-brand font-medium">
        {subscription?.plan ?? 'Free'}
      </span>
    </p>

 <p>
  <span className="text-muted-foreground">Status:</span>{' '}
  <span className={`font-medium ${statusColor}`}>
    {statusLabel}
  </span>
</p>

{subscription?.plan?.toLowerCase() === 'free' && daysLeft !== null && (
  <p className="text-sm text-green-500">
    Seu período de teste termina em {daysLeft} dia(s).
  </p>
)}
  </div>
</div>
</section>
        <section className="space-y-3">
          <div>
            <h2 className="text-foreground font-medium text-2xl">Foto do Perfil</h2>
            <p className="text-base text-muted-foreground mt-1 leading-relaxed">
              Este logo é incluído nos documentos gerados (RFP .docx e planilha
              de cotação .xlsx). PNG ou JPG, até 2 MB.
            </p>
          </div>
          <ProfileLogoUpload />
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-foreground font-medium text-2xl">Meus Dados</h2>
            <p className="text-base text-muted-foreground mt-1 leading-relaxed">
              Estes campos são incluídos automaticamente nos documentos gerados —
              apresentação do RFP, banner da planilha de cotação e cláusulas de
              termos.
            </p>
          </div>
          <ProfileCompanyForm />
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-foreground font-medium text-2xl">Minhas categorias</h2>
            <p className="text-base text-muted-foreground mt-1 leading-relaxed">
              Perfis de categoria que você cadastrou. Use no chat (seletor
              acima do campo de mensagem) ou no botão &quot;Iniciar de um
              Perfil&quot; dentro dos assistentes RFP / Kraljic / Porter /
              ABC para pré-popular os campos.
            </p>
          </div>
          <ProfileCategoriesList />
        </section>
      </main>
    </div>
  );
}
