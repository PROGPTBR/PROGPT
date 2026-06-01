import { describe, expect, it, vi } from 'vitest';
import type { GenEvalRow, GenGoldenCase } from '@/lib/rag/gen-eval';

const kraljicCase: GenGoldenCase = {
  id: 'k1',
  question: 'O que é a Matriz de Kraljic?',
  language: 'pt',
  intent: 'definition',
  dimensions: ['framework_coverage', 'authorship'],
  mustChecks: ['menciona os 4 quadrantes', 'cita Kraljic 1983'],
};

describe('gen-eval pure helpers', () => {
  it('buildJudgePrompt embeds question, answer, applicable dimensions and must-checks', async () => {
    const { buildJudgePrompt } = await import('@/lib/rag/gen-eval');
    const { system, user } = buildJudgePrompt(
      kraljicCase,
      'A matriz de Kraljic tem 4 quadrantes...',
    );
    expect(system.toLowerCase()).toMatch(/avalia|juiz|especialista|grade/);
    expect(user).toContain('O que é a Matriz de Kraljic?');
    expect(user).toContain('A matriz de Kraljic tem 4 quadrantes...');
    expect(user).toContain('menciona os 4 quadrantes');
    expect(user).toContain('cita Kraljic 1983');
    // only the applicable dimensions are surfaced to the judge
    expect(user).toContain('framework_coverage');
    expect(user).toContain('authorship');
    expect(user).not.toContain('instruction_following');
  });

  it('deriveVerdict passes only when overall >= threshold AND every check passes', async () => {
    const { deriveVerdict } = await import('@/lib/rag/gen-eval');
    const base = {
      dimensionScores: [],
      overall: 4,
      checks: [{ check: 'a', pass: true }],
    };
    expect(deriveVerdict(base)).toBe('pass');
    expect(deriveVerdict({ ...base, overall: 3 })).toBe('fail'); // below threshold
    expect(deriveVerdict({ ...base, checks: [{ check: 'a', pass: false }] })).toBe(
      'fail',
    ); // a check failed
    expect(deriveVerdict({ ...base, checks: [] })).toBe('pass'); // no checks + high overall
  });

  it('aggregate computes passRate, avgOverall, per-dimension avg and checkPassRate', async () => {
    const { aggregate } = await import('@/lib/rag/gen-eval');
    const rows: GenEvalRow[] = [
      {
        id: 'a',
        question: '',
        answer: '',
        verdict: 'pass',
        judge: {
          overall: 4,
          dimensionScores: [{ key: 'structure', score: 4, reason: '' }],
          checks: [{ check: 'x', pass: true }],
        },
      },
      {
        id: 'b',
        question: '',
        answer: '',
        verdict: 'fail',
        judge: {
          overall: 2,
          dimensionScores: [{ key: 'structure', score: 2, reason: '' }],
          checks: [{ check: 'y', pass: false }],
        },
      },
    ];
    const s = aggregate(rows);
    expect(s.total).toBe(2);
    expect(s.passed).toBe(1);
    expect(s.passRate).toBeCloseTo(0.5, 4);
    expect(s.avgOverall).toBeCloseTo(3, 4);
    expect(s.byDimension.structure).toBeCloseTo(3, 4);
    expect(s.checkPassRate).toBeCloseTo(0.5, 4);
  });
});

describe('judgeAnswer', () => {
  it('calls the judge model and parses structured output', async () => {
    vi.resetModules();
    const create = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              dimensionScores: [{ key: 'authorship', score: 5, reason: 'cita 1983' }],
              checks: [{ check: 'cita Kraljic 1983', pass: true }],
              overall: 4.5,
            }),
          },
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 20 },
    });
    vi.doMock('@/lib/llm/openai', () => ({
      getOpenAI: () => ({ chat: { completions: { create } } }),
    }));
    const { judgeAnswer } = await import('@/lib/rag/gen-eval');
    const res = await judgeAnswer(kraljicCase, 'resposta', { judgeModel: 'gpt-4o' });
    expect(res.overall).toBe(4.5);
    expect(res.checks[0]!.pass).toBe(true);
    expect(create).toHaveBeenCalledOnce();
    expect(create.mock.calls[0]![0].model).toBe('gpt-4o');
    vi.doUnmock('@/lib/llm/openai');
  });
});
