'use client';

import { useEffect, useRef } from 'react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { useTheme } from 'next-themes';

// Sub-projeto 25 — wrapper do Turnstile com tema sincronizado com next-themes.
//
// Lê NEXT_PUBLIC_TURNSTILE_SITE_KEY (literal — não dá pra usar requireEnv
// em client, ver O-que-evitar no CLAUDE.md).
//
// Captcha DESLIGADO até a chave real ser configurada: sem
// NEXT_PUBLIC_TURNSTILE_SITE_KEY não renderiza nada (evita o box feio
// "Somente para teste") e auto-emite um token placeholder pra liberar o
// submit. O server pula a verificação enquanto TURNSTILE_SECRET_KEY também
// não está setado. Setar as DUAS chaves reativa o captcha sozinho.

type Props = {
  onVerify: (token: string | null) => void;
};

export function TurnstileWidget({ onVerify }: Props) {
  const { resolvedTheme } = useTheme();
  const ref = useRef<TurnstileInstance | null>(null);

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  // Sem chave real → libera o submit com token placeholder (server ignora).
  useEffect(() => {
    if (!siteKey) onVerify('no-captcha');
  }, [siteKey, onVerify]);

  if (!siteKey) return null;

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
