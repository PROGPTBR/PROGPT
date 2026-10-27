// NOTIFICAÇÕES DO CHAT (02/10/2026) — service worker SÓ de push.
// Não tem "fetch": não guarda nada em cache nem muda como o app carrega (a
// vigia de versão continua valendo, ver src/lib/versaoApp.ts).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {
    d = { corpo: e.data ? e.data.text() : "" };
  }
  e.waitUntil(
    self.registration.showNotification(d.titulo || "Nova mensagem", {
      body: d.corpo || "",
      icon: "/android-icon-192x192.png",
      badge: "/android-icon-96x96.png",
      tag: d.conversa || "chat",
      renotify: true,
      data: { conversa: d.conversa || null },
    }),
  );
});

// Tocar na notificação: abre o sistema (ou traz para frente) já na conversa.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const conversa = e.notification.data && e.notification.data.conversa;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((abertas) => {
      for (const c of abertas) {
        if ("focus" in c) {
          c.postMessage({ tipo: "abrir-chat", conversa });
          return c.focus();
        }
      }
      return self.clients.openWindow(conversa ? `/?chat=${conversa}` : "/");
    }),
  );
});
