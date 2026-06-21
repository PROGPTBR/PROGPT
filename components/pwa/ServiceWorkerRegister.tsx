'use client';

import { useEffect } from 'react';

// Registers the PWA service worker on the client. Fail-soft: any error
// (unsupported browser, blocked SW) is swallowed — the app works regardless.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }
    const onLoad = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    };
    window.addEventListener('load', onLoad);
    return () => window.removeEventListener('load', onLoad);
  }, []);
  return null;
}
