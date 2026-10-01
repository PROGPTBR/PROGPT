import { getCurrentUser } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';
import { ChatRoot } from '@/components/chat/ChatRoot';

export const dynamic = 'force-dynamic';

// O gate de sessão/assinatura é do middleware.ts + app/chat/layout.tsx. Aqui
// só decidimos se o tour de primeiro acesso entra — resolvido no servidor
// para a tela não piscar o tour depois de já ter desenhado o chat.
export default async function ChatPage() {
  const user = await getCurrentUser();

  let showTour = false;

  if (user) {
    const { data } = await getServerSupabase()
      .from('profiles')
      .select('onboarding_tour_completed_at')
      .eq('id', user.id)
      .maybeSingle();

    showTour = !data?.onboarding_tour_completed_at;
  }

  return <ChatRoot showTour={showTour} />;
}
