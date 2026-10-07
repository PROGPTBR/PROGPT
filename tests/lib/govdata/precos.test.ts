import { describe, expect, it } from 'vitest';
describe('candidatosPorPalavra (pré-filtro da escolha de classe/PDM)', () => {
  it('acha a classe pelo termo do item, ignorando acento e caixa', async () => {
    const { candidatosPorPalavra } = await import('@/lib/govdata/precos');
    const cs = [
      { codigo: 8925, nome: 'AÇÚCAR, CONFEITOS, CASTANHAS, NOZES E SIMILARES' },
      { codigo: 7010, nome: 'COMPUTADORES' },
      { codigo: 7530, nome: 'PAPÉIS E PAPELÕES' },
    ];
    expect(candidatosPorPalavra('acucar refinado', cs).map((c) => c.codigo)).toEqual([8925]);
    expect(candidatosPorPalavra('Papel A4 sulfite', cs).map((c) => c.codigo)).toEqual([7530]);
    expect(candidatosPorPalavra('notebook', cs)).toEqual([]);
  });
});
