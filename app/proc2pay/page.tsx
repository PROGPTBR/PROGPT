import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { listProcesses } from '@/lib/proc2pay/process';
import { isPro } from '@/lib/billing/subscription';
import { aliasForUser } from '@/lib/proc2pay/inbound-alias';
import { AppShell } from '@/components/layout/AppShell';
import { ProcessHub } from '@/components/proc2pay/ProcessHub';

export const dynamic = 'force-dynamic';

export default async function Proc2PayPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/proc2pay');

  const [processes, pro] = await Promise.all([listProcesses(user.id), isPro(user.id)]);
  const inboundAlias = aliasForUser(user.id);

  return (
    <AppShell back={{ href: '/chat', label: 'Voltar ao chat' }}>
      <ProcessHub initialProcesses={processes} isPro={pro} inboundAlias={inboundAlias} />
    </AppShell>
  );
}
