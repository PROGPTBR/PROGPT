import { describe, expect, it } from 'vitest';
import { buildPorterPrompt, PORTER_SYSTEM_PROMPT } from '@/lib/assistants/porter';
import type { PorterParams, TemplateRow } from '@/lib/assistants/types';
import type { RetrievedChunk } from '@/lib/rag/types';

const baseParams: PorterParams = {
  categoria: 'Embalagens flexíveis',
  segmento: 'Direto',
  escopo: 'Brasil',
  observacoes: 'Spend anual ~R$ 50M; 3 fornecedores principais',
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

## 2. Ameaça de novos entrantes
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
    'As cinco forças de Porter determinam a atratividade estrutural de um setor: rivalidade entre concorrentes, ameaça de novos entrantes, ameaça de substitutos, poder dos fornecedores e poder dos compradores.',
  ord: 0,
  score: 0.9,
  rerankScore: 0.85,
  source: 'vector',
};

describe('buildPorterPrompt', () => {
  it('returns the canonical PORTER_SYSTEM_PROMPT as system', () => {
    const out = buildPorterPrompt(baseParams, baseTemplate, [], null);
    expect(out.system).toBe(PORTER_SYSTEM_PROMPT);
  });

  it('embeds form params in the user message', () => {
    const out = buildPorterPrompt(baseParams, baseTemplate, [], null);
    expect(out.user).toContain('Embalagens flexíveis');
    expect(out.user).toContain('Direto');
    expect(out.user).toContain('Brasil');
    expect(out.user).toContain('Spend anual ~R$ 50M');
  });

  it('renders placeholders inside the template head from form values', () => {
    const out = buildPorterPrompt(baseParams, baseTemplate, [], null);
    // {{categoria}} in the H1 should be resolved
    expect(out.user).toContain(
      'Análise das 5 Forças de Porter — Embalagens flexíveis',
    );
    expect(out.user).toContain('Segmento: Direto');
  });

  it('omits the verbatim tail (after the marker) from the prompt — assembled server-side', () => {
    const out = buildPorterPrompt(baseParams, baseTemplate, [], null);
    expect(out.user).not.toContain('Confidencialidade e metodologia');
  });

  it('includes retrieval chunks under the context section', () => {
    const out = buildPorterPrompt(baseParams, baseTemplate, [sampleChunk], null);
    expect(out.user).toContain('Porter — How Competitive Forces Shape Strategy');
    expect(out.user).toContain('cinco forças de Porter determinam');
  });

  it('falls back to "no chunks" copy when retrieval came back empty', () => {
    const out = buildPorterPrompt(baseParams, baseTemplate, [], null);
    expect(out.user).toMatch(/nenhum trecho relevante/i);
  });

  it('system prompt lists the five canonical forces by name', () => {
    expect(PORTER_SYSTEM_PROMPT).toMatch(/rivalidade/i);
    expect(PORTER_SYSTEM_PROMPT).toMatch(/novos entrantes/i);
    expect(PORTER_SYSTEM_PROMPT).toMatch(/substitutos/i);
    expect(PORTER_SYSTEM_PROMPT).toMatch(/fornecedores/i);
    expect(PORTER_SYSTEM_PROMPT).toMatch(/compradores/i);
  });

  it('system prompt enforces intensity classification + implication for buyer', () => {
    expect(PORTER_SYSTEM_PROMPT).toMatch(/baixa.*média.*alta|intensidade/i);
    expect(PORTER_SYSTEM_PROMPT).toMatch(/Implicação para o comprador/i);
  });

  it('system prompt cites Porter 1979 grounding', () => {
    expect(PORTER_SYSTEM_PROMPT).toMatch(/Porter \(1979/);
  });
});
