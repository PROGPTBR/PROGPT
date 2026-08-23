import { describe, expect, it } from 'vitest';
import {
  buildRfpPrompt,
  formatCommercialTerms,
  RFP_SYSTEM_PROMPT,
} from '@/lib/assistants/rfp';
import type { RfpParams, TemplateRow } from '@/lib/assistants/types';
import type { RetrievedChunk } from '@/lib/rag/types';

const baseParams: RfpParams = {
  client: 'Embraer S.A.',
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
    expect(out.user).toMatch(/Embraer S\.A\./);
    expect(out.user).toMatch(/Software de gestão de frota/);
    expect(out.user).toMatch(/TI \/ Software/);
    expect(out.user).toMatch(/30 dias/);
    expect(out.user).toMatch(/R\$ 200k–400k/);
    expect(out.user).toMatch(/Preço/);
    expect(out.user).toMatch(/SLA/);
    expect(out.user).toMatch(/ISO 27001/);
    expect(out.user).toMatch(/Integração SAP obrigatória/);
  });

  it('exposes the client (empresa contratante) in the params block', () => {
    const out = buildRfpPrompt(baseParams, template, []);
    expect(out.user).toMatch(/Empresa contratante.*Embraer S\.A\./s);
  });

  it('system prompt tells the LLM that placeholders arrive pre-resolved', () => {
    expect(RFP_SYSTEM_PROMPT).toMatch(/já chega com os valores reais resolvidos/);
    expect(RFP_SYSTEM_PROMPT).toMatch(/NÃO precisa preencher placeholders/);
  });

  it('embeds the template head with placeholders pre-rendered (no {{...}} leaks)', () => {
    const out = buildRfpPrompt(baseParams, template, []);
    // The template body uses {{categoria}} and {{escopo}} — these get
    // substituted server-side before reaching the LLM, so the prompt
    // contains the real values, not the literal placeholders.
    expect(out.user).toMatch(/# RFP TI \/ Software/);
    expect(out.user).toMatch(/Software de gestão de frota/);
    expect(out.user).not.toMatch(/\{\{categoria\}\}/);
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

  it('system prompt clarifies placeholders are pre-resolved (no leakage risk by design)', () => {
    expect(RFP_SYSTEM_PROMPT).toMatch(/já foram substituídos pelo sistema/);
  });

  it('system prompt mandates markdown structure (renderable + docx-friendly)', () => {
    expect(RFP_SYSTEM_PROMPT).toMatch(/Markdown bem estruturado/);
  });

  it('system prompt explicitly forbids preâmbulo and chat-style epilogue', () => {
    expect(RFP_SYSTEM_PROMPT).toMatch(/preâmbulo nem epílogo/);
  });

  it('system prompt scopes the LLM output to the customizable head only (no legal text)', () => {
    expect(RFP_SYSTEM_PROMPT).toMatch(/INTENCIONALMENTE truncado|truncado nas seções customizáveis/);
    expect(RFP_SYSTEM_PROMPT).toMatch(/NÃO invente cláusulas legais/);
    expect(RFP_SYSTEM_PROMPT).toMatch(/sistema vai acrescentá-las automaticamente/);
  });

  it('buildRfpPrompt slices the template at the @verbatim-from-here marker', () => {
    const templated: TemplateRow = {
      ...template,
      body_md:
        'Head section with {{escopo}}.\n\n<!-- @verbatim-from-here -->\n\nVerbatim tail not for LLM.',
    };
    const out = buildRfpPrompt(baseParams, templated, []);
    expect(out.user).toMatch(/Head section/);
    expect(out.user).not.toMatch(/Verbatim tail not for LLM/);
  });
});

// Condições comerciais da RFQ — backlog do diretor (2026-08-19, Batch I).
// A regra que importa: campo em branco NÃO vira linha no prompt, senão o
// modelo inventa Incoterm/prazo que o comprador nunca definiu.
describe('formatCommercialTerms', () => {
  it('returns an empty string when no commercial field was filled', () => {
    expect(formatCommercialTerms(baseParams)).toBe('');
  });

  it('renders only the filled fields, in the canonical order', () => {
    const out = formatCommercialTerms({
      ...baseParams,
      quantity: '12.000 unidades',
      incoterm: 'DAP',
      paymentTerms: '30 dias fora a quinzena',
    });
    expect(out).toContain('**Quantidade / unidade de fornecimento**: 12.000 unidades');
    expect(out).toContain('**Incoterm**: DAP');
    expect(out).toContain('**Condição de pagamento**: 30 dias fora a quinzena');
    expect(out).not.toContain('Local de entrega');
    expect(out).not.toContain('Moeda da proposta');
    expect(out.indexOf('Quantidade')).toBeLessThan(out.indexOf('Incoterm'));
    expect(out.indexOf('Incoterm')).toBeLessThan(out.indexOf('Condição de pagamento'));
  });

  it('ignores whitespace-only values', () => {
    expect(formatCommercialTerms({ ...baseParams, incoterm: '   ' })).toBe('');
  });

  it('spells out the sample requirement only when the flag is on', () => {
    expect(formatCommercialTerms({ ...baseParams, sampleRequired: true })).toContain(
      '**Amostra**: obrigatória',
    );
    expect(formatCommercialTerms({ ...baseParams, sampleRequired: false })).toBe('');
  });

  it('reaches the user prompt through buildRfpPrompt', () => {
    const filled = buildRfpPrompt(
      { ...baseParams, deliveryLocation: 'CD Cajamar/SP', sampleRequired: true },
      template,
      [],
    );
    expect(filled.user).toContain('**Local de entrega**: CD Cajamar/SP');
    expect(filled.user).toContain('**Amostra**: obrigatória');

    // E some por completo quando nada foi preenchido — sem cabeçalho órfão.
    const empty = buildRfpPrompt(baseParams, template, []);
    expect(empty.user).not.toContain('Local de entrega');
    expect(empty.user).not.toContain('Incoterm');
  });
});
