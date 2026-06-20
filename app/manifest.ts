import type { MetadataRoute } from 'next';

// PWA manifest — served at /manifest.webmanifest by Next.js. Makes PROGPT
// installable as an app on Android (install prompt) and iOS (Add to Home
// Screen), launching standalone (no browser chrome).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PROGPT — IA de Procurement',
    short_name: 'PROGPT',
    description:
      'Chat especialista + assistentes de Strategic Sourcing da 2B Supply.',
    start_url: '/chat',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#0a0f1a',
    theme_color: '#0a0f1a',
    lang: 'pt-BR',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
