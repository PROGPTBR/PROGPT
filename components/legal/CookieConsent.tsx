'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Cookie } from 'lucide-react';

// Sub-projeto 28 — banner de consentimento de cookies (LGPD).
//
// Mostra na primeira visita; persiste escolha em localStorage. Hoje só
// temos cookies essenciais — banner serve principalmente pra
// transparência e cumprimento formal LGPD/CDC. Quando adicionarmos
// analytics (sub-projeto futuro), a escolha aqui controla load do script.

const STORAGE_KEY = 'procurementgpt_cookie_consent_v1';

type Choice = 'all' | 'essential-only';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      if (!existing) setVisible(true);
    } catch {
      // localStorage indisponível (modo privado em alguns browsers) —
      // não mostra banner, mas também não falha.
    }
  }, []);

  function persist(choice: Choice) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ choice, at: new Date().toISOString() }),
      );
    } catch {
      // ignore
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Consentimento de cookies"
      className="fixed bottom-4 inset-x-4 md:bottom-6 md:left-6 md:right-auto md:max-w-md z-40 rounded-2xl border border-border bg-card shadow-2xl p-5 space-y-4 backdrop-blur-md"
    >
      <div className="flex items-start gap-3">
        <Cookie className="h-5 w-5 text-brand mt-0.5 flex-shrink-0" aria-hidden />
        <div className="space-y-1">
          <div className="font-semibold text-base text-white">Cookies & privacidade</div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Usamos cookies essenciais pra manter você logado e proteger
            o serviço contra abuso. Não usamos cookies de marketing nem
            rastreamos você fora da Plataforma.{' '}
            <Link
              href="/cookies"
              className="text-brand hover:text-brand/80 underline underline-offset-2"
            >
              Saiba mais
            </Link>
            .
          </p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={() => persist('essential-only')}
          className="flex-1 rounded-full text-white border border-border bg-background hover:bg-accent h-9 text-xs font-medium transition-colors"
        >
          Apenas essenciais
        </button>
        <button
          type="button"
          onClick={() => persist('all')}
          className="flex-1 rounded-full bg-brand-gradient text-black hover:bg-brand/90 h-9 text-xs font-semibold transition-colors active:scale-95"
        >
          Aceitar tudo
        </button>
      </div>
    </div>
  );
}
