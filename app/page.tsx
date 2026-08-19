import { getPlans } from '@/lib/billing/planos';
import { getCurrentUser } from '@/lib/auth';
import { NovaLanding } from './nova/landing-client';

export const metadata = {
  title: 'PROGPT — Inteligência para Suprimentos',
  description: 'A plataforma de IA feita para profissionais de Suprimentos.',
};

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [plans, user] = await Promise.all([getPlans(), getCurrentUser()]);
  return <NovaLanding plans={plans} authed={Boolean(user)} />;
}
