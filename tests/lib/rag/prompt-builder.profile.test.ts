import { describe, expect, it } from 'vitest';
import {
  buildPrompt,
  SYSTEM_PROMPT,
} from '@/lib/rag/prompt-builder';
import type {
  Classification,
  ProfileSnapshot,
  RetrievedChunk,
} from '@/lib/rag/types';

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

const sampleProfile: ProfileSnapshot = {
  id: 'a8c8eb1c-1234-4def-8abc-1234567890ab',
  nomeCategoria: 'Embalagens flexíveis',
  descricao: 'Filmes e laminados para embalagem primária e secundária.',
  subSegmentos: ['filmes laminados', 'sachets stand-up', 'rótulos'],
  escopoIncluido: 'Filmes mono e multicamada, rótulos termocontráteis.',
  escopoNaoIncluido: 'Caixas de papelão.',
  requisitosTecnicos: 'ABNT NBR 14937, espessura 80μm ±5%.',
  restricoesRegulatorias: 'ANVISA RDC 91/2001.',
  prioridadeEstrategica: 'qualidade',
};

describe('buildPrompt — profileContext (sub-projeto 34)', () => {
  it('without profileContext, the user message contains no active-profile block', () => {
    const { user } = buildPrompt(
      'O que é Kraljic?',
      [chunk('c1', 'kraljic text', 'Kraljic 1983')],
      ptClass,
    );
    expect(user).not.toContain('<active-profile>');
    expect(user).not.toContain('Categoria ativa');
  });

  it('with profileContext, emits active-profile block at the top of the user message', () => {
    const { user } = buildPrompt(
      'O que é Kraljic?',
      [chunk('c1', 'kraljic text', 'Kraljic 1983')],
      ptClass,
      sampleProfile,
    );
    expect(user).toContain('<active-profile>');
    expect(user).toContain('</active-profile>');
    expect(user).toContain('Embalagens flexíveis');
    expect(user).toContain('filmes laminados');
    expect(user).toContain('ABNT NBR 14937');
    expect(user).toContain('ANVISA RDC 91/2001');
    expect(user).toContain('qualidade');
    // The block must come BEFORE the chunks block.
    expect(user.indexOf('<active-profile>')).toBeLessThan(
      user.indexOf('Kraljic 1983'),
    );
  });

  it('with profileContext, instructs the LLM to direct the answer + not invent', () => {
    const { user } = buildPrompt(
      'Como reduzir spend nessa categoria?',
      [],
      ptClass,
      sampleProfile,
    );
    expect(user).toMatch(/[Dd]irecione|direcione/);
    expect(user).toMatch(/[Nn][Ãã]O invente|n[ãa]o invente/);
  });

  it('SYSTEM_PROMPT stays byte-identical with or without profileContext (prefix cache invariant)', () => {
    const without = buildPrompt(
      'q',
      [chunk('c1', 'content', 'Title')],
      ptClass,
    );
    const withProfile = buildPrompt(
      'q',
      [chunk('c1', 'content', 'Title')],
      ptClass,
      sampleProfile,
    );
    expect(without.system).toBe(withProfile.system);
    expect(without.system).toBe(SYSTEM_PROMPT);
  });

  it('omits escopoNaoIncluido and restricoesRegulatorias lines when blank', () => {
    const minimal: ProfileSnapshot = {
      ...sampleProfile,
      escopoNaoIncluido: '',
      restricoesRegulatorias: '',
    };
    const { user } = buildPrompt('q', [], ptClass, minimal);
    expect(user).not.toContain('Escopo NÃO incluído');
    expect(user).not.toContain('Restrições regulatórias');
  });

  it('English language switches the heading text but preserves the block structure', () => {
    const enClass: Classification = { ...ptClass, language: 'en' };
    const { user } = buildPrompt('q', [], enClass, sampleProfile);
    expect(user).toContain('Active category');
    expect(user).toContain('<active-profile>');
    expect(user).toMatch(/Direct your answer|Do NOT invent/);
  });
});
