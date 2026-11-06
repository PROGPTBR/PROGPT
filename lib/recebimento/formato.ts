// Formatação usada pelas telas do Recebimento de NF. Fica fora do módulo
// 'use client' de propósito: a página do financeiro é server component e não
// pode chamar função exportada de módulo de cliente.

export function brl(v: number | null | undefined): string {
  if (v == null) return 'não informado';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function qtd(v: number | null | undefined): string {
  if (v == null) return '?';
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 4 });
}

export function dataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
}
