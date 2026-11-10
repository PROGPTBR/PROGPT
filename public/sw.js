// PROGPT service worker v2.
//
// Mantém a instalação como PWA, mas deliberadamente NÃO intercepta
// navegações nem /_next/static. O cache offline v1 podia restaurar HTML de
// um deploy antigo apontando para hashes de CSS/JS que já não existiam no
// container novo, deixando toda a aplicação sem estilo.
const CACHE = 'progpt-v2';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('progpt-') && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Sem handler de `fetch`: o navegador e o Next.js controlam o cache de cada
// resposta conforme Cache-Control. Isso impede mistura de assets entre builds.
