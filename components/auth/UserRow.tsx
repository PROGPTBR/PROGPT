'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronUp,
  CreditCard,
  LogOut,
  Moon,
  Shield,
  Sun,
  UserCircle,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { supabaseBrowser } from '@/lib/db/supabase-browser';

export function UserRow({ collapsed = false }: { collapsed?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
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
      // Staff (admin + gestor) veem o link da área admin.
      const role = (profile as { role?: string } | null)?.role ?? 'user';
      setIsAdmin(role === 'admin' || role === 'gestor');
    });
  }, []);

  // Fecha o menu ao clicar fora ou apertar Esc.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!email) return null;

  const initial = email[0]?.toUpperCase() ?? '?';

  async function handleLogout() {
    const sb = supabaseBrowser();
    await sb.auth.signOut();
    router.refresh();
    router.push('/login');
  }

  const itemCls =
    'flex items-center gap-2 px-3 py-2 text-sm rounded-lg text-foreground/80 hover:bg-accent hover:text-foreground transition-colors';

  // Conteúdo do menu da conta — Perfil, Admin, Assinatura, tema e sair vivem
  // TODOS aqui dentro, abertos a partir do ícone/avatar do usuário.
  const menu = (
    <div
      role="menu"
      className="absolute z-50 rounded-xl border border-border bg-card p-1.5 shadow-panel dark:ring-1 dark:ring-white/10"
      style={
        collapsed
          ? { bottom: 8, left: '100%', marginLeft: 8, width: 200 }
          : { bottom: '100%', left: 8, right: 8, marginBottom: 8 }
      }
    >
      <Link href="/profile" role="menuitem" className={itemCls} onClick={() => setOpen(false)}>
        <UserCircle className="h-4 w-4" aria-hidden="true" />
        <span>Meu perfil</span>
      </Link>
      {isAdmin && (
        <Link href="/admin" role="menuitem" className={itemCls} onClick={() => setOpen(false)}>
          <Shield className="h-4 w-4" aria-hidden="true" />
          <span>Admin</span>
        </Link>
      )}
      <Link
        href="/account/billing"
        role="menuitem"
        className={itemCls}
        onClick={() => setOpen(false)}
      >
        <CreditCard className="h-4 w-4" aria-hidden="true" />
        <span>Assinatura</span>
      </Link>
      <div className="my-1 h-px bg-border" />
      <button
        type="button"
        role="menuitem"
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
        className={`${itemCls} w-full text-left`}
      >
        {isDark ? (
          <Sun className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Moon className="h-4 w-4" aria-hidden="true" />
        )}
        <span>{isDark ? 'Tema claro' : 'Tema escuro'}</span>
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={handleLogout}
        className="flex w-full items-center gap-2 px-3 py-2 text-sm rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
        <span>Sair</span>
      </button>
    </div>
  );

  if (collapsed) {
    return (
      <div ref={rootRef} className="relative border-t border-border flex flex-col items-center py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          title={email}
          aria-haspopup="menu"
          aria-expanded={open}
          className="h-9 w-9 rounded-full bg-brand-gradient text-black flex items-center justify-center text-xs font-semibold shrink-0 hover:brightness-110 transition"
        >
          {initial}
        </button>
        {open && menu}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative border-t border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-left hover:bg-accent transition-colors"
      >
        <div className="h-8 w-8 rounded-full bg-brand-gradient text-black flex items-center justify-center text-xs font-semibold shrink-0">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="truncate text-sm text-foreground">{email}</div>
        </div>
        <ChevronUp
          className={`h-4 w-4 text-muted-foreground transition-transform ${open ? '' : 'rotate-180'}`}
          aria-hidden="true"
        />
      </button>
      {open && menu}
    </div>
  );
}
