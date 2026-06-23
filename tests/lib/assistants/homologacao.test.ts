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
      cnpjData: {
        cnpj: '84429695000111',
        razao_social: 'WEG SA',
        nome_fantasia: null,
        situacao_cadastral: 'ATIVA',
        data_situacao_cadastral: null,
        natureza_juridica: 'Sociedade Anônima Aberta',
        porte: 'DEMAIS',
        capital_social: 1000000,
        data_abertura: '1961-09-16',
        endereco: { municipio: 'JARAGUA DO SUL', uf: 'SC', cep: '89256900' },
        qsa: [{ nome: 'FULANO DE TAL', qualificacao: 'Diretor', faixa_etaria: 'Entre 51 a 60 anos' }],
        simples_nacional: false,
        mei: false,
      },
      sancoes: { enabled: true, consultado: true, sancoes: [] },
      reputacao: {
        enabled: true,
        available: true,
        resumo: 'Nenhum sinal reputacional relevante encontrado na busca web.',
      },
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
    // Cadastro: endereço + quadro societário vêm do /v1/cnpj (não de IA).
    expect(user).toContain('Cadastro');
    expect(user).toContain('JARAGUA DO SUL');
    expect(user).toContain('FULANO DE TAL');
    expect(user).toContain('Quadro societário');
    // Links de certidões oficiais (consulta manual) sempre presentes.
    expect(user).toContain('CNDT');
    expect(user).toMatch(/consulta-crf\.caixa\.gov\.br|FGTS/);
    // Reputacional: bloco indicativo presente com o resumo.
    expect(user).toMatch(/INDICATIVO|não-oficial/i);
    expect(user).toContain('Nenhum sinal reputacional relevante');
  });

  it('serviço desligado → bloco com checklist de verificação manual (fail-soft)', () => {
    const classified: HomologacaoClassified = {
      cnpj: '84429695000111',
      enabled: false,
      available: false,
      cnpjData: null,
      risk: null,
      compliance: null,
      regimes: null,
      sancoes: null,
      reputacao: null,
    };
    const { user } = buildHomologacaoPrompt(PARAMS, classified, TEMPLATE, [], null);
    expect(user).toMatch(/não está configurado|verificação manual/i);
  });

  it('sanção encontrada vira achado CRÍTICO no prompt', () => {
    const classified: HomologacaoClassified = {
      cnpj: '84429695000111',
      enabled: true,
      available: true,
      cnpjData: null,
      risk: null,
      compliance: null,
      regimes: null,
      sancoes: {
        enabled: true,
        consultado: true,
        sancoes: [
          {
            fonte: 'CEIS',
            nome: 'WEG SA',
            tipo: 'Inidoneidade',
            orgao: 'CGU',
            dataInicio: '2026-01-01',
            dataFim: '2027-01-01',
          },
        ],
      },
      reputacao: null,
    };
    const { user } = buildHomologacaoPrompt(PARAMS, classified, TEMPLATE, [], null);
    expect(user).toMatch(/CRÍTICO|impeditivo/i);
    expect(user).toContain('CEIS');
  });
});
