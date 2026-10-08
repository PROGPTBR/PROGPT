import { describe, expect, it } from 'vitest';
import { condensarTodas, dividirPropostas, precisaCondensar } from '@/lib/assistants/comprador';

describe('Equalizador: lote grande (toda proposta entra na análise)', () => {
  it('separa as propostas pelo cabeçalho de cada documento importado', () => {
    const t = 'texto colado à mão\n\n### Documento: a.pdf\nproposta A\n\n### Documento: b.xlsx\nproposta B';
    expect(dividirPropostas(t)).toEqual([
      { titulo: 'Proposta colada', texto: 'texto colado à mão' },
      { titulo: 'a.pdf', texto: 'proposta A' },
      { titulo: 'b.xlsx', texto: 'proposta B' },
    ]);
  });

  it('só condensa quando o lote é grande (muitos documentos ou texto longo)', () => {
    const poucos = [{ titulo: 'a', texto: 'x'.repeat(1000) }, { titulo: 'b', texto: 'y'.repeat(1000) }];
    const muitos = Array.from({ length: 7 }, (_, i) => ({ titulo: `d${i}`, texto: 'z' }));
    const longos = [{ titulo: 'a', texto: 'x'.repeat(70_000) }];
    expect(precisaCondensar(poucos)).toBe(false);
    expect(precisaCondensar(muitos)).toBe(true);
    expect(precisaCondensar(longos)).toBe(true);
  });

  it('condensa todas em paralelo e devolve na ordem, mesmo com tempos diferentes', async () => {
    const docs = ['lento', 'a', 'b', 'c', 'd', 'e', 'f'].map((t) => ({ titulo: t, texto: t }));
    const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const out = await condensarTodas(docs, async (d) => { await espera(d.titulo === 'lento' ? 30 : 2); return `ok ${d.titulo}`; }, 3);
    expect(out).toEqual(docs.map((d) => `ok ${d.titulo}`));
  });
});
