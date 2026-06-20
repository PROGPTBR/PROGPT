'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { CircleHelp } from 'lucide-react';

const NAV_LINKS = [
  { href: '/recursos', label: 'Recursos' },
  { href: '/planos', label: 'Planos' },
  { href: '/faq', label: 'FAQ' },
];

export function Header() {
  const pathname = usePathname();

  return (
    <nav
      id="landing-navbar"
      className="bg-background/80 border-bot-1 fixed top-0 left-0 w-full z-50 transition-all duration-300 backdrop-blur-md border-b border-border py-4 px-6 md:px-12 flex justify-between items-center"
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

      <Link
        href="https://wa.me/5521999792912?text=Preciso%20do%20suporte%20com%20a%20IA%202BSUPPLY" target='_blank'
        className="inline-flex items-center justify-center bg-brand-gradient text-black px-5 h-9 rounded-full text-sm font-medium hover:opacity-90 active:scale-95 transition-all duration-300"
      >
        <CircleHelp className="h-4 w-4 mr-2" />
        Suporte
      </Link>
    </nav>
  );
}