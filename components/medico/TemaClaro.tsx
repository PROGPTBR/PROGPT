'use client';

import { useEffect } from 'react';

// Tema branco fixo da Área Médica (sub-projeto 108). O resto do sistema
// abre escuro por padrão; aqui a tela é sempre clara, sem mexer na preferência
// guardada do usuário (quem é da equipe continua com o tema dele no sistema
// de compras). O <script> tira o escuro antes de a tela ser desenhada; o
// efeito segura enquanto a Área Médica está aberta e devolve ao sair.

const TIRAR_ESCURO = `document.documentElement.classList.remove('dark');document.documentElement.style.colorScheme='light';`;

export function TemaClaro() {
  useEffect(() => {
    const raiz = document.documentElement;
    const eraEscuro = raiz.classList.contains('dark') || window.localStorage.getItem('theme') !== 'light';
    const clarear = () => {
      if (raiz.classList.contains('dark')) raiz.classList.remove('dark');
      if (raiz.style.colorScheme !== 'light') raiz.style.colorScheme = 'light';
    };
    clarear();
    const vigia = new MutationObserver(clarear);
    vigia.observe(raiz, { attributes: true, attributeFilter: ['class', 'style'] });
    return () => {
      vigia.disconnect();
      if (eraEscuro) {
        raiz.classList.add('dark');
        raiz.style.colorScheme = 'dark';
      }
    };
  }, []);

  return <script dangerouslySetInnerHTML={{ __html: TIRAR_ESCURO }} />;
}
