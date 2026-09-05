'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LogIn,
  Moon,
  Sun,
  UserPlus,
  Mail,
  Phone,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { supabaseBrowser } from '@/lib/db/supabase-browser';
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_CONTACT_PHONE,
  LEGAL_CONTACT_PHONE_TEL,
} from '@/lib/legal/constants';

/*
|--------------------------------------------------------------------------
| Links públicos
|--------------------------------------------------------------------------
*/

const PUBLIC_LINKS = [
  { href: '/', label: 'Início' },
  { href: '/recursos', label: 'Recursos' },
  { href: '/planos', label: 'Planos' },
  { href: '/faq', label: 'FAQ' },
];

/*
|--------------------------------------------------------------------------
| Links da área logada
|--------------------------------------------------------------------------
*/

const APP_LINKS = [
  { href: '/assistants', label: 'Assistentes' },
  { href: '/fornecedores', label: 'Fornecedores' },
  { href: '/painel', label: 'Painel' },
  { href: '/prompts', label: 'Prompts' },
  { href: '/account/billing', label: 'Assinatura' },
];

export function Header() {
  const pathname = usePathname();

  const {
    resolvedTheme,
    setTheme,
  } = useTheme();

  const [mounted, setMounted] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [scrolled, setScrolled] = useState(false);

  /*
  |--------------------------------------------------------------------------
  | Detecta montagem + scroll
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    setMounted(true);

    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll, {
      passive: true,
    });

    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  /*
  |--------------------------------------------------------------------------
  | Verifica autenticação
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    let active = true;

    supabaseBrowser()
      .auth.getUser()
      .then(({ data }) => {
        if (active) {
          setAuthed(!!data.user);
        }
      })
      .catch(() => {
        if (active) {
          setAuthed(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  /*
  |--------------------------------------------------------------------------
  | Tema
  |--------------------------------------------------------------------------
  */

  const isDark = !mounted || resolvedTheme !== 'light';

  /*
  |--------------------------------------------------------------------------
  | Links conforme autenticação
  |--------------------------------------------------------------------------
  */

  const navLinks = authed ? APP_LINKS : PUBLIC_LINKS;

  /*
  |--------------------------------------------------------------------------
  | Verifica link ativo
  |--------------------------------------------------------------------------
  */

  const isLinkActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <header>
      {/* ================================================================
          BARRA SUPERIOR
      ================================================================= */}

     <div
  className={`
    flex
    flex-col
    md:flex-row
    items-center
    md:justify-end
    gap-1
    md:gap-8
    px-6
    md:px-12
    py-2
    md:py-0
    md:h-8
    text-xs
    border-b
    transition-colors
    duration-300

    ${
      isDark
        ? `
          bg-[#060b14]
          border-white/10
          text-slate-400
        `
        : `
          bg-[#edeeee]
          border-slate-200
          text-slate-500
        `
    }
  `}
>
        {/* E-mail */}

        <a
          href={`mailto:${LEGAL_CONTACT_EMAIL}`}
          className={`
            inline-flex
            items-center
            gap-2
            transition-colors
            duration-200

            ${
              isDark
                ? 'hover:text-white'
                : 'hover:text-[#0b1f44]'
            }
          `}
        >
          <Mail className="h-3.5 w-3.5" />

          <span>
            {LEGAL_CONTACT_EMAIL}
          </span>
        </a>

        {/* Telefone */}

        <a
          href={`tel:${LEGAL_CONTACT_PHONE_TEL}`}
          className={`
            inline-flex
            items-center
            gap-2
            transition-colors
            duration-200

            ${
              isDark
                ? 'hover:text-white'
                : 'hover:text-[#0b1f44]'
            }
          `}
        >
          <Phone className="h-3.5 w-3.5" />

          <span>
            {LEGAL_CONTACT_PHONE}
          </span>
        </a>
      </div>

      {/* ================================================================
          MENU PRINCIPAL
      ================================================================= */}

      <nav
        id="landing-navbar"
        className={`
          w-full
          z-50
          border-b
          backdrop-blur-md
          transition-all
          duration-300

          py-3
          sm:py-4

          px-4
          sm:px-6
          md:px-12

          flex
          items-center
          justify-between
          gap-2

          ${
            isDark
              ? `
                bg-[#0a0f1a]/95
                border-white/10
                text-white
              `
              : `
                bg-white/95
                border-slate-200
                text-[#0b1f44]
              `
          }

          ${
            scrolled
              ? 'fixed inset-x-0 top-0 shadow-md'
              : 'relative'
          }
        `}
      >
        {/* ============================================================
            LOGO
        ============================================================= */}

        <Link
          href={authed ? '/chat' : '/'}
          className="flex items-center shrink-0"
          aria-label="2B Supply - início"
        >
          <Image
            src={
              isDark
                ? '/progpt-logo-white.png'
                : '/progpt-logo-dark.png'
            }
            alt="2B Supply"
            width={168}
            height={48}
            priority
            className="
              h-auto
              w-[145px]
              sm:w-[168px]
              object-contain
            "
          />
        </Link>

        {/* ============================================================
            LINKS
        ============================================================= */}

        <div
          className={`
            menu-topo
            hidden
            md:flex
            items-center
            space-x-1
            text-sm
            font-medium

            ${
              isDark
                ? 'text-slate-400'
                : 'text-slate-600'
            }
          `}
        >
          {navLinks.map((link) => {
            const active = isLinkActive(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`
                  py-2
                  px-4
                  rounded-full
                  transition-all
                  duration-300

                  ${
                    active
                      ? isDark
                        ? `
                          bg-white/10
                          text-white
                        `
                        : `
                          bg-slate-100
                          text-[#0b1f44]
                        `
                      : isDark
                        ? `
                          hover:bg-white/10
                          hover:text-white
                        `
                        : `
                          hover:bg-slate-100
                          hover:text-[#0b1f44]
                        `
                  }
                `}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* ============================================================
            AÇÕES DO LADO DIREITO
        ============================================================= */}

        <div className="flex items-center gap-1.5 sm:gap-2">

          {/* ==========================================================
              BOTÃO DE TEMA
          =========================================================== */}

          <button
            type="button"
            onClick={() =>
              setTheme(isDark ? 'light' : 'dark')
            }
            aria-label={
              isDark
                ? 'Mudar para tema claro'
                : 'Mudar para tema escuro'
            }
            title={
              isDark
                ? 'Tema claro'
                : 'Tema escuro'
            }
            className={`
              inline-flex
              h-10
              w-10
              items-center
              justify-center
              rounded-full
              border
              transition-all
              duration-300

              ${
                isDark
                  ? `
                    bg-transparent
                    border-white/10
                    text-slate-400
                    hover:text-white
                    hover:bg-white/10
                  `
                  : `
                    bg-white
                    border-slate-200
                    text-slate-600
                    hover:text-[#0b1f44]
                    hover:bg-slate-50
                  `
              }
            `}
          >
            {isDark ? (
              <Sun
                className="h-4 w-4"
                aria-hidden="true"
              />
            ) : (
              <Moon
                className="h-4 w-4"
                aria-hidden="true"
              />
            )}
          </button>

          {/* ==========================================================
              BOTÕES PARA USUÁRIO DESLOGADO
          =========================================================== */}

          {authed === false && (
            <>
              {/* Entrar */}

              <Link
                href="/login"
                className={`
                  inline-flex
                  items-center
                  justify-center
                  gap-1.5

                  px-3
                  sm:px-4

                  h-9

                  rounded-full

                  text-sm
                  font-medium

                  transition-all
                  duration-300

                  ${
                    isDark
                      ? `
                        text-slate-400
                        hover:text-white
                        hover:bg-white/10
                      `
                      : `
                        text-slate-600
                        hover:text-[#0b1f44]
                        hover:bg-slate-100
                      `
                  }
                `}
              >
                <LogIn
                  className="h-4 w-4"
                  aria-hidden="true"
                />

                Entrar
              </Link>

              {/* Cadastre-se */}

              <Link
                href="/signup"
                className="
                  inline-flex
                  items-center
                  justify-center
                  gap-1.5

                  bg-brand-gradient
                  text-black

                  px-4
                  sm:px-5

                  h-9

                  rounded-full

                  text-sm
                  font-semibold

                  hover:brightness-110
                  active:scale-95

                  transition-all
                  duration-300
                "
              >
                <UserPlus
                  className="h-4 w-4"
                  aria-hidden="true"
                />

                <span className="hidden sm:inline">
                  Cadastre-se
                </span>

                <span className="sm:hidden">
                  Criar
                </span>
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}