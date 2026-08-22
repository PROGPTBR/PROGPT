import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildResumo, type HistoricoLite, type SancoesLite } from '@/lib/suppliers/enrichment';
import type { FiscalBadge } from '@/lib/fiscal/snapshot';

beforeEach(() => vi.resetModules());

const FISCAL_ATIVA: FiscalBadge = {
  available: true,
  situacao: 'ATIVA',
  score: 90,
  risco: 'baixo',
};
const FISCAL_INDISPONIVEL: FiscalBadge = {
  available: false,
  situacao: null,
  score: null,
  risco: null,
};
const HIST_FORNECE: HistoricoLite = {
  consultado: true,
  forneceAoGoverno: true,
  totalItens: 3,
  ufs: ['SP'],
  periodoMeses: 12,
};
const HIST_NAO_FORNECE: HistoricoLite = {
  consultado: true,
  forneceAoGoverno: false,
  totalItens: 0,
  ufs: [],
  periodoMeses: 12,
};
const HIST_NAO_CONSULTADO: HistoricoLite = {
  consultado: false,
  forneceAoGoverno: false,
  totalItens: 0,
  ufs: [],
  periodoMeses: 12,
};
const SEM_SANCAO: SancoesLite = {
  enabled: true,
  consultado: true,
  temSancao: false,
  total: 0,
  amostra: [],
};
const COM_SANCAO: SancoesLite = {
  enabled: true,
  consultado: true,
  temSancao: true,
  total: 2,
  amostra: [],
};

describe('buildResumo (pura, sem LLM)', () => {
  it('combina situação, risco e histórico público', () => {
    const r = buildResumo(FISCAL_ATIVA, HIST_FORNECE, SEM_SANCAO);
    expect(r).toBe('ATIVA · risco baixo · 3 contratos públicos/12m');
  });

  it('sanção vem sempre primeiro (impeditivo)', () => {
    const r = buildResumo(FISCAL_ATIVA, HIST_FORNECE, COM_SANCAO);
    expect(r.startsWith('⛔ sanção CEIS/CNEP')).toBe(true);
  });

  it('sem contratos públicos → "sem contratos públicos/12m"', () => {
    const r = buildResumo(FISCAL_ATIVA, HIST_NAO_FORNECE, SEM_SANCAO);
    expect(r).toContain('sem contratos públicos/12m');
  });

  it('histórico não consultado → omite o trecho de contratos', () => {
    const r = buildResumo(FISCAL_ATIVA, HIST_NAO_CONSULTADO, SEM_SANCAO);
    expect(r).not.toContain('contrato');
  });

  it('nenhuma fonte disponível → mensagem explícita', () => {
    const r = buildResumo(FISCAL_INDISPONIVEL, HIST_NAO_CONSULTADO, {
      enabled: false,
      consultado: false,
      temSancao: false,
      total: 0,
      amostra: [],
    });
    expect(r).toBe('Nenhuma fonte disponível');
  });

  it('singular quando é só 1 contrato', () => {
    const r = buildResumo(FISCAL_INDISPONIVEL, { ...HIST_FORNECE, totalItens: 1 }, SEM_SANCAO);
    expect(r).toContain('1 contrato público/12m');
  });
});

describe('enrichSupplier — composição fail-soft das 3 bases', () => {
  it('todas as fontes ok → agrega fiscal + histórico + sanções', async () => {
    vi.doMock('@/lib/fiscal/snapshot', () => ({
      fetchFiscalSnapshot: vi.fn().mockResolvedValue({}),
      snapshotToBadge: vi.fn().mockReturnValue(FISCAL_ATIVA),
    }));
    vi.doMock('@/lib/govdata/fornecedor', () => ({
      historicoPublico: vi.fn().mockResolvedValue({
        cnpj: '00000000000191',
        consultado: true,
        forneceAoGoverno: true,
        totalItens: 5,
        amostra: 5,
        valorAmostra: 1000,
        ufs: ['SP', 'RJ'],
        nOrgaos: 2,
        razaoSocial: 'X',
        periodoMeses: 12,
      }),
    }));
    vi.doMock('@/lib/fiscal/sancoes', () => ({
      consultarSancoes: vi.fn().mockResolvedValue({
        enabled: true,
        consultado: true,
        sancoes: [],
      }),
    }));

    const { enrichSupplier } = await import('@/lib/suppliers/enrichment');
    const r = await enrichSupplier('00000000000191');
    expect(r.fiscal).toEqual(FISCAL_ATIVA);
    expect(r.historico.forneceAoGoverno).toBe(true);
    expect(r.historico.totalItens).toBe(5);
    expect(r.sancoes.temSancao).toBe(false);
    expect(r.resumo).toContain('ATIVA');
    expect(r.resumo).toContain('5 contratos públicos/12m');
  });

  it('uma fonte falha → as outras duas seguem disponíveis (fail-soft independente)', async () => {
    vi.doMock('@/lib/fiscal/snapshot', () => ({
      fetchFiscalSnapshot: vi.fn().mockRejectedValue(new Error('fiscal down')),
      snapshotToBadge: vi.fn(),
    }));
    vi.doMock('@/lib/govdata/fornecedor', () => ({
      historicoPublico: vi.fn().mockResolvedValue({
        cnpj: '00000000000191',
        consultado: true,
        forneceAoGoverno: false,
        totalItens: 0,
        amostra: 0,
        valorAmostra: 0,
        ufs: [],
        nOrgaos: 0,
        razaoSocial: '',
        periodoMeses: 12,
      }),
    }));
    vi.doMock('@/lib/fiscal/sancoes', () => ({
      consultarSancoes: vi.fn().mockResolvedValue({
        enabled: true,
        consultado: true,
        sancoes: [
          {
            fonte: 'CEIS',
            nome: 'X',
            tipo: 'Y',
            orgao: 'Z',
            dataInicio: '',
            dataFim: '',
          },
        ],
      }),
    }));

    const { enrichSupplier } = await import('@/lib/suppliers/enrichment');
    const r = await enrichSupplier('00000000000191');
    expect(r.fiscal.available).toBe(false);
    expect(r.historico.consultado).toBe(true);
    expect(r.sancoes.temSancao).toBe(true);
    expect(r.sancoes.total).toBe(1);
  });

  it('amostra de sanções é capada em 5', async () => {
    vi.doMock('@/lib/fiscal/snapshot', () => ({
      fetchFiscalSnapshot: vi.fn().mockResolvedValue({}),
      snapshotToBadge: vi.fn().mockReturnValue(FISCAL_INDISPONIVEL),
    }));
    vi.doMock('@/lib/govdata/fornecedor', () => ({
      historicoPublico: vi.fn().mockResolvedValue({
        cnpj: '00000000000191',
        consultado: false,
        forneceAoGoverno: false,
        totalItens: 0,
        amostra: 0,
        valorAmostra: 0,
        ufs: [],
        nOrgaos: 0,
        razaoSocial: '',
        periodoMeses: 12,
      }),
    }));
    const manySancoes = Array.from({ length: 8 }, (_, i) => ({
      fonte: 'CEIS' as const,
      nome: `X${i}`,
      tipo: 'Y',
      orgao: 'Z',
      dataInicio: '',
      dataFim: '',
    }));
    vi.doMock('@/lib/fiscal/sancoes', () => ({
      consultarSancoes: vi.fn().mockResolvedValue({
        enabled: true,
        consultado: true,
        sancoes: manySancoes,
      }),
    }));

    const { enrichSupplier } = await import('@/lib/suppliers/enrichment');
    const r = await enrichSupplier('00000000000191');
    expect(r.sancoes.total).toBe(8);
    expect(r.sancoes.amostra).toHaveLength(5);
  });
});
