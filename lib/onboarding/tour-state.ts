// Estado do tour guiado entre páginas.
//
// Desde que o tour passou a navegar página por página (sub-projeto 70), ele
// não pode mais viver dentro de uma tela: cada troca de rota desmontaria o
// componente e o progresso se perderia. O passo atual fica no sessionStorage
// (some ao fechar a aba — um tour pela metade não deve reaparecer amanhã) e o
// <TourHost/> do layout raiz lê daqui a cada navegação.
//
// Toda leitura/escrita é tolerante a falha: em janela privada ou com storage
// bloqueado o tour ainda funciona dentro da página, só não sobrevive à troca.

export const TOUR_STATE_KEY = 'progpt_tour_v2';
export const TOUR_EVENT = 'progpt:tour-change';
/** Marca que o tour já foi aberto nesta aba (ver tourJaIniciado). */
export const TOUR_INICIADO_KEY = 'progpt_tour_iniciado_v2';

export type TourState = { index: number };

// Cópia em memória: com o storage bloqueado o tour segue funcionando enquanto
// a aba não recarrega (a navegação do App Router não recarrega o módulo).
let memoria: TourState | null = null;

export function readTourState(): TourState | null {
  try {
    const raw = window.sessionStorage.getItem(TOUR_STATE_KEY);
    // Escrita que falhou (cota, modo privado) deixa o storage vazio: vale a memória.
    if (!raw) return memoria;
    const parsed = JSON.parse(raw) as Partial<TourState>;
    return typeof parsed.index === 'number' && parsed.index >= 0 ? { index: Math.floor(parsed.index) } : null;
  } catch {
    return memoria;
  }
}

function emit() {
  try {
    window.dispatchEvent(new Event(TOUR_EVENT));
  } catch {
    /* fora do browser */
  }
}

export function writeTourState(state: TourState): void {
  memoria = state;
  try {
    window.sessionStorage.setItem(TOUR_STATE_KEY, JSON.stringify(state));
  } catch {
    /* storage bloqueado — o host mantém o estado em memória */
  }
  emit();
}

export function clearTourState(): void {
  memoria = null;
  try {
    window.sessionStorage.removeItem(TOUR_STATE_KEY);
  } catch {
    /* ignore */
  }
  emit();
}

let iniciadoEmMemoria = false;

/** Começa (ou recomeça) o tour do primeiro passo, em qualquer tela. */
export function startTour(): void {
  iniciadoEmMemoria = true;
  try {
    window.sessionStorage.setItem(TOUR_INICIADO_KEY, '1');
  } catch {
    /* memória cobre */
  }
  writeTourState({ index: 0 });
}

/**
 * O tour automático de primeiro acesso já rodou nesta aba? O /chat pode voltar
 * do cache do roteador ainda dizendo "primeiro acesso" logo depois de o
 * cliente pular o tour em outra tela — sem esta marca, o tour recomeçaria.
 */
export function tourJaIniciado(): boolean {
  if (iniciadoEmMemoria) return true;
  try {
    return window.sessionStorage.getItem(TOUR_INICIADO_KEY) === '1';
  } catch {
    return false;
  }
}
