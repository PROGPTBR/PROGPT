import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  fetchHomologacaoData,
  buildHomologacaoPrompt,
  type HomologacaoClassified,
} from '@/lib/assistants/homologacao';
import type { HomologacaoParams, TemplateRow } from '@/lib/assistants/types';

afterEach(() => {
  vi.unstubAllEnvs();
});

const PARAMS: HomologacaoParams = {
  cnpj: '84.429.695/0001-11',
  fornecedorNome: 'WEG S.A.',
  notas: '',
};

const TEMPLATE: TemplateRow = {
  id: 't1',
  assistant_type: 'homologacao',
  name: 'Homologação (padrão)',
  description: null,
  body_md: '# Relatório\n\n## Identificação',
  created_at: '',
  updated_at: '',
} as unknown as TemplateRow;

describe('fetchHomologacaoData — fail-soft', () => {
  it('serviço desligado (sem FISCAL_API_URL) → enabled:false, available:false, sem fetch', async () => {
    vi.stubEnv('FISCAL_API_URL', '');
    const r = await fetchHomologacaoData(PARAMS);
    expect(r.enabled).toBe(false);
    expect(r.available).toBe(false);
    expect(r.risk).toBeNull();
    expect(r.compliance).toBeNull();
  });
});

describe('buildHomologacaoPrompt', () => {
  it('com dados disponíveis injeta score de risco + achados de compliance', () => {
    const classified: HomologacaoClassified = {
      cnpj: '84429695000111',
      enabled: true,
      available: true,
      risk: {
        cnpj: '84429695000111',
        razao_social: 'WEG SA',
        risco: 'baixo',
        score: 90,
        fatores: ['Situacao cadastral regular'],
        recomendacao: 'aprovar',
        data_analise: '2026-06-23',
      },
      compliance: {
        cnpj: '84429695000111',
        razao_social: 'WEG SA',
        risco_geral: 'baixo',
        score: 90,
        achados: [
          {
            categoria: 'certidoes',
            severidade: 'baixo',
            titulo: 'Certidões',
            detalhe: 'Verificar CND e FGTS no portal.',
          },
        ],
        resumo_executivo: 'Risco baixo.',
        fontes_consultadas: ['BrasilAPI'],
      },
      regimes: null,
    };
    const { system, user } = buildHomologacaoPrompt(
      PARAMS,
      classified,
      TEMPLATE,
      [],
      null,
    );
    expect(system).toMatch(/HOMOLOGAÇÃO|homologação/);
    expect(user).toContain('Score de risco');
    expect(user).toContain('90/100');
    expect(user).toContain('certidoes');
    expect(user).toContain('Aprovar');
  });

  it('serviço desligado → bloco com checklist de verificação manual (fail-soft)', () => {
    const classified: HomologacaoClassified = {
      cnpj: '84429695000111',
      enabled: false,
      available: false,
      risk: null,
      compliance: null,
      regimes: null,
    };
    const { user } = buildHomologacaoPrompt(PARAMS, classified, TEMPLATE, [], null);
    expect(user).toMatch(/não está configurado|verificação manual/i);
  });
});
