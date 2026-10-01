import { redirect } from 'next/navigation';
import { requireUser, NotAuthenticated } from '@/lib/auth';
import { AppShell } from '@/components/layout/AppShell';

export const dynamic = 'force-dynamic';

export default async function PromptsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireUser();
  } catch (err) {
    if (err instanceof NotAuthenticated) redirect('/login?next=/prompts');
    throw err;
  }
  return (
    <AppShell back={{ href: '/chat', label: 'Voltar ao chat' }}>
      {children}
    </AppShell>
  );
}
