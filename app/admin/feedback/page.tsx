import { requireAdmin, NotAdmin } from '@/lib/auth';
import { notFound } from 'next/navigation';
import { FeedbackRoot } from '@/components/admin/FeedbackRoot';

export const dynamic = 'force-dynamic';

export default async function AdminFeedbackPage() {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof NotAdmin) notFound();
    throw err;
  }
  return <FeedbackRoot />;
}
