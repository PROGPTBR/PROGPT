import { notFound } from 'next/navigation';
import { UpdatesAdmin } from '@/components/admin/UpdatesAdmin';
import { NotAdmin, requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AdminUpdatesPage() {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof NotAdmin) notFound();
    throw error;
  }

  return <UpdatesAdmin />;
}
