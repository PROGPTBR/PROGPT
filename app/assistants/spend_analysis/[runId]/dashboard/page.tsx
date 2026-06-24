import { SpendDashboard } from '@/components/assistants/spend/SpendDashboard';

export const dynamic = 'force-dynamic';

export default function SpendDashboardPage({ params }: { params: { runId: string } }) {
  return <SpendDashboard runId={params.runId} />;
}
