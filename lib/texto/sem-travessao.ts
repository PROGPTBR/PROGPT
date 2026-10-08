// Tira o travessão (— e –) do texto mostrado ao cliente. Pedido do diretor
// (2026-10-08): travessão em todo lugar "parece sistema de IA". Usado no que
// a IA escreve (análise do Equalizador, rascunho de resposta ao fornecedor)
// antes de chegar à tela; os prompts também pedem para não usar.

/** "a — b" vira "a, b"; travessão colado ("2020—2021") vira hífen. */
export function semTravessao(texto: string): string {
  return texto
    .replace(/\s*[—–]\s*$/gm, '')
    .replace(/^\s*[—–]\s*/gm, '')
    .replace(/\s+[—–]\s+/g, ', ')
    .replace(/[—–]/g, '-')
    .replace(/,\s*,/g, ',');
}

/** Aplica `semTravessao` em todos os textos de um objeto/lista (resultado estruturado da IA). */
export function semTravessaoProfundo<T>(valor: T): T {
  if (typeof valor === 'string') return semTravessao(valor) as T;
  if (Array.isArray(valor)) return valor.map((v) => semTravessaoProfundo(v)) as T;
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(Object.entries(valor as Record<string, unknown>).map(([k, v]) => [k, semTravessaoProfundo(v)])) as T;
  }
  return valor;
}
