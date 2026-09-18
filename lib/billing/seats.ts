// Assinatura por usuário (seats) — 2026-09-17.
//
// O plano é vendido POR USUÁRIO: uma empresa que contrata 3 acessos paga
// 3 × o preço unitário. `seats` é só a QUANTIDADE — o preço unitário continua
// vindo de `billing_settings` (/admin/billing) ou da tabela `plans`, então
// mudar o valor lá continua sendo a fonte única da verdade. O cliente nunca
// escolhe o valor, só quantos acessos quer.
//
// Este módulo é puro de propósito: é usado no servidor (para calcular o que
// vai pro Asaas) E no cliente (para mostrar a conta na tela antes de pagar).
// Os dois lados TÊM que mostrar o mesmo número.

export const MIN_SEATS = 1;
export const MAX_SEATS = 50;

/** Normaliza qualquer entrada (body JSON, query string, input) num inteiro
 *  dentro da faixa permitida. Nunca lança — entrada inválida vira 1 usuário,
 *  que é o comportamento de antes desta feature. */
export function parseSeats(input: unknown): number {
  const raw =
    typeof input === 'number'
      ? input
      : Number(String(input ?? '').trim());

  if (!Number.isFinite(raw)) return MIN_SEATS;

  const int = Math.trunc(raw);

  if (int < MIN_SEATS) return MIN_SEATS;
  if (int > MAX_SEATS) return MAX_SEATS;

  return int;
}

/** Valor mensal total = preço unitário × quantidade de usuários. */
export function seatsTotal(unitPrice: number, seats: unknown): number {
  const price = Number(unitPrice);
  if (!Number.isFinite(price) || price < 0) return 0;

  // Arredonda em centavos pra não mandar 218.99999999 pro Asaas.
  return Math.round(price * parseSeats(seats) * 100) / 100;
}

export function formatBRL(value: number): string {
  const n = Number.isFinite(Number(value)) ? Number(value) : 0;
  return `R$ ${n.toFixed(2).replace('.', ',')}`;
}

export function seatsLabel(seats: unknown): string {
  const n = parseSeats(seats);
  return n === 1 ? '1 usuário' : `${n} usuários`;
}

/** Linha legível do que será cobrado. Usada na UI (antes do pagamento) e na
 *  `description` da assinatura Asaas — que é o texto que o cliente vê na
 *  fatura do cartão. */
export function seatsChargeSummary(unitPrice: number, seats: unknown): string {
  const n = parseSeats(seats);
  const total = seatsTotal(unitPrice, n);

  if (n === 1) return `${formatBRL(total)}/mês`;

  return `${n} × ${formatBRL(unitPrice)} = ${formatBRL(total)}/mês`;
}

/** E-mails dos usuários ADICIONAIS (o titular do cadastro já ocupa 1 acesso).
 *  Sempre opcional: o cadastro nunca pode travar por causa disto. Entrada
 *  inválida é descartada em silêncio, nunca vira erro. */
export function normalizeSeatEmails(input: unknown, seats: unknown): string[] {
  if (!Array.isArray(input)) return [];

  const extra = Math.max(0, parseSeats(seats) - 1);
  if (extra === 0) return [];

  const seen = new Set<string>();
  const out: string[] = [];

  for (const item of input) {
    if (typeof item !== 'string') continue;

    const email = item.trim().toLowerCase();

    // Validação intencionalmente frouxa — este campo é uma conveniência
    // operacional (pra 2B Supply provisionar os acessos), não um gate.
    if (!email || !email.includes('@') || email.length > 255) continue;
    if (seen.has(email)) continue;

    seen.add(email);
    out.push(email);

    if (out.length >= extra) break;
  }

  return out;
}
