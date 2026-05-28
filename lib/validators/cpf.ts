// Sub-projeto 27 — validador de CPF pra coletar antes do checkout Asaas.
//
// Asaas API exige cpfCnpj em createCustomer. Validação local antes do POST
// pra economizar round-trip + dar feedback imediato no form.

/** Strip non-digits. */
export function formatCpf(raw: string): string {
  return raw.replace(/\D/g, '');
}

/**
 * Valida CPF via algoritmo oficial (módulo 11). Rejeita:
 *   - Strings que não tenham 11 dígitos após strip
 *   - Sequências repetidas (111.111.111-11, 222... etc — válidos pelo
 *     módulo 11 mas obviamente fake)
 *   - Checksum inválido
 */
export function isValidCpf(raw: string): boolean {
  const cpf = formatCpf(raw);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // 11 dígitos iguais

  // Primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]!, 10) * (10 - i);
  let check = 11 - (sum % 11);
  if (check >= 10) check = 0;
  if (check !== parseInt(cpf[9]!, 10)) return false;

  // Segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]!, 10) * (11 - i);
  check = 11 - (sum % 11);
  if (check >= 10) check = 0;
  if (check !== parseInt(cpf[10]!, 10)) return false;

  return true;
}
