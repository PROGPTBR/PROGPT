// Sistemas completos de demonstração (sub-projeto 74): cópias fiéis do
// Central de Obras e do ConectaIN rebatizadas como CentraldeObras PROGPT e
// ConectaPROGPT. Rodam 100% no navegador com dados fictícios (banco de
// demonstração no lugar do Supabase) e ficam em public/demos/.
//
// Nas abas Gestão de Obras e Gestão de Demandas, só quem está na lista abaixo
// vê o sistema completo — os demais clientes continuam com a vitrine do
// sub-projeto 68. Liberação por pessoa, não por domínio.

export const EMAILS_SISTEMA_COMPLETO: readonly string[] = ['alexandre@b2supply.com'];

export function podeVerSistemaCompleto(email: string | null | undefined): boolean {
  const e = (email ?? '').trim().toLowerCase();
  return !!e && EMAILS_SISTEMA_COMPLETO.includes(e);
}

export type SistemaCompleto = 'obras' | 'obrasmateriais' | 'demandas';

export const SISTEMAS_COMPLETOS: Record<SistemaCompleto, { titulo: string; subtitulo: string; src: string }> = {
  obras: {
    titulo: 'CentraldeObras PROGPT',
    subtitulo: 'Sistema completo · dados de demonstração',
    src: '/demos/centraldeobras/',
  },
  // Cópia do ConectaCNX (gestão de obras de loteamento: checklist do
  // encarregado, cockpit do gestor, estoque por galpão, qualidade e mapa 3D),
  // rebatizada; fonte fora do repo em ~/Documentos/obrasmateriais-progpt.
  obrasmateriais: {
    titulo: 'Obras & Materiais PROGPT',
    subtitulo: 'Sistema completo · dados de demonstração',
    src: '/demos/obrasmateriais/',
  },
  demandas: {
    titulo: 'ConectaPROGPT',
    subtitulo: 'Sistema completo · dados de demonstração',
    src: '/demos/conecta/app',
  },
};

/** Os sistemas completos que aparecem na aba Gestão de Obras, na ordem do seletor. */
export const SISTEMAS_DE_OBRAS: readonly SistemaCompleto[] = ['obras', 'obrasmateriais'];
