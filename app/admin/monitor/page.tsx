import { MonitorDashboard } from '@/components/admin/MonitorDashboard';

export const dynamic = 'force-dynamic';

// Monitoramento — o layout /admin já gateia staff (admin + gestor). Os dados
// vêm de GET /api/admin/monitor (também staff-gated). Client-side pra permitir
// troca de período e export CSV sem recarregar a página.
export default function AdminMonitorPage() {
  return <MonitorDashboard />;
}
