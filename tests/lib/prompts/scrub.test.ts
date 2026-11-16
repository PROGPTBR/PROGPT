import { describe, expect, it } from 'vitest';
import { scrubBranding } from '@/lib/prompts/scrub';

describe('scrubBranding', () => {
  it('replaces "PRO AI CIRCLE" (spaced, any case) with 2BSUPPLY.IA', () => {
    const r = scrubBranding('Bem-vindo à PRO AI CIRCLE, sua comunidade.');
    expect(r.text).toContain('2BSUPPLY.IA');
    expect(r.text.toLowerCase()).not.toContain('pro ai circle');
    expect(r.changed).toBe(true);
  });

  it('replaces the concatenated "ProAICircle"', () => {
    const r = scrubBranding('Equipe ProAICircle');
    expect(r.text).toBe('Equipe 2BSUPPLY.IA');
    expect(r.changed).toBe(true);
  });

  it('replaces the slug "pro-ai-circle"', () => {
    const r = scrubBranding('repo pro-ai-circle aqui');
    expect(r.text).toBe('repo 2BSUPPLY.IA aqui');
  });

  it('replaces IAgentics / iAgentics / iagentics (case-insensitive) with 2BSUPPLY.IA', () => {
    expect(scrubBranding('pela IAgentics').text).toBe('pela 2BSUPPLY.IA');
    expect(scrubBranding('pela iAgentics').text).toBe('pela 2BSUPPLY.IA');
    expect(scrubBranding('pela iagentics').text).toBe('pela 2BSUPPLY.IA');
  });

  it('removes DealSim references without breaking the sentence', () => {
    const r = scrubBranding('Use o DealSim para treinar.');
    expect(r.text.toLowerCase()).not.toContain('dealsim');
    expect(r.changed).toBe(true);
  });

  it('does NOT strip the unrelated word "simulation" (false-positive guard)', () => {
    const r = scrubBranding('Faça uma deal simulation completa.');
    expect(r.text).toContain('deal simulation');
    expect(r.changed).toBe(false);
  });

  it('removes brand URLs', () => {
    const r = scrubBranding('Acesse https://proaicircle.com/library para ver.');
    expect(r.text.toLowerCase()).not.toContain('proaicircle.com');
    expect(r.changed).toBe(true);
  });

  it('leaves clean procurement text untouched and reports changed=false', () => {
    const clean = 'Você é um especialista em compras. Analise [sua categoria] e os [fornecedores].';
    const r = scrubBranding(clean);
    expect(r.text).toBe(clean);
    expect(r.changed).toBe(false);
  });

  it('preserves [bracketed] placeholders', () => {
    const r = scrubBranding('Na IAgentics, preencha [sua lista aqui] e [orçamento].');
    expect(r.text).toContain('[sua lista aqui]');
    expect(r.text).toContain('[orçamento]');
  });

  it('collapses the extra space left by a removed token', () => {
    const r = scrubBranding('texto DealSim texto');
    expect(r.text).not.toContain('  '); // no double spaces
  });
});
