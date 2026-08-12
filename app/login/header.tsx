'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { LogIn, Moon, Sun, UserPlus, MessageSquare, Mail,  Phone } from 'lucide-react';
import { useTheme } from 'next-themes';
import { supabaseBrowser } from '@/lib/db/supabase-browser';
import { LEGAL_CONTACT_EMAIL,  LEGAL_CONTACT_PHONE,  LEGAL_CONTACT_PHONE_TEL} from '@/lib/legal/constants';


// Deslogado: navegação da landing (marketing). Logado: navegação do APP — o
// usuário autenticado circula pelas áreas internas, não pelas seções da
// landing. O botão à direita continua levando ao chat.
const PUBLIC_LINKS = [
  { href: '/', label: 'Início' },
  { href: '/recursos', label: 'Recursos' },
  { href: '/planos', label: 'Planos' },
  { href: '/faq', label: 'FAQ' },
];

const APP_LINKS = [
  { href: '/assistants', label: 'Assistentes' },
  { href: '/fornecedores', label: 'Fornecedores' },
  { href: '/painel', label: 'Painel' },
  { href: '/prompts', label: 'Prompts' },
  { href: '/account/billing', label: 'Assinatura' },
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
  // Enquanto o estado de auth carrega (authed === null) mostramos os links
  // públicos (estado do SSR); ao confirmar login, troca para os do app.
  const navLinks = authed ? APP_LINKS : PUBLIC_LINKS;

 
return (
  <header className="fixed inset-x-0 top-0 z-50">

<div className="flex h-8 items-center justify-end gap-8 bg-[#060b14] border-b border-border/50 px-6 md:px-12 text-xs text-muted-foreground">

  <a
    href={`mailto:${LEGAL_CONTACT_EMAIL}`}
    className="inline-flex items-center gap-2 hover:text-white transition-colors"
  >
    <Mail className="h-3.5 w-3.5" />
    <span>{LEGAL_CONTACT_EMAIL}</span>
  </a>

  <a
    href={`tel:${LEGAL_CONTACT_PHONE_TEL}`}
    className="inline-flex items-center gap-2 hover:text-white transition-colors"
  >
    <Phone className="h-3.5 w-3.5" />
    <span>{LEGAL_CONTACT_PHONE}</span>
  </a>

</div>

    {/* Menu */}
    <nav
      id="landing-navbar"
      className="dark bg-[#0a0f1a]/85 w-full transition-all duration-300 backdrop-blur-md border-b border-border py-3 sm:py-4 px-4 sm:px-6 md:px-12 flex justify-between items-center gap-2 text-foreground"
    >
      <Link href={authed ? '/chat' : '/'} className="flex items-center">
        <BrandLogo size="md" priority />
      </Link>

      <div className="menu-topo hidden md:flex space-x-1 items-center text-sm font-medium text-muted-foreground">
        {navLinks.map((link) => (
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

  </header>
);
}


