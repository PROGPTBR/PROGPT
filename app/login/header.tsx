'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { CircleHelp, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

const NAV_LINKS = [
  { href: '/recursos', label: 'Recursos' },
  { href: '/planos', label: 'Planos' },
  { href: '/faq', label: 'FAQ' },
];

export function Header() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = !mounted || resolvedTheme !== 'light';

  return (
    <nav
      id="landing-navbar"
      className="dark bg-[#0a0f1a]/85 fixed top-0 left-0 w-full z-50 transition-all duration-300 backdrop-blur-md border-b border-border py-4 px-6 md:px-12 flex justify-between items-center text-foreground"
    >
      <Link href="/" className="flex items-center">
        <BrandLogo size="md" priority />
      </Link>

      <div className="menu-topo hidden md:flex space-x-2 items-center text-sm font-medium text-muted-foreground">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`py-2 px-5 rounded-full transition-all duration-300 ${
              pathname === link.href
                ? 'bg-muted text-foreground'
                : 'hover:bg-muted hover:text-foreground'
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-2">
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
        <Link
          href="https://wa.me/5521999792912?text=Preciso%20do%20suporte%20com%20a%20IA%202BSUPPLY"
          target="_blank"
          className="inline-flex items-center justify-center bg-brand-gradient text-black px-5 h-9 rounded-full text-sm font-medium hover:brightness-110 active:scale-95 transition-all duration-300"
        >
          <CircleHelp className="h-4 w-4 mr-2" />
          Suporte
        </Link>
      </div>
    </nav>
  );
}
