'use client';

import { useEffect } from 'react';

// Registers the PWA service worker on the client. Fail-soft: any error
// (unsupported browser, blocked SW) is swallowed — the app works regardless.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }
    let controllerChangeHandler: (() => void) | null = null;

    const register = () => {
      const hadController = navigator.serviceWorker.controller !== null;

      if (hadController) {
        controllerChangeHandler = () => {
          const reloadKey = 'progpt_sw_v2_reloaded';
          if (window.sessionStorage.getItem(reloadKey)) return;
          window.sessionStorage.setItem(reloadKey, '1');
          window.location.reload();
        };
        navigator.serviceWorker.addEventListener('controllerchange', controllerChangeHandler);
      }

      navigator.serviceWorker
        .register('/sw.js', { updateViaCache: 'none' })
        .then((registration) => registration.update())
        .catch(() => {});
    };

    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register, { once: true });
    }

    return () => {
      window.removeEventListener('load', register);
      if (controllerChangeHandler) {
        navigator.serviceWorker.removeEventListener('controllerchange', controllerChangeHandler);
      }
    };
  }, []);
  return null;
}
