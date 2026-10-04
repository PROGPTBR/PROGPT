'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, HelpCircle, Mail, MessageCircle, Search, X } from 'lucide-react';

import { LEGAL_CONTACT_EMAIL, LEGAL_CONTACT_PHONE_TEL } from '@/lib/legal/constants';
import { buscarFaq } from '@/lib/support/faq';

// Suporte flutuante (sub-projeto 71). Antes era um bloco no rodapé da barra
// lateral do chat, que ficava em cima do histórico de conversas e só existia
// no chat. Agora é um botão discreto no canto inferior direito de toda tela
// logada: abre o FAQ de uso (com busca) e o WhatsApp da 2B Supply.

const WHATSAPP_SUPORTE = `https://wa.me/${LEGAL_CONTACT_PHONE_TEL.replace(/\D/g, '')}?text=${encodeURIComponent(
  'Olá! Preciso de ajuda com o PROGPT.',
)}`;

export function SupportWidget({
  elevado = false,
}: {
  /** No chat, sobe acima da caixa de mensagem para não cobrir o botão de enviar. */
  elevado?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const painelRef = useRef<HTMLDivElement>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const buscaRef = useRef<HTMLInputElement>(null);

  const secoes = useMemo(() => buscarFaq(busca), [busca]);

  useEffect(() => {
    if (!aberto) return;
    buscaRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAberto(false);
        botaoRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (painelRef.current?.contains(alvo) || botaoRef.current?.contains(alvo)) return;
      setAberto(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [aberto]);

  const posicao = elevado ? 'bottom-28 lg:bottom-6' : 'bottom-5';

  return (
    <>
      {aberto && (
        <div
          ref={painelRef}
          role="dialog"
          aria-label="Suporte"
          className={`print-hide fixed right-4 z-50 flex max-h-[min(36rem,calc(100dvh-8rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl ${
            elevado ? 'bottom-44 lg:bottom-[5.5rem]' : 'bottom-[5.25rem]'
          }`}
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Suporte</h2>
              <p className="text-xs text-muted-foreground">Perguntas frequentes sobre o PROGPT</p>
            </div>
            <button
              type="button"
              onClick={() => setAberto(false)}
              aria-label="Fechar suporte"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="border-b border-border px-3 py-2">
            <label className="relative block">
              <span className="sr-only">Buscar nas perguntas frequentes</span>
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                ref={buscaRef}
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Busque sua dúvida (ex.: anexar, cancelar)"
                className="h-9 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
              />
            </label>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
            {secoes.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                Nenhuma pergunta encontrada. Fale com a gente pelo WhatsApp logo abaixo.
              </p>
            ) : (
              secoes.map((secao) => (
                <section key={secao.id} className="mb-2">
                  <h3 className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {secao.titulo}
                  </h3>
                  {secao.itens.map((item) => (
                    <details key={item.id} className="group rounded-lg open:bg-muted/50">
                      <summary className="flex cursor-pointer list-none items-start justify-between gap-2 rounded-lg px-2 py-2 text-sm hover:bg-accent [&::-webkit-details-marker]:hidden">
                        <span>{item.pergunta}</span>
                        <ChevronDown
                          className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                          aria-hidden="true"
                        />
                      </summary>
                      <p className="px-2 pb-3 text-sm leading-relaxed text-muted-foreground">{item.resposta}</p>
                    </details>
                  ))}
                </section>
              ))
            )}
          </div>

          <div className="space-y-2 border-t border-border p-3">
            <a
              href={WHATSAPP_SUPORTE}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              Falar no WhatsApp
            </a>
            <a
              href={`mailto:${LEGAL_CONTACT_EMAIL}?subject=${encodeURIComponent('Suporte PROGPT')}`}
              className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Mail className="h-3.5 w-3.5" aria-hidden="true" />
              {LEGAL_CONTACT_EMAIL}
            </a>
          </div>
        </div>
      )}

      <button
        ref={botaoRef}
        type="button"
        data-tour="suporte"
        onClick={() => setAberto((v) => !v)}
        aria-label={aberto ? 'Fechar suporte' : 'Suporte'}
        aria-expanded={aberto}
        title="Suporte"
        className={`print-hide fixed right-4 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-brand shadow-lg transition-transform hover:scale-105 ${posicao}`}
      >
        {aberto ? <X className="h-5 w-5" aria-hidden="true" /> : <HelpCircle className="h-6 w-6" aria-hidden="true" />}
      </button>
    </>
  );
}
