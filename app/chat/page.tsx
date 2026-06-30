//import { redirect } from 'next/navigation';
//import { getCurrentUser } from '@/lib/auth';
//import { hasAccess } from '@/lib/billing/subscription';
//import { ChatRoot } from '@/components/chat/ChatRoot';

//export const dynamic = 'force-dynamic';

//export default async function ChatPage() {
  //const user = await getCurrentUser();
 // if (!user) redirect('/login?next=/chat');
  // Novos usuários precisam cadastrar cartão (trial). Admin + contas antigas
  // passam (grandfathered). Sem acesso → tela de cadastro do cartão.
 // if (!(await hasAccess(user.id, user.created_at))) redirect('/assinar');
  //return <ChatRoot />;
//}


import { ChatRoot } from '@/components/chat/ChatRoot';

export default function ChatPage() {
  return <ChatRoot />;
}
