import { AssistantsHub } from '@/components/assistants/AssistantsHub';
import { getCurrentUser, getProfile } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AssistantsHubPage() {
  const user = await getCurrentUser();
  const profile = user ? await getProfile(user.id) : null;
  const isAdmin = profile?.role === 'admin';

  return <AssistantsHub isAdmin={isAdmin} />;
}
