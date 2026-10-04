'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { ProductTour } from '@/components/onboarding/ProductTour';
import { TOUR_STEPS } from '@/lib/onboarding/tour-steps';
import {
  TOUR_EVENT,
  clearTourState,
  readTourState,
  writeTourState,
  type TourState,
} from '@/lib/onboarding/tour-state';

// Condutor do tour entre páginas (sub-projeto 70). Montado no layout raiz,
// sobrevive às trocas de rota: lê o passo atual do tour-state, leva o usuário
// até a tela do passo e só então mostra o cartão.
//
// Se a navegação não chega na tela do passo (sessão expirou e o middleware
// mandou para o login, assinatura vencida e caiu em /planos), o tour é
// abandonado em vez de ficar empurrando de volta para a mesma rota.

const LIMITE_NAVEGACAO_MS = 10_000;

export function useTourAtivo(): boolean {
  const [ativo, setAtivo] = useState(false);
  useEffect(() => {
    const sync = () => setAtivo(readTourState() !== null);
    sync();
    window.addEventListener(TOUR_EVENT, sync);
    return () => window.removeEventListener(TOUR_EVENT, sync);
  }, []);
  return ativo;
}

export function TourHost() {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<TourState | null>(null);
  const navegouPara = useRef<number | null>(null);

  useEffect(() => {
    const sync = () => setState(readTourState());
    sync();
    window.addEventListener(TOUR_EVENT, sync);
    return () => window.removeEventListener(TOUR_EVENT, sync);
  }, []);

  const step = state ? TOUR_STEPS[state.index] : undefined;
  const naTela = !!step && pathname === step.route;

  const encerrar = useCallback(() => {
    clearTourState();
    // Concluir e pular são decisões do cliente: o tour não volta no próximo
    // login (nem em outro computador). Fail-soft — errar aqui só faz o tour
    // reaparecer.
    fetch('/api/account/onboarding-tour', { method: 'POST' }).catch(() => {
      /* ignore */
    });
  }, []);

  // Estado inválido (índice fora do roteiro, ex.: roteiro encolheu): descarta.
  useEffect(() => {
    if (state && !step) clearTourState();
  }, [state, step]);

  // Leva até a tela do passo — uma vez por passo.
  useEffect(() => {
    if (!state || !step || naTela) return;
    if (navegouPara.current !== state.index) {
      navegouPara.current = state.index;
      router.push(step.route);
    }
    // Não chegou na tela do passo dentro do limite: desiste do tour.
    const t = setTimeout(() => clearTourState(), LIMITE_NAVEGACAO_MS);
    return () => clearTimeout(t);
  }, [state, step, naTela, router, pathname]);

  const ir = useCallback(
    (delta: number) => {
      if (!state) return;
      const index = Math.max(0, Math.min(TOUR_STEPS.length - 1, state.index + delta));
      writeTourState({ index });
    },
    [state],
  );
  const proximo = useCallback(() => ir(1), [ir]);
  const voltar = useCallback(() => ir(-1), [ir]);

  if (!state || !step) return null;

  return (
    <ProductTour
      step={step}
      index={state.index}
      total={TOUR_STEPS.length}
      navegando={!naTela}
      onNext={proximo}
      onBack={voltar}
      onFinish={encerrar}
    />
  );
}
