import { getPlans } from '@/lib/billing/planos';
import { LandingClient } from './landing-client';

// Landing pública. Server component fino: busca os planos reais (mesma fonte
// da aba /planos — tabela `plans`) e entrega pro <LandingClient/>, que carrega
// toda a interatividade (PWA redirect, reveal-on-scroll, navbar). Assim o
// "Início" apresenta exatamente os planos que existem em /planos.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const plans = await getPlans();
  return <LandingClient plans={plans} />;
}
