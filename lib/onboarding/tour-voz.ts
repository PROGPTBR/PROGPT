import type { TourStep } from './tour-steps';

// Assistente de voz do tour (sub-projeto 77): cada passo tem um áudio gravado
// antes (scripts/gerar-voz-tour.ts → public/tour/voz/<id>.mp3), lido a partir
// do próprio título e texto do passo. Gravado de antemão de propósito: sem
// custo por uso e sem esperar a síntese na hora.
//
// Puro — usado pelo cartão do tour (no navegador), pelo gerador e pelo teste.

/** O que o assistente fala no passo, com a pronúncia ajustada para a voz. */
export function textoFalado(step: Pick<TourStep, 'title' | 'body'>): string {
  return `${step.title}. ${step.body}`
    .replace(/PROGPT/g, 'Pró GPT')
    .replace(/\.docx\b/gi, 'Word')
    .replace(/\.xlsx\b/gi, 'Excel')
    .replace(/["“”]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Assinatura curta do texto falado (FNV-1a 32 bits). Muda quando o texto muda. */
export function assinaturaFala(texto: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Endereço do áudio do passo; a assinatura no fim evita tocar áudio velho do cache. */
export function urlVozDoPasso(step: Pick<TourStep, 'id' | 'title' | 'body'>): string {
  return `/tour/voz/${step.id}.mp3?v=${assinaturaFala(textoFalado(step))}`;
}

export const VOZ_TOUR_STORAGE_KEY = 'progpt_tour_voz_v1';
