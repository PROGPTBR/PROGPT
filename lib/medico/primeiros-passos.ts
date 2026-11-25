import type { Cirurgia, Demonstrativo, EstadoMedico } from './types';

// Primeiros passos e sinais do dia a dia (sub-projeto 115). PURO.
//
// O médico que chega "zero de automação" precisa de um caminho curto, e o
// sistema sabe pelo próprio dado o que já foi feito: não há caixa para marcar.

export type Passo = { id: string; titulo: string; feito: boolean; destino: 'cadastros' | 'integracoes' | 'agenda' | 'cirurgias' | 'demonstrativos' };

export function primeirosPassos(estado: Omit<EstadoMedico, 'integracoes'>): Passo[] {
  const { config } = estado;
  const reais = <T extends { exemplo: boolean }>(l: T[]) => l.filter((x) => !x.exemplo);
  return [
    { id: 'hospitais', titulo: 'Cadastre os hospitais onde você opera', feito: reais(estado.hospitais).length > 0, destino: 'cadastros' },
    { id: 'contador', titulo: 'Informe o e-mail do seu contador', feito: !!config.contador_email.trim(), destino: 'cadastros' },
    { id: 'contato', titulo: 'Informe o seu e-mail e o seu WhatsApp', feito: !!config.medico_email.trim() && !!config.whatsapp_numero.trim(), destino: 'integracoes' },
    { id: 'cirurgia', titulo: 'Marque ou registre a primeira cirurgia', feito: reais(estado.cirurgias).length > 0, destino: 'agenda' },
    { id: 'demonstrativo', titulo: 'Lance o primeiro demonstrativo do hospital', feito: reais(estado.demonstrativos).length > 0, destino: 'demonstrativos' },
  ];
}

/** Cirurgias marcadas pela agenda cuja data já passou e ninguém confirmou que aconteceram. */
export function aConfirmar(cirurgias: Cirurgia[], hoje: string): Cirurgia[] {
  return cirurgias.filter((c) => c.confirmar && c.data <= hoje).sort((a, b) => b.data.localeCompare(a.data));
}

/** Pagamentos que caíram nos últimos `dias` dias: o "operação paga" na tela. */
export function pagamentosRecentes(demonstrativos: Demonstrativo[], hoje: string, dias = 7): Demonstrativo[] {
  const limite = new Date(`${hoje}T12:00:00Z`);
  limite.setUTCDate(limite.getUTCDate() - dias);
  const desde = limite.toISOString().slice(0, 10);
  return demonstrativos.filter((d) => d.pago_em && d.pago_em >= desde && d.pago_em <= hoje).sort((a, b) => b.pago_em!.localeCompare(a.pago_em!));
}
