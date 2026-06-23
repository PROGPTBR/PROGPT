import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks da stack LLM — não chamamos OpenAI de verdade nos testes.
const generateObjectMock = vi.fn();
vi.mock('ai', () => ({ generateObject: (...args: unknown[]) => generateObjectMock(...args) }));
vi.mock('@ai-sdk/openai', () => ({ createOpenAI: () => () => 'mock-model' }));
vi.mock('@/lib/llm/openai', () => ({ getOpenAIModel: () => 'gpt-test' }));
vi.mock('@/lib/env', () => ({ requireEnv: () => 'sk-test' }));

import {
  normalizeSettings,
  draftSupplierReply,
  DEFAULT_SETTINGS,
} from '@/lib/assistants/comprador-inbox';
import type { CompradorResult } from '@/lib/assistants/comprador';

const analysis: CompradorResult = {
  resumo: '3 propostas analisadas.',
  ranking: [],
  recomendacao_fornecedor: 'EcoPallets',
  justificativa: 'Melhor TCO e homologado.',
  pontos_negociacao: ['Pedir desconto de 5%', 'Confirmar prazo de 25 dias'],
  alertas: ['Fornecedor B com imposto +12%'],
  desvios_politica: ['Fornecedor B não homologado'],
  pedido_compra: {
    numero: 'PO-RASCUNHO',
    fornecedor: 'EcoPallets',
    itens: [],
    valor_total: 0,
    condicao_pagamento: '14 ddl',
    prazo_entrega: '25 dias',
    observacoes: '',
  },
  precisa_humano: true,
  motivo_escalonamento: 'Desvio de política',
  severidade: 'warn',
};

describe('normalizeSettings', () => {
  it('retorna defaults quando row é null', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('cai pra cordial quando o tom é inválido', () => {
    expect(normalizeSettings({ tone: 'agressivo' }).tone).toBe('cordial');
  });

  it('preserva valores válidos e trata approval_required=false', () => {
    const s = normalizeSettings({
      tone: 'firme',
      rules: 'sempre pedir frete',
      signature: 'Equipe',
      approval_required: false,
      auto_draft: false,
    });
    expect(s).toEqual({
      tone: 'firme',
      rules: 'sempre pedir frete',
      signature: 'Equipe',
      approval_required: false,
      auto_draft: false,
    });
  });

  it('approval_required default é true quando ausente', () => {
    expect(normalizeSettings({ tone: 'formal' }).approval_required).toBe(true);
  });
});

describe('draftSupplierReply', () => {
  beforeEach(() => {
    generateObjectMock.mockReset();
    generateObjectMock.mockResolvedValue({
      object: { subject: 'Sobre sua proposta', body: 'Olá, pedimos o frete discriminado.' },
      usage: { promptTokens: 120, completionTokens: 40 },
      providerMetadata: { openai: { cachedPromptTokens: 10 } },
    });
  });

  it('retorna o rascunho do LLM com usage', async () => {
    const out = await draftSupplierReply({
      supplierName: 'EcoPallets',
      analysis,
      settings: { ...DEFAULT_SETTINGS, tone: 'firme', rules: 'sempre pedir frete' },
    });
    expect(out.reply.subject).toBe('Sobre sua proposta');
    expect(out.reply.body).toContain('frete');
    expect(out.usage).toEqual({ tokensIn: 120, tokensOut: 40, tokensCached: 10 });
    expect(out.model).toBe('gpt-test');
  });

  it('injeta o tom e as regras do comprador no system prompt', async () => {
    await draftSupplierReply({
      supplierName: 'EcoPallets',
      analysis,
      settings: { ...DEFAULT_SETTINGS, tone: 'firme', rules: 'nunca aceitar prazo > 30 dias' },
    });
    const args = generateObjectMock.mock.calls[0]![0] as { system: string };
    expect(args.system).toContain('firme');
    expect(args.system).toContain('nunca aceitar prazo > 30 dias');
  });

  it('passa os pontos de negociação e desvios pro modelo', async () => {
    await draftSupplierReply({ supplierName: 'X', analysis, settings: DEFAULT_SETTINGS });
    const args = generateObjectMock.mock.calls[0]![0] as { messages: { content: string }[] };
    const userMsg = args.messages[0]!.content;
    expect(userMsg).toContain('Pedir desconto de 5%');
    expect(userMsg).toContain('Fornecedor B não homologado');
  });
});
