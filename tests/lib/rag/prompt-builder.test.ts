import { describe, expect, it } from 'vitest';
import type { Classification, RetrievedChunk } from '@/lib/rag/types';

function chunk(id: string, content: string, title: string): RetrievedChunk {
  return {
    chunkId: id,
    articleId: `art-${id}`,
    content,
    ord: 0,
    articleTitle: title,
    vectorRank: null,
    ftsRank: null,
    rrfScore: 0,
    rerankScore: null,
  };
}

const ptClass: Classification = {
  theory: null,
  intent: 'definition',
  language: 'pt',
  needsRetrieval: true,
};
const enClass: Classification = { ...ptClass, language: 'en' };

describe('rag prompt-builder', () => {
  it('still returns sources array with numbers (kept for admin/debug channel)', async () => {
    const { buildPrompt } = await import('@/lib/rag/prompt-builder');
    const result = buildPrompt(
      'q',
      [chunk('c1', 'a', 'TitleA'), chunk('c2', 'b', 'TitleB')],
      ptClass,
    );
    expect(result.sources.map((s) => s.number)).toEqual([1, 2]);
    expect(result.sources[0]?.articleTitle).toBe('TitleA');
  });

  it('does NOT emit [N] tokens in the user prompt context block', async () => {
    const { buildPrompt } = await import('@/lib/rag/prompt-builder');
    const result = buildPrompt(
      'q',
      [chunk('c1', 'content one', 'TitleA'), chunk('c2', 'content two', 'TitleB')],
      ptClass,
    );
    // Headings show only the title — no [1], [2] tokens
    expect(result.user).toContain('TitleA');
    expect(result.user).toContain('content one');
    expect(result.user).not.toMatch(/\[\d+\]/);
  });

  it('system prompt instructs the model NOT to cite sources or numbers', async () => {
    const { buildPrompt } = await import('@/lib/rag/prompt-builder');
    const result = buildPrompt('q', [chunk('a', 'x', 'T')], ptClass);
    expect(result.system.toLowerCase()).toContain('não mencione');
    expect(result.system).toMatch(/\[\d+\]|colchetes/i);
    // It should mention NOT to use brackets — confirm the prohibitive framing
    const lower = result.system.toLowerCase();
    expect(lower).toMatch(/não.*colchetes|sem.*colchetes/);
  });

  it('refusal rule lives in the system prompt (always available) and a no-context marker lands in the user message when chunks are empty', async () => {
    const { buildPrompt } = await import('@/lib/rag/prompt-builder');
    const result = buildPrompt('?', [], ptClass);
    // System always carries the rule, regardless of chunks
    expect(result.system.toLowerCase()).toMatch(/não\s+(tenho|tem)\s+fonte/);
    expect(result.system.toLowerCase()).toContain('não invente');
    // User message tells the model the lookup actually came back empty
    expect(result.user).toMatch(/nenhum trecho relevante|no relevant passage/i);
    expect(result.sources).toEqual([]);
    expect(result.user).toContain('?');
  });

  it('English classification puts the language directive in the USER message, not in the system prompt (system stays byte-stable)', async () => {
    const { buildPrompt } = await import('@/lib/rag/prompt-builder');
    const result = buildPrompt('What is Kraljic?', [], enClass);
    expect(result.user).toMatch(/respond in english/i);
    // Critical: language directive is NOT in system. System must stay
    // identical regardless of language so OpenAI's prefix cache still hits.
    expect(result.system).not.toMatch(/respond in english/i);
  });

  it('default Portuguese: no English directive injected anywhere', async () => {
    const { buildPrompt } = await import('@/lib/rag/prompt-builder');
    const result = buildPrompt('?', [], ptClass);
    expect(result.user).not.toMatch(/respond in english/i);
    expect(result.system).not.toMatch(/respond in english/i);
  });

  it('includes the persona and response-structure framing in system prompt', async () => {
    const { buildPrompt } = await import('@/lib/rag/prompt-builder');
    const result = buildPrompt('q', [chunk('a', 'A', 'T')], ptClass);
    expect(result.system).toMatch(/especialista/i);
    expect(result.system).toMatch(/procurement/i);
    expect(result.system).toMatch(/resposta direta/i);
    expect(result.system).toMatch(/aplicação prática/i);
  });

  it('system prompt is byte-identical across PT/EN classifications and across empty/non-empty chunks (the cache-stability invariant)', async () => {
    const { buildPrompt } = await import('@/lib/rag/prompt-builder');
    const a = buildPrompt('q1', [], ptClass);
    const b = buildPrompt('q2', [chunk('c', 'x', 'T')], ptClass);
    const c = buildPrompt('q3', [], enClass);
    const d = buildPrompt('q4', [chunk('c', 'x', 'T')], enClass);
    expect(a.system).toBe(b.system);
    expect(a.system).toBe(c.system);
    expect(a.system).toBe(d.system);
  });

  it('system prompt is large enough to clear OpenAI’s 1024-token prefix-cache threshold (chars/4 is a conservative proxy)', async () => {
    const { SYSTEM_PROMPT } = await import('@/lib/rag/prompt-builder');
    const approxTokens = Math.round(SYSTEM_PROMPT.length / 4);
    expect(approxTokens).toBeGreaterThanOrEqual(1024);
  });

  it('system prompt names the procurement framework anchors so the model can lean on them deliberately', async () => {
    const { SYSTEM_PROMPT } = await import('@/lib/rag/prompt-builder');
    // Smoke test that the framework reference block survived future edits
    expect(SYSTEM_PROMPT).toMatch(/Kraljic/);
    expect(SYSTEM_PROMPT).toMatch(/Porter/);
    expect(SYSTEM_PROMPT).toMatch(/Monczka/);
    expect(SYSTEM_PROMPT).toMatch(/TCO/);
    expect(SYSTEM_PROMPT).toMatch(/S2P|Source-to-Pay/i);
  });

  // ── senior-expertise rules (sub-projeto 15) ──────────────────────────────
  // These rules exist to fight the "B-grade textbook answer" failure mode:
  // model produces structurally-correct but generic responses that don't
  // demonstrate the 20-year-senior persona promised in the system prompt.

  it('demands authorship + year when the topic is a canonical framework', async () => {
    const { SYSTEM_PROMPT } = await import('@/lib/rag/prompt-builder');
    // Rule lives in the "Resposta direta" section
    expect(SYSTEM_PROMPT).toMatch(/cite autor e ano/i);
    // Concrete example with the canonical authors people forget
    expect(SYSTEM_PROMPT).toMatch(/HBR 1983/);
    expect(SYSTEM_PROMPT).toMatch(/Porter \(1979\)/);
  });

  it('demands FULL coverage when the framework has N named elements', async () => {
    const { SYSTEM_PROMPT } = await import('@/lib/rag/prompt-builder');
    // The "todos" mandate is the antidote to "covers 2 of 4 Kraljic quadrants"
    expect(SYSTEM_PROMPT).toMatch(/cobertura completa/i);
    expect(SYSTEM_PROMPT).toMatch(/aborde TODOS/);
    // Concrete failure pattern named so the model recognizes it
    expect(SYSTEM_PROMPT).toMatch(/alavancagem.*gargalo|gargalo.*alavancagem/i);
  });

  it('expands "aplicação prática" with a 4-element checklist (threshold/tool/cadence/pitfall)', async () => {
    const { SYSTEM_PROMPT } = await import('@/lib/rag/prompt-builder');
    expect(SYSTEM_PROMPT).toMatch(/threshold|crit[ée]rio mensur[áa]vel/i);
    expect(SYSTEM_PROMPT).toMatch(/ferramenta concreta/i);
    expect(SYSTEM_PROMPT).toMatch(/cad[êe]ncia de revis[ãa]o/i);
    expect(SYSTEM_PROMPT).toMatch(/armadilha/i);
  });

  it('adds optional "limitações ou evolução" section for framework-definition questions', async () => {
    const { SYSTEM_PROMPT } = await import('@/lib/rag/prompt-builder');
    expect(SYSTEM_PROMPT).toMatch(/limita[çc][õo]es ou evolu[çc][ãa]o/i);
    // Mentions an extension author so the model has a concrete example
    expect(SYSTEM_PROMPT).toMatch(/Gelderman/);
    expect(SYSTEM_PROMPT).toMatch(/diferencia.*Wikipedia/i);
  });

  it('mandates structured markdown for 2D and enumerated frameworks', async () => {
    const { SYSTEM_PROMPT } = await import('@/lib/rag/prompt-builder');
    // 2D frameworks → table/bullets with **bold** category names
    expect(SYSTEM_PROMPT).toMatch(/Frameworks bidimensionais/);
    expect(SYSTEM_PROMPT).toMatch(/tabela markdown|bullets estruturados/i);
    // Enumerated N-item lists must be bullets, not buried in prose
    expect(SYSTEM_PROMPT).toMatch(/nunca enterrados em prosa/i);
  });

  it('framework reference block carries explicit authorship for canonical entries', async () => {
    const { SYSTEM_PROMPT } = await import('@/lib/rag/prompt-builder');
    // The reference block is the source of truth the model leans on —
    // authorship must be embedded there, not just in the directive.
    expect(SYSTEM_PROMPT).toMatch(/Peter Kraljic/);
    expect(SYSTEM_PROMPT).toMatch(/Michael Porter/);
    expect(SYSTEM_PROMPT).toMatch(/Lisa Ellram/);
    expect(SYSTEM_PROMPT).toMatch(/Williamson/);
    expect(SYSTEM_PROMPT).toMatch(/Andrew Cox/);
  });

  it('Kraljic anchor lists all four quadrants with their canonical strategies', async () => {
    const { SYSTEM_PROMPT } = await import('@/lib/rag/prompt-builder');
    // If this regresses, "B-grade Kraljic" answers come back.
    expect(SYSTEM_PROMPT).toMatch(/alavancagem/i);
    expect(SYSTEM_PROMPT).toMatch(/estrat[ée]gico/i);
    expect(SYSTEM_PROMPT).toMatch(/gargalo/i);
    expect(SYSTEM_PROMPT).toMatch(/n[ãa]o-cr[íi]tico/i);
  });

  // ── assistant-redirect rule (post-Kraljic v2 fix) ────────────────────────
  // User reported the chat saying "Não tenho fonte" when asked for an RFQ
  // download, instead of pointing to /assistants/rfp. The system prompt
  // now has a "Ferramentas dedicadas" section that has priority over the
  // no-source refusal.

  it('system prompt names the dedicated tools with their URL paths', async () => {
    const { SYSTEM_PROMPT } = await import('@/lib/rag/prompt-builder');
    expect(SYSTEM_PROMPT).toMatch(/Ferramentas dedicadas/);
    expect(SYSTEM_PROMPT).toMatch(/\/assistants\/rfp/);
    expect(SYSTEM_PROMPT).toMatch(/\/assistants\/kraljic/);
  });

  it('redirect rule lists artifact-generation cues so the model recognizes them', async () => {
    const { SYSTEM_PROMPT } = await import('@/lib/rag/prompt-builder');
    // Concrete words the user is likely to use → forces the model to map
    // intent → tool instead of trying to satisfy via free text.
    expect(SYSTEM_PROMPT).toMatch(/baixar|download/i);
    expect(SYSTEM_PROMPT).toMatch(/template editável|modelo pronto/i);
    expect(SYSTEM_PROMPT).toMatch(/RFP|RFQ|cota[çc][ãa]o/);
  });

  it('redirect rule has explicit priority over the no-source-on-file refusal', async () => {
    const { SYSTEM_PROMPT } = await import('@/lib/rag/prompt-builder');
    // The ordering matters: the redirect rule must precede the refusal
    // AND the refusal section must reference the redirect priority so the
    // model doesn't fall through to "Não tenho fonte" for RFQ/Kraljic asks.
    const idxRedirect = SYSTEM_PROMPT.indexOf('Ferramentas dedicadas');
    const idxRefusal = SYSTEM_PROMPT.indexOf('Quando não há fonte na base');
    expect(idxRedirect).toBeGreaterThan(-1);
    expect(idxRefusal).toBeGreaterThan(-1);
    expect(idxRedirect).toBeLessThan(idxRefusal);
    expect(SYSTEM_PROMPT).toMatch(/tem prioridade sobre esta|prioridade/i);
  });

  it('redirect rule keeps theoretical questions in the chat (not bounced to tools)', async () => {
    const { SYSTEM_PROMPT } = await import('@/lib/rag/prompt-builder');
    expect(SYSTEM_PROMPT).toMatch(/puramente te[óo]rica|teórica/i);
    expect(SYSTEM_PROMPT).toMatch(/não substitui o ensino te[óo]rico|responda normalmente no chat/i);
  });

  // ── missing-referenced-input + refusal reframing ─────────────────────────
  // User pasted an instruction template containing "(cole abaixo)" WITHOUT the
  // actual strategic plan. The chat opened with "Não tenho fonte" AND then
  // answered generically — inconsistent. Two fixes: (1) ask for the missing
  // input instead of refusing/generizing, (2) stop the refuse-then-answer
  // contradiction.

  it('instructs the model to ask for referenced content the user did not paste', async () => {
    const { SYSTEM_PROMPT } = await import('@/lib/rag/prompt-builder');
    // Names placeholder cues so the model recognizes a dangling reference
    expect(SYSTEM_PROMPT).toMatch(/cole abaixo/i);
    expect(SYSTEM_PROMPT).toMatch(/segue abaixo|conforme o documento|anexo/i);
    // Mandated action is to ASK for the material, not refuse/genericize
    expect(SYSTEM_PROMPT).toMatch(/pe[çc]a.*material|pe[çc]a.*colar|cole aqui/i);
  });

  it('refusal rule forbids the refuse-then-answer contradiction', async () => {
    const { SYSTEM_PROMPT } = await import('@/lib/rag/prompt-builder');
    // Either refuse OR help — not both in the same breath
    expect(SYSTEM_PROMPT).toMatch(/ou você recusa, ou você ajuda|não os dois/i);
    // When it can help via general principles, it should just answer (soft signal)
    expect(SYSTEM_PROMPT).toMatch(
      /orienta[çc][ãa]o geral|princípio.*consolidado|em termos gerais/i,
    );
  });

  it('missing-input ask has priority over the no-source refusal', async () => {
    const { SYSTEM_PROMPT } = await import('@/lib/rag/prompt-builder');
    const idxMissing = SYSTEM_PROMPT.indexOf('referencia um material que não está');
    const idxRefusal = SYSTEM_PROMPT.indexOf('Quando não há fonte na base');
    expect(idxMissing).toBeGreaterThan(-1);
    expect(idxRefusal).toBeGreaterThan(-1);
    expect(idxMissing).toBeLessThan(idxRefusal);
  });

  it('still keeps the hard "no source" phrase available for genuinely out-of-domain asks', async () => {
    const { SYSTEM_PROMPT } = await import('@/lib/rag/prompt-builder');
    expect(SYSTEM_PROMPT.toLowerCase()).toMatch(/não\s+(tenho|tem)\s+fonte/);
  });
});

// ── library_overview branch (sub-projeto 18) ─────────────────────────────
describe('buildLibraryOverviewPrompt', () => {
  const snapshot = {
    totalArticles: 96,
    themes: [
      { theme: 'Digital / Tecnologia', count: 19, status: 'canonical' as const },
      { theme: 'Gestão da Cadeia de Suprimentos', count: 11, status: 'candidate' as const },
      { theme: 'Risco / Resiliência', count: 10, status: 'canonical' as const },
    ],
  };

  it('injects the snapshot data and total into the user message (PT)', async () => {
    const { buildLibraryOverviewPrompt } = await import('@/lib/rag/prompt-builder');
    const out = buildLibraryOverviewPrompt('que temas você cobre?', snapshot, ptClass);
    expect(out.user).toMatch(/Snapshot da base/);
    expect(out.user).toMatch(/Total de artigos: 96/);
    expect(out.user).toMatch(/\*\*Digital \/ Tecnologia\*\* — 19 artigos/);
    expect(out.user).toMatch(/\*\*Risco \/ Resili[êe]ncia\*\* — 10 artigos/);
    expect(out.user).toMatch(/que temas você cobre\?/);
    expect(out.sources).toEqual([]);
  });

  it('singular "artigo" vs plural "artigos" formatting', async () => {
    const { buildLibraryOverviewPrompt } = await import('@/lib/rag/prompt-builder');
    const out = buildLibraryOverviewPrompt('?', {
      totalArticles: 1,
      themes: [{ theme: 'Kraljic', count: 1, status: 'canonical' }],
    }, ptClass);
    expect(out.user).toMatch(/1 artigo(?!s)/);
  });

  it('forbids invention with explicit "do not invent" / "NÃO invente" instruction', async () => {
    const { buildLibraryOverviewPrompt } = await import('@/lib/rag/prompt-builder');
    const out = buildLibraryOverviewPrompt('?', snapshot, ptClass);
    expect(out.user).toMatch(/N[ÃA]O invente/);
    expect(out.user).toMatch(/N[ÃA]O recuse/);
  });

  it('emits the snapshot in English when classification.language === "en"', async () => {
    const { buildLibraryOverviewPrompt } = await import('@/lib/rag/prompt-builder');
    const out = buildLibraryOverviewPrompt(
      'what topics do you cover?',
      snapshot,
      enClass,
    );
    expect(out.user).toMatch(/Library snapshot/);
    expect(out.user).toMatch(/Total articles: 96/);
    expect(out.user).toMatch(/do not invent themes/i);
    expect(out.user).toMatch(/Respond in English/);
  });

  it('caps theme list at 12 entries even when many themes exist', async () => {
    const manyThemes = Array.from({ length: 25 }, (_, i) => ({
      theme: `Tema ${i}`,
      count: 25 - i,
      status: 'canonical' as const,
    }));
    const { buildLibraryOverviewPrompt } = await import('@/lib/rag/prompt-builder');
    const out = buildLibraryOverviewPrompt('?', { totalArticles: 100, themes: manyThemes }, ptClass);
    // Tema 0 (count=25) appears, Tema 13+ should not (12 entries max)
    expect(out.user).toMatch(/Tema 0/);
    expect(out.user).not.toMatch(/Tema 13/);
  });

  it('omits themes with count=0 from the list (no empty canonical noise)', async () => {
    const { buildLibraryOverviewPrompt } = await import('@/lib/rag/prompt-builder');
    const out = buildLibraryOverviewPrompt('?', {
      totalArticles: 5,
      themes: [
        { theme: 'Kraljic', count: 5, status: 'canonical' },
        { theme: 'TCO', count: 0, status: 'canonical' },
      ],
    }, ptClass);
    expect(out.user).toMatch(/Kraljic/);
    // TCO is empty — don't list it
    expect(out.user).not.toMatch(/\*\*TCO\*\*/);
  });

  it('reuses the same SYSTEM_PROMPT (cache-stable, no fork)', async () => {
    const { buildLibraryOverviewPrompt, SYSTEM_PROMPT } = await import(
      '@/lib/rag/prompt-builder'
    );
    const out = buildLibraryOverviewPrompt('?', snapshot, ptClass);
    expect(out.system).toBe(SYSTEM_PROMPT);
  });
});
