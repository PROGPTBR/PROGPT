import { describe, expect, it } from 'vitest';

import { buildStagePrompt } from '@/lib/fluxo/prompt';
import { getStage } from '@/lib/fluxo/stages';
import type { FluxoContexto, FluxoStageOutput } from '@/lib/fluxo/types';

function saida(over: Partial<FluxoStageOutput> = {}): FluxoStageOutput {
  return {
    resumo: 'Requisição padronizada.',
    campos: [{ rotulo: 'Categoria', valor: 'TI — notebooks' }],
    itens: [{ titulo: '10 notebooks', detalhe: 'i7, 16GB' }],
    pontos_de_revisao: ['Confirmar o centro de custo'],
    alertas: [],
    saida: 'Solicitação validada',
    ...over,
  };
}

describe('buildStagePrompt', () => {
  const stage = getStage('fornecedores')!;

  it('descreve a etapa atual, a entrada esperada e a saída', () => {
    const p = buildStagePrompt({ stage, requisicao: 'Comprar 10 notebooks', contexto: {} });
    expect(p).toContain('Etapa 3 de 8: Seleção de Fornecedores');
    expect(p).toContain('Entrada esperada: Solicitação aprovada');
    expect(p).toContain('Saída esperada desta etapa: Fornecedores selecionados');
    expect(p).toContain('Comprar 10 notebooks');
  });

  it('carrega o handoff: só o que já foi APROVADO entra no contexto', () => {
    const contexto: FluxoContexto = { solicitacao: saida() };
    const p = buildStagePrompt({ stage, requisicao: 'x', contexto });

    expect(p).toContain('Etapa 1 — Solicitação de Compra (aprovada)');
    expect(p).toContain('Categoria: TI — notebooks');
    expect(p).toContain('10 notebooks');
    // Etapa 2 não foi aprovada: não pode aparecer.
    expect(p).not.toContain('Etapa 2 — Aprovação');
  });

  it('manda a correção do AJUSTAR de forma inequívoca', () => {
    const p = buildStagePrompt({
      stage,
      requisicao: 'x',
      contexto: {},
      ajuste: 'Tire o fornecedor B, não é homologado.',
    });
    expect(p).toContain('AJUSTE PEDIDO PELO COMPRADOR');
    expect(p).toContain('Tire o fornecedor B');
    expect(p).toMatch(/refaça a etapa/i);
  });

  it('marca dado consultado de fonte oficial como verdade', () => {
    const p = buildStagePrompt({
      stage,
      requisicao: 'x',
      contexto: {},
      enriquecimento: 'CNPJ 12345678000190 · Situação cadastral: ATIVA',
    });
    expect(p).toContain('fonte oficial');
    expect(p).toContain('Situação cadastral: ATIVA');
  });

  it('não inventa seções quando não há contexto nem ajuste', () => {
    const p = buildStagePrompt({ stage, requisicao: 'x', contexto: {} });
    expect(p).not.toContain('AJUSTE PEDIDO');
    expect(p).not.toContain('Etapas já aprovadas');
  });
});
