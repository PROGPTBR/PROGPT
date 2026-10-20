// Fluxo Automatizado de Compras como produto SOB DEMANDA (pedido do Alexandre,
// 2026-10-20: "deixar este assistente escrito como Sob demanda, para criar um
// ineditismo"; decisão do dono: o cliente vê e só carrega o exemplo, e para o
// Alexandre fica ativo direto).
//
// Quem está na lista (ou é super admin da 2B Supply) usa o Fluxo de verdade.
// Os demais veem a vitrine: a tela, o modo guiado e o processo de exemplo das
// 8 etapas, sem gravar nada nem gastar IA. Liberação por pessoa, não por
// domínio, igual aos sistemas completos (lib/vitrine/sistema-completo.ts).
// Para liberar um cliente que contratou: acrescente o e-mail aqui.

export const EMAILS_FLUXO_COMPLETO: readonly string[] = ['alexandre@b2supply.com'];

export function fluxoLiberado(email: string | null | undefined, superAdmin = false): boolean {
  if (superAdmin) return true;
  const e = (email ?? '').trim().toLowerCase();
  return !!e && EMAILS_FLUXO_COMPLETO.includes(e);
}

export const MENSAGEM_SOB_DEMANDA =
  'O Fluxo Automatizado de Compras é implantado sob demanda. Veja o processo de exemplo ou fale com o comercial para ter na sua empresa.';
