import { describe, it, expect } from 'vitest';
import { structureRequisicaoFromText } from '@/lib/proc2pay/intake';

describe('structureRequisicaoFromText (fail-soft)', () => {
  it('texto vazio → fallback sem chamar LLM', async () => {
    const r = await structureRequisicaoFromText('   ');
    expect(r.requisicao.solicitante).toBe('Não informado');
    expect(r.requisicao.itens).toEqual([]);
    expect(r.titulo).toBeTruthy();
  });
});
