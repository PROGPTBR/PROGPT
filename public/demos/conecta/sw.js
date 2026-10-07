// ConectaPROGPT — demonstração: SEM service worker.
// A demonstração roda dentro de outro produto, na mesma origem; um service
// worker aqui passaria a interceptar e cachear as páginas dele. Este arquivo
// só existe para que um registro antigo (se houver) se desfaça sozinho.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(self.registration.unregister());
});
