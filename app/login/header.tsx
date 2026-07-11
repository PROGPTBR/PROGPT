'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { LogIn, Moon, Sun, UserPlus, MessageSquare } from 'lucide-react';
import { useTheme } from 'next-themes';
import { supabaseBrowser } from '@/lib/db/supabase-browser';

const NAV_LINKS = [
  { href: '/', label: 'Início' },
  { href: '/recursos', label: 'Recursos' },
  { href: '/planos', label: 'Planos' },
  { href: '/faq', label: 'FAQ' },
];

export function Header() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    setMounted(true);
    // Header consciente de login: deslogado mostra Entrar/Cadastre-se,
    // logado mostra "Ir para o chat" (padrão das grandes plataformas).
    let active = true;
    supabaseBrowser()
      .auth.getUser()
      .then(({ data }) => {
        if (active) setAuthed(!!data.user);
      })
      .catch(() => {
        if (active) setAuthed(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const isDark = !mounted || resolvedTheme !== 'light';

  return (
    <nav
      id="landing-navbar"
      className="dark bg-[#0a0f1a]/85 fixed top-0 left-0 w-full z-50 transition-all duration-300 backdrop-blur-md border-b border-border py-3 sm:py-4 px-4 sm:px-6 md:px-12 flex justify-between items-center gap-2 text-foreground"
    >
      <Link href="/" className="flex items-center">
        <BrandLogo size="md" priority />
      </Link>

      <div className="menu-topo hidden md:flex space-x-1 items-center text-sm font-medium text-muted-foreground">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`py-2 px-4 rounded-full transition-all duration-300 ${
              pathname === link.href
                ? 'bg-muted text-foreground'
                : 'hover:bg-muted hover:text-foreground'
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          aria-label={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
          title={isDark ? 'Tema claro' : 'Tema escuro'}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          {isDark ? (
            <Sun className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Moon className="h-4 w-4" aria-hidden="true" />
          )}
        </button>

        {authed ? (
          <Link
            href="/chat"
            className="inline-flex items-center justify-center gap-2 bg-brand-gradient text-black px-4 sm:px-5 h-9 rounded-full text-sm font-semibold hover:brightness-110 active:scale-95 transition-all duration-300"
          >
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Voltar para o chat</span>
            <span className="sm:hidden">Chat</span>
          </Link>
        ) : (
          <>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 h-9 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Entrar
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-1.5 bg-brand-gradient text-black px-4 sm:px-5 h-9 rounded-full text-sm font-semibold hover:brightness-110 active:scale-95 transition-all duration-300"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Cadastre-se</span>
              <span className="sm:hidden">Criar</span>
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
