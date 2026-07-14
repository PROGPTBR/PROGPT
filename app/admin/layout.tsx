import { notFound, redirect } from 'next/navigation';
import { requireStaff, NotStaff, NotAuthenticated } from '@/lib/auth';
import { AdminSidebar } from '@/components/admin/AdminSidebar';

export const dynamic = 'force-dynamic';

// Área admin liberada pra STAFF (admin + gestor). Itens admin-only (Faturamento,
// papéis) são escondidos/gateados individualmente pelo papel. Hoje só há admins,
// então na prática é admin-only ("neste momento só adm").
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let role: 'admin' | 'gestor' = 'admin';
  try {
    const { profile } = await requireStaff();
    role = profile.role === 'gestor' ? 'gestor' : 'admin';
  } catch (err) {
    if (err instanceof NotAuthenticated) redirect('/login?next=/admin');
    if (err instanceof NotStaff) notFound();
    throw err;
  }
  return (
    <div className="flex min-h-screen bg-background text-foreground font-outfit antialiased">
      <AdminSidebar role={role} />
      <main className="flex-1 p-8 overflow-x-auto">{children}</main>
    </div>
  );
}
