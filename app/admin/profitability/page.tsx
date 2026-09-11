import { notFound } from 'next/navigation';

import { requireAdmin, NotAdmin } from '@/lib/auth';
import { ProfitabilityDashboard } from '@/components/admin/ProfitabilityDashboard';

export const dynamic = 'force-dynamic';

export default async function AdminProfitabilityPage() {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof NotAdmin) notFound();
    throw err;
  }

  return <ProfitabilityDashboard />;
}