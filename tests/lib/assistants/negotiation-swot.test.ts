import { describe, expect, it } from 'vitest';
import {
  hasSwotInput,
  swotInputBlock,
} from '@/lib/assistants/negotiation/prompt-strategy';
import { renderSwotChartPng } from '@/lib/assistants/negotiation/swot-chart';
import type {
  NegotiationStrategyResult,
  NegotiationSwotInput,
} from '@/lib/assistants/types';

// Batch H do backlog do diretor (2026-08-19): SWOT como input do comprador
// + matriz 2x2 no relatório.

const filled: NegotiationSwotInput = {
  strengths: 'Somos 40% do faturamento dele',
  weaknesses: 'Estoque para 15 dias apenas',
  opportunities: 'Dois concorrentes entrando na região',
  threats: 'Reajuste anunciado no setor',
};

const empty: NegotiationSwotInput = {
  strengths: '',
  weaknesses: '',
  opportunities: '',
  threats: '',
};

describe('hasSwotInput', () => {
  it('é falso quando ausente ou todo vazio', () => {
    expect(hasSwotInput(undefined)).toBe(false);
    expect(hasSwotInput(empty)).toBe(false);
    expect(hasSwotInput({ ...empty, strengths: '   ' })).toBe(false);
  });

  it('é verdadeiro com um único quadrante preenchido', () => {
    expect(hasSwotInput({ ...empty, threats: 'Risco cambial' })).toBe(true);
    expect(hasSwotInput(filled)).toBe(true);
  });
});

describe('swotInputBlock', () => {
  it('retorna null sem input — a IA segue gerando a SWOT do zero', () => {
    expect(swotInputBlock(undefined)).toBeNull();
    expect(swotInputBlock(empty)).toBeNull();
  });

  it('inclui os 4 quadrantes preenchidos e a instrução de não descartar', () => {
    const block = swotInputBlock(filled)!;
    expect(block).toContain('Somos 40% do faturamento dele');
    expect(block).toContain('Estoque para 15 dias apenas');
    expect(block).toContain('Dois concorrentes entrando na região');
    expect(block).toContain('Reajuste anunciado no setor');
    expect(block).toContain('PARTA DESTE SWOT');
    expect(block).toContain('NÃO descarte nenhum ponto informado');
  });

  it('omite os quadrantes vazios em vez de emitir rótulo órfão', () => {
    const block = swotInputBlock({ ...empty, strengths: 'Volume alto' })!;
    expect(block).toContain('Forças (do comprador)');
    expect(block).not.toContain('Fraquezas (do comprador)');
    expect(block).not.toContain('Ameaças (externas)');
  });
});

const swot: NegotiationStrategyResult['swot'] = {
  strengths: ['Volume relevante para o fornecedor', 'Dois substitutos homologados'],
  weaknesses: ['Estoque curto', 'Requalificação demora 3 meses'],
  opportunities: ['Novos entrantes na região'],
  threats: ['Reajuste setorial anunciado', 'Risco de desabastecimento'],
};

describe('renderSwotChartPng', () => {
  it('devolve um Buffer PNG não-vazio', async () => {
    const buf = await renderSwotChartPng(swot);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50);
  });

  it('não quebra com quadrantes vazios', async () => {
    await expect(
      renderSwotChartPng({
        strengths: [],
        weaknesses: [],
        opportunities: [],
        threats: [],
      }),
    ).resolves.toBeInstanceOf(Buffer);
  });

  it('não quebra com bullets longos nem com excesso de itens', async () => {
    const many = Array.from({ length: 12 }, (_, i) => `Ponto ${i + 1} `.repeat(12));
    await expect(
      renderSwotChartPng({
        strengths: many,
        weaknesses: many,
        opportunities: many,
        threats: many,
      }),
    ).resolves.toBeInstanceOf(Buffer);
  });
});
