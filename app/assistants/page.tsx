import { AssistantsHub } from '@/components/assistants/AssistantsHub';
import { getCurrentUser, getProfile } from '@/lib/auth';
import { getModulosDesativados } from '@/lib/modulos/servidor';

export const dynamic = 'force-dynamic';

export default async function AssistantsHubPage() {
  const user = await getCurrentUser();
  const profile = user ? await getProfile(user.id) : null;
  const isAdmin = profile?.role === 'admin';
  const modulosDesativados = user ? await getModulosDesativados(user.id) : [];

  return <AssistantsHub isAdmin={isAdmin} modulosDesativados={modulosDesativados} />;
}
