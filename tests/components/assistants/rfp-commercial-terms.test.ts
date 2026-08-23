// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { commercialTerms } from '@/components/assistants/RfpAssistant';
import type { RfpFormValues } from '@/components/assistants/RfpForm';

// Backlog do diretor (2026-08-19, Batch I) — os campos comerciais da RFQ só
// devem viajar pro run quando preenchidos: string vazia no params JSONB
// viraria linha vazia no prompt e ruído no histórico.

const EMPTY: RfpFormValues = {
  templateId: 'tpl-1',
  client: 'ACME',
  scope: 'escopo',
  category: 'categoria',
  deadline: '30 dias',
  budget: 'R$ 100k',
  criteria: [],
  notes: '',
  quantity: '',
  deliveryLocation: '',
  deliveryDeadline: '',
  incoterm: '',
  paymentTerms: '',
  currency: '',
  proposalValidity: '',
  responseDeadline: '',
  buyerContact: '',
  sampleRequired: false,
};

describe('commercialTerms', () => {
  it('emits nothing when the buyer filled no commercial field', () => {
    expect(commercialTerms(EMPTY)).toEqual({});
  });

  it('keeps only the filled fields, trimmed', () => {
    expect(
      commercialTerms({
        ...EMPTY,
        quantity: '  12.000 un  ',
        incoterm: 'DAP',
        currency: '   ',
      }),
    ).toEqual({ quantity: '12.000 un', incoterm: 'DAP' });
  });

  it('sends sampleRequired only when checked', () => {
    expect(commercialTerms({ ...EMPTY, sampleRequired: true })).toEqual({
      sampleRequired: true,
    });
    expect(commercialTerms(EMPTY)).not.toHaveProperty('sampleRequired');
  });

  it('carries the whole commercial block when everything is filled', () => {
    expect(
      commercialTerms({
        ...EMPTY,
        quantity: '12.000 un',
        deliveryLocation: 'CD Cajamar/SP',
        deliveryDeadline: '30 dias',
        incoterm: 'DAP',
        paymentTerms: '30 ddl',
        currency: 'BRL',
        proposalValidity: '60 dias',
        responseDeadline: '15/09/2026',
        buyerContact: 'compras@acme.com.br',
        sampleRequired: true,
      }),
    ).toEqual({
      quantity: '12.000 un',
      deliveryLocation: 'CD Cajamar/SP',
      deliveryDeadline: '30 dias',
      incoterm: 'DAP',
      paymentTerms: '30 ddl',
      currency: 'BRL',
      proposalValidity: '60 dias',
      responseDeadline: '15/09/2026',
      buyerContact: 'compras@acme.com.br',
      sampleRequired: true,
    });
  });
});
