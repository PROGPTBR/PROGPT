import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Header } from '../login/header';
import { getCurrentUser } from '@/lib/auth';
import { PricingTable } from '@/components/billing/PricingTable';
import { getPlans } from '@/lib/billing/planos';

export const dynamic = 'force-dynamic';

export default async function PricingPage({
  searchParams
}: {
  searchParams?: {
    expired?: string;
  };
}) {
  const user = await getCurrentUser();

  // Novo fluxo (cartão no cadastro): quem está logado já é cliente — a página
  // de planos só faz sentido para visitante não-logado. Logado ⇒ vai pro app.
  if (user) {
    redirect('/chat');
  }

  // Daqui pra baixo só chega visitante anônimo (o redirect acima cobre logado).
  const pro = false;
  const userPlanSlug = null;
  const profile = null;

  const plans = await getPlans();

  const trialExpired =
    searchParams?.expired === 'true';

    console.log('TRIAL EXPIRED:', trialExpired);
    
  return (
    <>
      <Header />

      <div className="min-h-screen bg-background text-foreground">
        <main className="max-w-7xl mx-auto px-6 py-12">
          <div className="max-w-7xl mx-auto px-6 py-16 flex items-center justify-between">
            <Link
              href={user ? '/login' : '/'}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-brand transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Voltar
            </Link>

            {!user && (
              <Link
                href="/login?next=/pricing"
                className="text-xs text-brand hover:text-brand/80 transition-colors"
              >
                Entrar →
              </Link>
            )}
          </div>

          <section
            id="planos"
            className="px-6 md:px-12 max-w-7xl mx-auto border-border"
          >
            <PricingTable
              authed={!!user}
              isPro={pro}
              plans={plans}
              userPlanSlug={userPlanSlug}
              profile={profile}
              trialExpired={trialExpired}
            />
          </section>
        </main>
      </div>
    </>
  );
}