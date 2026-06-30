import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { listProcesses } from '@/lib/proc2pay/process';
import { isPro } from '@/lib/billing/subscription';
import { aliasForUser } from '@/lib/proc2pay/inbound-alias';
import { Header } from '../login/header';
import { ProcessHub } from '@/components/proc2pay/ProcessHub';

export const dynamic = 'force-dynamic';

export default async function Proc2PayPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/proc2pay');

  const [processes, pro] = await Promise.all([listProcesses(user.id), isPro(user.id)]);
  const inboundAlias = aliasForUser(user.id);

  return (
    <>
      <Header />
      <div className="min-h-screen bg-background text-foreground font-outfit antialiased">
        <main className="mx-auto max-w-4xl px-6 pt-24 pb-16">
          <ProcessHub initialProcesses={processes} isPro={pro} inboundAlias={inboundAlias} />
        </main>
      </div>
    </>
  );
}
