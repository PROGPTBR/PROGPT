'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { supabaseBrowser } from '@/lib/db/supabase-browser';

export function UserRow() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const sb = supabaseBrowser();
    sb.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  if (!email) return null;

  const initial = email[0]?.toUpperCase() ?? '?';

  async function handleLogout() {
    const sb = supabaseBrowser();
    await sb.auth.signOut();
    router.refresh();
    router.push('/login');
  }

  return (
    <div className="flex items-center gap-2 p-3 border-t border-border">
      <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold shrink-0">
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <div className="truncate text-sm">{email}</div>
      </div>
      <button
        type="button"
        onClick={handleLogout}
        aria-label="Sair"
        className="text-muted-foreground hover:text-foreground transition-colors"
        title="Sair"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
