'use client';

import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

import styles from './nova.module.css';

// Vídeo de apresentação na janela do topo da página inicial (sub-projeto 76).
// Navegador não deixa tocar som sozinho: começa mudo (com a legenda da
// narração escrita no vídeo) e o botão liga o som recomeçando do início,
// pra pessoa ouvir a narração inteira. Quem pede menos movimento fica com a
// capa parada até apertar o botão.
export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [som, setSom] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) v.pause();
    else void v.play().catch(() => {});
  }, []);

  function alternarSom() {
    const v = ref.current;
    if (!v) return;
    if (som) {
      v.muted = true;
      setSom(false);
      return;
    }
    v.muted = false;
    v.currentTime = 0;
    void v.play().catch(() => {});
    setSom(true);
  }

  return (
    <>
      <video
        ref={ref}
        className={styles.systemVideo}
        src="/videos/progpt-apresentacao.mp4"
        poster="/videos/progpt-apresentacao-capa.jpg"
        muted
        loop
        playsInline
        preload="auto"
        aria-label="Apresentação do PROGPT: chat, assistentes, fluxo de compras, gestão de obras e integrações"
      />
      <button type="button" onClick={alternarSom} className={styles.videoSom} aria-pressed={som}>
        {som ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
        {som ? 'Tirar o som' : 'Ouvir com som'}
      </button>
    </>
  );
}
