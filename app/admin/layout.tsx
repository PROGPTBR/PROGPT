import { notFound, redirect } from 'next/navigation';
import { requireAdmin, NotAdmin, NotAuthenticated } from '@/lib/auth';
import { AdminSidebar } from '@/components/admin/AdminSidebar';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof NotAuthenticated) redirect('/login?next=/admin');
    if (err instanceof NotAdmin) notFound();
    throw err;
  }
  return (
    <div className="brand-dark flex min-h-screen bg-[#0d0d0d] text-white font-outfit antialiased">
      <AdminSidebar />
      <main className="flex-1 p-8 overflow-x-auto">{children}</main>
    </div>
  );
}
