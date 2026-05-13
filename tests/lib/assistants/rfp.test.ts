import { describe, expect, it } from 'vitest';
import { buildRfpPrompt, RFP_SYSTEM_PROMPT } from '@/lib/assistants/rfp';
import type { RfpParams, TemplateRow } from '@/lib/assistants/types';
import type { RetrievedChunk } from '@/lib/rag/types';

const baseParams: RfpParams = {
  scope: 'Software de gestão de frota com 200+ veículos',
  category: 'TI / Software',
  deadline: '30 dias',
  budget: 'R$ 200k–400k/ano',
  criteria: ['Preço', 'SLA', 'ISO 27001'],
  notes: 'Integração SAP obrigatória',
};

const template: TemplateRow = {
  id: 'tpl-1',
  assistant_type: 'rfp',
  name: 'RFP Padrão',
  description: 'Template genérico de RFP corporativo',
  body_md: '# RFP {{categoria}}\n\n## Escopo\n\n{{escopo}}',
  created_by: null,
  created_at: '2026-05-12T00:00:00Z',
  updated_at: '2026-05-12T00:00:00Z',
};

function chunk(id: string, title: string, content: string): RetrievedChunk {
  return {
    chunkId: id,
    articleId: `art-${id}`,
    content,
    ord: 0,
    articleTitle: title,
    vectorRank: null,
    ftsRank: null,
    rrfScore: 0,
    rerankScore: 0.5,
  };
}

describe('buildRfpPrompt', () => {
  it('returns { system, user } with the RFP-specific system prompt', () => {
    const out = buildRfpPrompt(baseParams, template, []);
    expect(out.system).toBe(RFP_SYSTEM_PROMPT);
    expect(out.system).toMatch(/especialista sênior em procurement/);
    expect(out.system).toMatch(/RFP/);
  });

  it('injects every form param into the user message', () => {
    const out = buildRfpPrompt(baseParams, template, []);
    expect(out.user).toMatch(/Software de gestão de frota/);
    expect(out.user).toMatch(/TI \/ Software/);
    expect(out.user).toMatch(/30 dias/);
    expect(out.user).toMatch(/R\$ 200k–400k/);
    expect(out.user).toMatch(/Preço/);
    expect(out.user).toMatch(/SLA/);
    expect(out.user).toMatch(/ISO 27001/);
    expect(out.user).toMatch(/Integração SAP obrigatória/);
  });

  it('embeds the template body verbatim so the LLM follows the structure', () => {
    const out = buildRfpPrompt(baseParams, template, []);
    expect(out.user).toMatch(/# RFP \{\{categoria\}\}/);
    expect(out.user).toMatch(/RFP Padrão/);
    expect(out.user).toMatch(/Template genérico de RFP corporativo/);
  });

  it('formats retrieved chunks as fundamentation context', () => {
    const chunks = [
      chunk('a', 'Kraljic 1983', 'Conteúdo sobre a matriz de Kraljic e segmentação por risco.'),
      chunk('b', 'Lei 14.133', 'Governança em compras públicas após 2021.'),
    ];
    const out = buildRfpPrompt(baseParams, template, chunks);
    expect(out.user).toMatch(/Kraljic 1983/);
    expect(out.user).toMatch(/Lei 14\.133/);
    expect(out.user).toMatch(/matriz de Kraljic/);
  });

  it('falls back gracefully when no chunks were retrieved', () => {
    const out = buildRfpPrompt(baseParams, template, []);
    expect(out.user).toMatch(/nenhum trecho relevante recuperado/);
  });

  it('omits the "notas adicionais" block when notes is empty', () => {
    const out = buildRfpPrompt({ ...baseParams, notes: '' }, template, []);
    expect(out.user).not.toMatch(/Notas adicionais do comprador/);
  });

  it('handles empty criteria array with a fallback message (not just empty bullet)', () => {
    const out = buildRfpPrompt({ ...baseParams, criteria: [] }, template, []);
    expect(out.user).toMatch(/usar critérios padrão de procurement sênior/);
  });

  it('system prompt forbids placeholder leakage in output', () => {
    expect(RFP_SYSTEM_PROMPT).toMatch(/NÃO deixe placeholders no output final/);
  });

  it('system prompt mandates markdown structure (renderable + docx-friendly)', () => {
    expect(RFP_SYSTEM_PROMPT).toMatch(/Markdown bem estruturado/);
  });

  it('system prompt explicitly forbids preâmbulo and chat-style epilogue', () => {
    expect(RFP_SYSTEM_PROMPT).toMatch(/preâmbulo nem epílogo/);
  });
});
