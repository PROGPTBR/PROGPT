// Passagem das propostas do Equalizador (cotação) para a Análise Tributária.
// O Equalizador grava no sessionStorage e abre a tela; a Análise Tributária lê
// uma vez, apaga e já manda a IA ler as propostas.

export const PREFILL_TRIBUTARIO_KEY = 'progpt_tributario_prefill';

export type PrefillTributario = { texto: string; descricao?: string };

export function gravarPrefillTributario(dados: PrefillTributario): boolean {
  try {
    sessionStorage.setItem(PREFILL_TRIBUTARIO_KEY, JSON.stringify(dados));
    return true;
  } catch {
    return false;
  }
}
