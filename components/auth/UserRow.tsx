'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CreditCard, LogOut, Moon, Shield, Sun, Trash2, UserCircle } from 'lucide-react';
import { useTheme } from 'next-themes';
import { supabaseBrowser } from '@/lib/db/supabase-browser';

export function UserRow({ collapsed = false }: { collapsed?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = !mounted || resolvedTheme !== 'light';

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

  if (collapsed) {
    return (
      <div className="border-t border-border flex flex-col items-center gap-2 py-3">
        <Link
          href="/profile"
          title={email}
          className="h-9 w-9 rounded-full bg-brand-gradient text-black flex items-center justify-center text-xs font-semibold shrink-0 hover:brightness-110 transition"
        >
          {initial}
        </Link>
        <button
          type="button"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          aria-label={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
          title={isDark ? 'Tema claro' : 'Tema escuro'}
          className="h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          {isDark ? (
            <Sun className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Moon className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          onClick={handleLogout}
          aria-label="Sair"
          title="Sair"
          className="h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-border">
      <Link
        href="/profile"
        className="flex items-center gap-2 px-4 py-2.5 text-base text-muted-foreground hover:bg-brand/10 hover:text-foreground transition-colors"
      >
        <UserCircle className="h-4 w-4" aria-hidden="true" />
        <span>Meu perfil</span>
      </Link>
      {isAdmin && (
        <Link
          href="/admin"
          className="flex items-center gap-2 px-4 py-2.5 text-base text-muted-foreground hover:bg-brand/10 hover:text-foreground transition-colors"
        >
          <Shield className="h-4 w-4" aria-hidden="true" />
          <span>Admin</span>
        </Link>
      )}
      <Link
        href="/account/billing"
        className="flex items-center gap-2 px-4 py-2.5 text-base text-muted-foreground hover:bg-brand/10 hover:text-foreground transition-colors"
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
        <div className="h-8 w-8 rounded-full bg-brand-gradient text-black flex items-center justify-center text-xs font-semibold shrink-0">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="truncate text-sm text-foreground">{email}</div>
        </div>
        <button
          type="button"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          aria-label={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
          title={isDark ? 'Tema claro' : 'Tema escuro'}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {isDark ? (
            <Sun className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Moon className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
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
