import { describe, expect, it } from 'vitest';
import { PartialProfileSchema } from '@/lib/assistants/types';

describe('PartialProfileSchema', () => {
  it('accepts empty object (extractor may find nothing)', () => {
    const res = PartialProfileSchema.safeParse({});
    expect(res.success).toBe(true);
  });

  it('accepts partial subset of fields', () => {
    const res = PartialProfileSchema.safeParse({
      nomeCategoria: 'Embalagens',
      subSegmentos: ['filmes'],
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.nomeCategoria).toBe('Embalagens');
      expect(res.data.subSegmentos).toEqual(['filmes']);
    }
  });

  it('rejects invalid prioridadeEstrategica from LLM', () => {
    const res = PartialProfileSchema.safeParse({
      prioridadeEstrategica: 'velocidade',
    });
    expect(res.success).toBe(false);
  });

  it('rejects negative spendAnualBRL', () => {
    const res = PartialProfileSchema.safeParse({
      spendAnualBRL: -100,
    });
    expect(res.success).toBe(false);
  });

  it('accepts full stakeholder array shape', () => {
    const res = PartialProfileSchema.safeParse({
      stakeholders: [
        { nome: 'Maria', papel: 'aprovador' },
        { nome: 'João', papel: 'usuario' },
      ],
    });
    expect(res.success).toBe(true);
  });

  it('rejects stakeholder with unknown papel', () => {
    const res = PartialProfileSchema.safeParse({
      stakeholders: [{ nome: 'Maria', papel: 'gerente' }],
    });
    expect(res.success).toBe(false);
  });
});
