import { describe, expect, it } from 'vitest';

import { FAQ_SUPORTE, buscarFaq, normalizar } from '@/lib/support/faq';

const todas = FAQ_SUPORTE.flatMap((s) => s.itens);

describe('FAQ do suporte', () => {
  it('ids de seção e de pergunta são únicos', () => {
    const secoes = FAQ_SUPORTE.map((s) => s.id);
    expect(new Set(secoes).size).toBe(secoes.length);
    const itens = todas.map((i) => i.id);
    expect(new Set(itens).size).toBe(itens.length);
  });

  it('cobre o sistema inteiro com perguntas e respostas de verdade', () => {
    expect(todas.length).toBeGreaterThanOrEqual(30);
    for (const item of todas) {
      expect(item.pergunta.trim().length, item.id).toBeGreaterThan(8);
      expect(item.resposta.trim().length, item.id).toBeGreaterThan(40);
    }
  });

  // Preço muda pelo /admin/billing; a resposta do suporte não pode envelhecer.
  it('nenhuma resposta cita preço fixo', () => {
    for (const item of todas) expect(item.resposta, item.id).not.toMatch(/R\$\s*\d/);
  });

  it('cobre os módulos novos (vitrines sob demanda)', () => {
    expect(todas.some((i) => /Gestão de Obras/.test(i.pergunta))).toBe(true);
  });
});

describe('buscarFaq', () => {
  it('sem termo devolve tudo', () => {
    expect(buscarFaq('')).toEqual(FAQ_SUPORTE);
    expect(buscarFaq('   ')).toEqual(FAQ_SUPORTE);
  });

  it('ignora acento e maiúscula', () => {
    expect(normalizar('Cotação')).toBe('cotacao');
    const r = buscarFaq('COTACAO');
    expect(r.flatMap((s) => s.itens).some((i) => i.id === 'equalizador')).toBe(true);
  });

  it('exige todas as palavras digitadas', () => {
    const r = buscarFaq('cancelar assinatura');
    const ids = r.flatMap((s) => s.itens).map((i) => i.id);
    expect(ids).toContain('cancelar');
    expect(buscarFaq('cancelar xyzinexistente')).toEqual([]);
  });

  it('acha pelos termos extras, mesmo que não estejam no texto', () => {
    const ids = buscarFaq('lgpd').flatMap((s) => s.itens).map((i) => i.id);
    expect(ids).toContain('excluir');
  });

  it('esconde seções sem resultado', () => {
    for (const secao of buscarFaq('whatsapp senha anexo')) expect(secao.itens.length).toBeGreaterThan(0);
  });
});
