'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CreditCard, LogOut, Shield, UserCircle } from 'lucide-react';

import { supabaseBrowser } from '@/lib/db/supabase-browser';

// Menu da conta no canto superior direito, ao lado do botão de tema
// (sub-projeto 72). Substitui a linha com o e-mail que ficava no rodapé da
// barra lateral do chat: aqui aparece só o ícone com a inicial — o e-mail
// fica DENTRO do menu, para não ficar exposto na tela (compartilhamento de
// tela, apresentação para o time).
//
// O tema não entra no menu: o botão de tema fica logo ao lado.

export function UserMenu() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [isStaff, setIsStaff] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sb = supabaseBrowser();
    sb.auth.getUser().then(async ({ data }) => {
      const u = data.user;
      setEmail(u?.email ?? null);
      if (!u) return;
      const { data: profile } = await sb.from('profiles').select('role').eq('id', u.id).maybeSingle();
      // Staff (admin + gestor) veem o atalho da área admin.
      const role = (profile as { role?: string } | null)?.role ?? 'user';
      setIsStaff(role === 'admin' || role === 'gestor');
    });
  }, []);

  // Fecha ao clicar fora ou apertar Esc.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
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
    await supabaseBrowser().auth.signOut();
    router.refresh();
    router.push('/login');
  }

  const itemCls =
    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground/80 transition-colors hover:bg-accent hover:text-foreground';

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        data-tour="conta"
        onClick={() => setOpen((v) => !v)}
        aria-label="Minha conta"
        title="Minha conta"
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-sm font-semibold text-black shadow-sm transition hover:brightness-110"
      >
        {initial}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-60 rounded-xl border border-border bg-card p-1.5 shadow-panel dark:ring-1 dark:ring-white/10"
        >
          <div className="px-3 pb-2 pt-1.5">
            <div className="text-[11px] text-muted-foreground">Conectado como</div>
            <div className="truncate text-sm font-medium text-foreground" title={email}>
              {email}
            </div>
          </div>
          <div className="my-1 h-px bg-border" />
          <Link href="/profile" role="menuitem" className={itemCls} onClick={() => setOpen(false)}>
            <UserCircle className="h-4 w-4" aria-hidden="true" />
            <span>Meu perfil</span>
          </Link>
          <Link href="/account/billing" role="menuitem" className={itemCls} onClick={() => setOpen(false)}>
            <CreditCard className="h-4 w-4" aria-hidden="true" />
            <span>Assinatura</span>
          </Link>
          {isStaff && (
            <Link href="/admin" role="menuitem" className={itemCls} onClick={() => setOpen(false)}>
              <Shield className="h-4 w-4" aria-hidden="true" />
              <span>Admin</span>
            </Link>
          )}
          <div className="my-1 h-px bg-border" />
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span>Sair</span>
          </button>
        </div>
      )}
    </div>
  );
}
