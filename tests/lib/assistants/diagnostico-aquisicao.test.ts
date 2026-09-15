import { describe, expect, it } from 'vitest';
import { classifyAquisicao } from '@/lib/assistants/diagnostico-aquisicao';
import type {
  DiagnosticoAquisicaoParams,
  DiagnosticoNivel,
  DiagnosticoImpacto,
} from '@/lib/assistants/types';
import { DIAGNOSTICO_NIVEL, DIAGNOSTICO_IMPACTO } from '@/lib/assistants/types';

function baseParams(
  overrides: Partial<DiagnosticoAquisicaoParams> = {},
): DiagnosticoAquisicaoParams {
  return {
    descricaoCompra: 'Empilhadeira elétrica',
    categoria: '',
    classificacao: 'CAPEX',
    natureza: 'produto',
    criticidade: 'media',
    complexidadeMercado: 'media',
    impactoOperacional: 'medio',
    notes: '',
    ...overrides,
  };
}

describe('classifyAquisicao', () => {
  it('recommends the CAPEX KPI list without touching the OPEX list', () => {
    const out = classifyAquisicao(baseParams({ classificacao: 'CAPEX' }));
    expect(out.kpis).toContain('TCO');
    expect(out.kpis).toContain('ROI');
    expect(out.kpis).not.toContain('Saving');
    expect(out.kpis).not.toContain('OTIF');
  });

  it('recommends the OPEX KPI list without touching the CAPEX list', () => {
    const out = classifyAquisicao(baseParams({ classificacao: 'OPEX' }));
    expect(out.kpis).toContain('Saving');
    expect(out.kpis).toContain('OTIF');
    expect(out.kpis).not.toContain('TCO');
    expect(out.kpis).not.toContain('VPL');
  });

  it('never lets the OPEX/CAPEX input flip in the output — classification is a pass-through, not a derived field', () => {
    const capex = classifyAquisicao(baseParams({ classificacao: 'CAPEX' }));
    const opex = classifyAquisicao(baseParams({ classificacao: 'OPEX' }));
    // classifyAquisicao doesn't echo `classificacao` back — the caller keeps
    // the original params object, which is the actual guarantee. This test
    // documents that the KPI lists are disjoint per classification, which is
    // the only way the classification could leak into the wrong bucket.
    const overlap = capex.kpis.filter((k) => opex.kpis.includes(k));
    expect(overlap).toHaveLength(0);
  });

  it('recommends SOURCE when criticidade, complexidade and impacto are all alta/alto', () => {
    const out = classifyAquisicao(
      baseParams({ criticidade: 'alta', complexidadeMercado: 'alta', impactoOperacional: 'alto' }),
    );
    expect(out.leaning).toBe('SOURCE');
    expect(out.totalScore).toBe(9);
  });

  it('recommends BUY when criticidade, complexidade and impacto are all baixa/baixo', () => {
    const out = classifyAquisicao(
      baseParams({
        criticidade: 'baixa',
        complexidadeMercado: 'baixa',
        impactoOperacional: 'baixo',
      }),
    );
    expect(out.leaning).toBe('BUY');
    expect(out.totalScore).toBe(3);
  });

  it('recommends CONTRACT for a middling combination', () => {
    const out = classifyAquisicao(
      baseParams({
        criticidade: 'media',
        complexidadeMercado: 'media',
        impactoOperacional: 'medio',
      }),
    );
    expect(out.leaning).toBe('CONTRACT');
    expect(out.totalScore).toBe(6);
  });

  it('produces a leaning + score for every one of the 27 criticidade × complexidade × impacto combinations', () => {
    for (const criticidade of DIAGNOSTICO_NIVEL as readonly DiagnosticoNivel[]) {
      for (const complexidadeMercado of DIAGNOSTICO_NIVEL as readonly DiagnosticoNivel[]) {
        for (const impactoOperacional of DIAGNOSTICO_IMPACTO as readonly DiagnosticoImpacto[]) {
          const out = classifyAquisicao(
            baseParams({ criticidade, complexidadeMercado, impactoOperacional }),
          );
          expect(out.totalScore).toBeGreaterThanOrEqual(3);
          expect(out.totalScore).toBeLessThanOrEqual(9);
          expect(['SOURCE', 'CONTRACT', 'BUY']).toContain(out.leaning);
        }
      }
    }
  });
});
