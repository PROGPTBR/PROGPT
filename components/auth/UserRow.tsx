'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CreditCard, LogOut, Shield, Trash2, UserCircle } from 'lucide-react';
import { supabaseBrowser } from '@/lib/db/supabase-browser';

export function UserRow() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const sb = supabaseBrowser();
    sb.auth.getUser().then(async ({ data }) => {
      const u = data.user;
      setEmail(u?.email ?? null);
      if (!u) return;
      const { data: profile } = await sb
        .from('profiles')
        .select('role')
        .eq('id', u.id)
        .maybeSingle();
      setIsAdmin(
        ((profile as { role?: string } | null)?.role ?? 'user') === 'admin',
      );
    });
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
    <div className="border-t border-border">
      <Link
        href="/profile"
        className="flex items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      >
        <UserCircle className="h-4 w-4" aria-hidden="true" />
        <span>Meu perfil</span>
      </Link>
      {isAdmin && (
        <Link
          href="/admin"
          className="flex items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <Shield className="h-4 w-4" aria-hidden="true" />
          <span>Admin</span>
        </Link>
      )}
      <Link
        href="/account/billing"
        className="flex items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      >
        <CreditCard className="h-4 w-4" aria-hidden="true" />
        <span>Assinatura</span>
      </Link>
      <Link
        href="/account/delete"
        className="flex items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-colors"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        <span>Excluir minha conta</span>
      </Link>
      <div className="flex items-center gap-3 p-4 border-t border-border">
        <div className="h-8 w-8 rounded-full bg-brand text-black flex items-center justify-center text-xs font-semibold shrink-0">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="truncate text-sm text-foreground/80">{email}</div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          aria-label="Sair"
          className="text-muted-foreground hover:text-red-500 transition-colors"
          title="Sair"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
