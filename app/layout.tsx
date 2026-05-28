import type { Metadata } from 'next';
import { Inter, Outfit } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { CookieConsent } from '@/components/legal/CookieConsent';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
// Outfit is the 2B Supply brand typeface (used on 2bsupply.com.br). Loaded
// for the landing and any MD3-styled page; the rest of the app keeps Inter.
const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-outfit',
});

export const metadata: Metadata = {
  title: 'PROGPT · IA de procurement pra gestores brasileiros',
  description:
    'A IA de Strategic Sourcing da 2B Supply: chat especialista + 7 assistentes (RFP, Kraljic, Porter, Negociação, ABC, Financeiro, Perfil) que entregam .docx e .xlsx prontos. Free pra sempre · Pro R$ 99/mês.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${inter.variable} ${outfit.variable}`}
    >
      <body>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          {children}
          <Toaster />
          <CookieConsent />
        </ThemeProvider>
      </body>
    </html>
  );
}
