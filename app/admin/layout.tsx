import { notFound, redirect } from 'next/navigation';
import { requireStaff, NotStaff, NotAuthenticated } from '@/lib/auth';
import { AdminSidebar } from '@/components/admin/AdminSidebar';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let role: 'admin' | 'gestor' = 'admin';
  let canViewProfitability = false;
  let isPlatformSuperAdmin = false;

  try {
    const { profile, user } = await requireStaff();

    role = profile.role === 'gestor' ? 'gestor' : 'admin';
    isPlatformSuperAdmin = profile.super_admin === true;

    // E-mail autorizado fica somente na variável de ambiente do servidor.
    const profitabilityAllowedEmail =
      process.env.PROFITABILITY_ALLOWED_EMAIL
        ?.trim()
        .toLowerCase();

    const userEmail = user.email?.trim().toLowerCase();

    canViewProfitability =
      role === 'admin' &&
      !!profitabilityAllowedEmail &&
      !!userEmail &&
      userEmail === profitabilityAllowedEmail;
  } catch (err) {
    if (err instanceof NotAuthenticated) {
      redirect('/login?next=/admin');
    }

    if (err instanceof NotStaff) {
      notFound();
    }

    throw err;
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground font-outfit antialiased">
      <AdminSidebar
        role={role}
        canViewProfitability={canViewProfitability}
        isPlatformSuperAdmin={isPlatformSuperAdmin}
      />

      <main className="flex-1 p-8 overflow-x-auto">
        {children}
      </main>
    </div>
  );
}