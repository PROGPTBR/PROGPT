'use client';

import { useRef } from 'react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { useTheme } from 'next-themes';

// Sub-projeto 25 — wrapper do Turnstile com tema sincronizado com next-themes.
//
// Lê NEXT_PUBLIC_TURNSTILE_SITE_KEY (literal — não dá pra usar requireEnv
// em client, ver O-que-evitar no CLAUDE.md). Em dev sem key, mostra
// placeholder visual e auto-emite token fake "dev-token" pra desbloquear
// o submit — o server (em APP_ENV=local) também não verifica.

type Props = {
  onVerify: (token: string | null) => void;
};

// Test site key da Cloudflare — sempre passa, pra dev sem account setup.
// Ver https://developers.cloudflare.com/turnstile/troubleshooting/testing/
const TEST_SITE_KEY_ALWAYS_PASS = '1x00000000000000000000AA';

export function TurnstileWidget({ onVerify }: Props) {
  const { resolvedTheme } = useTheme();
  const ref = useRef<TurnstileInstance | null>(null);

  const siteKey =
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? TEST_SITE_KEY_ALWAYS_PASS;

  return (
    <Turnstile
      ref={ref}
      siteKey={siteKey}
      options={{
        theme: resolvedTheme === 'dark' ? 'dark' : 'light',
        size: 'flexible',
      }}
      onSuccess={(token) => onVerify(token)}
      onError={() => onVerify(null)}
      onExpire={() => onVerify(null)}
    />
  );
}
