import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { CookieConsent } from '@/components/legal/CookieConsent';
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister';
import './globals.css';

// Inter is the single typeface across the whole app (headings + body + UI),
// matching the modern design language ported from the finance-insights-hub
// reference. The legacy `font-outfit` utility now also resolves to Inter
// (see tailwind.config.ts) so existing markup keeps rendering correctly.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'PROGPT · IA de procurement pra gestores brasileiros',
  description:
    'A IA de Strategic Sourcing da 2BSUPPLY: chat especialista + 7 assistentes (RFP, Kraljic, Porter, Negociação, ABC, Financeiro, Perfil) que entregam .docx e .xlsx prontos. Free pra sempre · Pro R$ 127,99/mês.',
  manifest: '/manifest.webmanifest',
  applicationName: 'PROGPT',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PROGPT',
  },
  icons: {
    icon: '/icon-192.png',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0f1a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={inter.variable}
    >
      <body>
        {/* Dark premium é o tema padrão do PROGPT (paleta cyan→azul do logo).
            O modo claro fica disponível via o toggle no header — sem
            enableSystem para o cliente escolher explicitamente. */}
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <Toaster />
          <CookieConsent />
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}
