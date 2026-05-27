import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { getAccountFootprint } from '@/lib/account';
import { AccountDeleteForm } from '@/components/account/AccountDeleteForm';

export const dynamic = 'force-dynamic';

export default async function AccountDeletePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/account/delete');

  const footprint = await getAccountFootprint(user.id);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/chat"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Voltar
          </Link>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-6 py-12">
        <AccountDeleteForm email={user.email ?? ''} footprint={footprint} />
      </main>
    </div>
  );
}
