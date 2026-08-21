'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type BillingStatusResponse = {
  status?: string | null;
  accessGranted?: boolean;
  message?: string;
};

type PageState =
  | 'checking'
  | 'confirmed'
  | 'pending'
  | 'error'
  | 'failed';

const CHECK_INTERVAL = 2500;
const MAX_ATTEMPTS = 48; // aproximadamente 2 minutos

export default function BillingConfirmandoPage() {
  const router = useRouter();

  const [pageState, setPageState] = useState<PageState>('checking');
  const [message, setMessage] = useState(
    'Estamos aguardando a confirmação do seu pagamento.',
  );

  const attemptsRef = useRef(0);
  const stoppedRef = useRef(false);

  const checkStatus = useCallback(async () => {
    if (stoppedRef.current) return;

    try {
      attemptsRef.current += 1;

      const response = await fetch('/api/billing/status', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
        },
      });

      if (response.status === 401) {
        stoppedRef.current = true;
        router.replace('/login');
        return;
      }

      const data = (await response.json()) as BillingStatusResponse;

      if (!response.ok) {
        throw new Error(
          data.message || 'Não foi possível consultar o pagamento.',
        );
      }

      const status = data.status?.toLowerCase() ?? '';

      if (data.accessGranted || status === 'active') {
        stoppedRef.current = true;
        setPageState('confirmed');
        setMessage('Pagamento confirmado! Seu acesso foi liberado.');

        window.setTimeout(() => {
          router.replace('/chat');
        }, 1800);

        return;
      }

      if (
        status === 'cancelled' ||
        status === 'canceled' ||
        status === 'expired' ||
        status === 'past_due'
      ) {
        stoppedRef.current = true;
        setPageState('failed');
        setMessage(
          'Não conseguimos confirmar o pagamento. Verifique os dados e tente novamente.',
        );
        return;
      }

      if (attemptsRef.current >= MAX_ATTEMPTS) {
        stoppedRef.current = true;
        setPageState('pending');
        setMessage(
          'A confirmação está levando um pouco mais de tempo. Você pode verificar novamente.',
        );
        return;
      }

      setPageState('checking');
    } catch (error) {
      console.error('[billing-confirmacao] erro ao consultar status:', error);

      if (attemptsRef.current >= MAX_ATTEMPTS) {
        stoppedRef.current = true;
        setPageState('error');
        setMessage(
          'Não conseguimos consultar o pagamento agora. Tente verificar novamente.',
        );
      }
    }
  }, [router]);

  useEffect(() => {
    stoppedRef.current = false;

    void checkStatus();

    const interval = window.setInterval(() => {
      if (!stoppedRef.current) {
        void checkStatus();
      }
    }, CHECK_INTERVAL);

    return () => {
      stoppedRef.current = true;
      window.clearInterval(interval);
    };
  }, [checkStatus]);

  function handleRetry() {
    attemptsRef.current = 0;
    stoppedRef.current = false;
    setPageState('checking');
    setMessage('Estamos aguardando a confirmação do seu pagamento.');

    void checkStatus();
  }

  const confirmed = pageState === 'confirmed';
  const checking = pageState === 'checking';

  return (
    <main className="min-h-[calc(100vh-80px)] bg-[#050b15] px-4 py-16 text-white">
      <div className="mx-auto flex min-h-[65vh] max-w-3xl items-center justify-center">
        <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-[#101a2b] p-8 text-center shadow-2xl md:p-12">
          <div
            className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full ${
              confirmed
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-sky-500/10 text-sky-400'
            }`}
          >
            {confirmed ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-10 w-10"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  d="M20 6 9 17l-5-5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : checking ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-10 w-10 animate-spin"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  d="M21 12a9 9 0 1 1-2.64-6.36"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-10 w-10"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="9" />
                <path
                  d="M12 8v4m0 4h.01"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>

          <span className="mb-3 inline-block text-xs font-semibold uppercase tracking-[0.18em] text-sky-400">
            Assinatura PROGPT
          </span>

          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            {confirmed
              ? 'Pagamento confirmado!'
              : checking
                ? 'Confirmando seu pagamento'
                : 'Pagamento em processamento'}
          </h1>

          <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-slate-400 md:text-base">
            {message}
          </p>

          {checking && (
            <div className="mt-8 rounded-2xl border border-white/10 bg-[#0a1321] px-5 py-4">
              <div className="flex items-center justify-center gap-3 text-sm text-slate-300">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-sky-400" />
                </span>

                Verificando confirmação com o Asaas...
              </div>

              <p className="mt-2 text-xs text-slate-500">
                Não feche esta página. Isso normalmente leva apenas alguns
                segundos.
              </p>
            </div>
          )}

          {confirmed && (
            <div className="mt-8 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4">
              <p className="text-sm font-medium text-emerald-400">
                Seu acesso ao PROGPT está liberado.
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Você será direcionado automaticamente para o chat.
              </p>
            </div>
          )}

          {(pageState === 'pending' ||
            pageState === 'error' ||
            pageState === 'failed') && (
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={handleRetry}
                className="rounded-xl bg-sky-500 px-6 py-3 text-sm font-semibold text-black transition hover:bg-sky-400"
              >
                VERIFICAR NOVAMENTE
              </button>

              <button
                type="button"
                onClick={() =>
                  router.push('/account/billing/checkout?plan=pf-73')
                }
                className="rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                VOLTAR AO PAGAMENTO
              </button>
            </div>
          )}

          {confirmed && (
            <button
              type="button"
              onClick={() => router.replace('/chat')}
              className="mt-7 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-500 px-7 py-3 text-sm font-bold text-black transition hover:opacity-90"
            >
              ACESSAR O PROGPT
            </button>
          )}

          <div className="mt-8 border-t border-white/10 pt-6">
            <p className="text-xs text-slate-500">
              Não atualize nem realize uma nova assinatura enquanto estivermos
              confirmando este pagamento.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}