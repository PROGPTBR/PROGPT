import { getPlans } from '@/lib/billing/planos';
import { getCurrentUser } from '@/lib/auth';
import { LandingClient } from './landing-client';

// Landing pública. Server component fino: busca os planos reais (mesma fonte
// da aba /planos — tabela `plans`) + estado de login, e entrega pro
// <LandingClient/>, que carrega toda a interatividade (PWA redirect,
// reveal-on-scroll, navbar). A seção "Planos" do início reusa o MESMO
// componente <PricingTable/> da aba /planos, então ficam idênticas.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [plans, user] = await Promise.all([getPlans(), getCurrentUser()]);
  return <LandingClient plans={plans} authed={!!user} />;
}
