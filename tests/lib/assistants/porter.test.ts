import { describe, expect, it } from 'vitest';
import {
  buildPorterPrompt,
  classifyPorterForces,
  PORTER_SYSTEM_PROMPT,
} from '@/lib/assistants/porter';
import { PORTER_STATEMENTS } from '@/lib/assistants/porter-statements';
import type {
  PorterParams,
  PorterStatementScore,
  TemplateRow,
} from '@/lib/assistants/types';
import type { RetrievedChunk } from '@/lib/rag/types';

// Helper: build a 35-row statements array with the same (weight, score)
// applied to every statement.
function uniformStatements(
  weight: number,
  score: number,
): PorterStatementScore[] {
  return PORTER_STATEMENTS.map((s) => ({ id: s.id, weight, score }));
}

const baseParams: PorterParams = {
  categoria: 'Embalagens flexíveis',
  segmento: 'Direto',
  escopo: 'Brasil',
  observacoes: 'Spend anual ~R$ 50M; 3 fornecedores principais',
  statements: uniformStatements(2, 3),
};

const baseTemplate: TemplateRow = {
  id: 'tpl-porter-1',
  assistant_type: 'porter',
  name: 'Template padrão',
  description: 'Template canônico das 5 Forças',
  body_md: `# Análise das 5 Forças de Porter — {{categoria}}

> Segmento: {{segmento}}
> Escopo: {{escopo}}

## 1. Rivalidade entre concorrentes
(análise)

<!-- @verbatim-from-here -->

## Apêndice
Confidencialidade e metodologia.`,
  created_by: null,
  created_at: '2026-05-19T00:00:00Z',
  updated_at: '2026-05-19T00:00:00Z',
};

const sampleChunk: RetrievedChunk = {
  chunkId: 'c1',
  articleId: 'a1',
  articleTitle: 'Porter — How Competitive Forces Shape Strategy (HBR 1979)',
  content:
    'As cinco forças de Porter determinam a atratividade estrutural de um setor.',
  ord: 0,
  vectorRank: 1,
  ftsRank: 1,
  rrfScore: 0.5,
  rerankScore: 0.85,
};

describe('classifyPorterForces', () => {
  it('groups statements by force and computes weighted average per force', () => {
    const out = classifyPorterForces(uniformStatements(2, 3));
    expect(out.byForce).toHaveLength(5);
    for (const f of out.byForce) {
      expect(f.weightedAvg).toBeCloseTo(3, 2);
      expect(f.intensity).toBe('media'); // 2 ≤ 3 < 3.5
    }
  });

  it('classifies intensity as baixa for low scores', () => {
    const out = classifyPorterForces(uniformStatements(2, 1));
    expect(out.overallIntensity).toBe('baixa');
    expect(out.byForce.every((f) => f.intensity === 'baixa')).toBe(true);
  });

  it('classifies intensity as alta for high scores', () => {
    const out = classifyPorterForces(uniformStatements(3, 5));
    expect(out.overallIntensity).toBe('alta');
    expect(out.byForce.every((f) => f.intensity === 'alta')).toBe(true);
  });

  it('excludes weight=0 statements from the weighted average', () => {
    // Only the first statement of force-1 (poder-fornecedor) has weight,
    // and it's scored 5. The whole force avg should be 5, not diluted by
    // the other zeros.
    const scores = PORTER_STATEMENTS.map((s, i) => ({
      id: s.id,
      weight: i === 0 ? 3 : 0,
      score: i === 0 ? 5 : 3,
    }));
    const out = classifyPorterForces(scores);
    const supForce = out.byForce.find((f) => f.force === 'poder-fornecedor');
    expect(supForce!.weightedAvg).toBeCloseTo(5, 2);
    // Forces with no weighted statements get 0 (treated as "not enough data").
    const otherForces = out.byForce.filter(
      (f) => f.force !== 'poder-fornecedor',
    );
    expect(otherForces.every((f) => f.weightedAvg === 0)).toBe(true);
  });

  it('surfaces top-3 drivers (highest weight × score) per force', () => {
    // Force the first statement of "rivalidade" (S5-1) to have the
    // highest weight*score combo so it shows up as a top driver.
    const scores: PorterStatementScore[] = PORTER_STATEMENTS.map((s) => ({
      id: s.id,
      weight: s.id === 'S5-1' ? 3 : 1,
      score: s.id === 'S5-1' ? 5 : 2,
    }));
    const out = classifyPorterForces(scores);
    const riv = out.byForce.find((f) => f.force === 'rivalidade')!;
    expect(riv.topDrivers[0]?.id).toBe('S5-1');
    expect(riv.topDrivers.length).toBeLessThanOrEqual(3);
  });

  it('returns overallAvg=0 when every statement is weight=0 (no data)', () => {
    const out = classifyPorterForces(uniformStatements(0, 3));
    expect(out.overallAvg).toBe(0);
  });
});

describe('buildPorterPrompt', () => {
  it('returns the canonical PORTER_SYSTEM_PROMPT as system', () => {
    const cls = classifyPorterForces(baseParams.statements);
    const out = buildPorterPrompt(baseParams, baseTemplate, [], cls, null);
    expect(out.system).toBe(PORTER_SYSTEM_PROMPT);
  });

  it('embeds the deterministic classification block', () => {
    const cls = classifyPorterForces(baseParams.statements);
    const out = buildPorterPrompt(baseParams, baseTemplate, [], cls, null);
    expect(out.user).toContain('<porter-classification>');
    expect(out.user).toContain('Atratividade geral do setor');
    // All forces named in the classification block.
    expect(out.user).toMatch(/Rivalidade entre concorrentes/);
    expect(out.user).toMatch(/Poder de barganha dos fornecedores/);
    expect(out.user).toMatch(/Poder de barganha dos compradores/);
  });

  it('renders placeholders inside the template head from form values', () => {
    const cls = classifyPorterForces(baseParams.statements);
    const out = buildPorterPrompt(baseParams, baseTemplate, [], cls, null);
    expect(out.user).toContain(
      'Análise das 5 Forças de Porter — Embalagens flexíveis',
    );
    expect(out.user).toContain('Segmento: Direto');
  });

  it('omits the verbatim tail from the prompt — assembled server-side', () => {
    const cls = classifyPorterForces(baseParams.statements);
    const out = buildPorterPrompt(baseParams, baseTemplate, [], cls, null);
    expect(out.user).not.toContain('Confidencialidade e metodologia');
  });

  it('includes retrieval chunks under the context section', () => {
    const cls = classifyPorterForces(baseParams.statements);
    const out = buildPorterPrompt(
      baseParams,
      baseTemplate,
      [sampleChunk],
      cls,
      null,
    );
    expect(out.user).toContain('Porter — How Competitive Forces Shape Strategy');
  });

  it('system prompt instructs LLM to NOT contradict the deterministic classification', () => {
    expect(PORTER_SYSTEM_PROMPT).toMatch(/INPUT.*não.*reclassifique|NÃO reclassifique/i);
  });

  it('classification block lists all five forces by their canonical labels', () => {
    const cls = classifyPorterForces(baseParams.statements);
    const out = buildPorterPrompt(baseParams, baseTemplate, [], cls, null);
    expect(out.user).toMatch(/Rivalidade entre concorrentes/);
    expect(out.user).toMatch(/Ameaça de novos entrantes/);
    expect(out.user).toMatch(/Ameaça de produtos substitutos/);
    expect(out.user).toMatch(/Poder de barganha dos fornecedores/);
    expect(out.user).toMatch(/Poder de barganha dos compradores/);
  });

  it('system prompt anchors the 5-forces framework concept', () => {
    expect(PORTER_SYSTEM_PROMPT).toMatch(/5 Forças|cinco forças|5 forças/i);
  });

  it('system prompt cites Porter 1979/1985 grounding', () => {
    expect(PORTER_SYSTEM_PROMPT).toMatch(/Porter \(1979/);
  });
});
