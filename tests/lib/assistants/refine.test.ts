import { describe, expect, it } from 'vitest';
import { buildRefineSystem, RFP_REFINE_SYSTEM_PROMPT } from '@/lib/assistants/refine';
import type { RfpParams } from '@/lib/assistants/types';
import type { RetrievedChunk } from '@/lib/rag/types';

const params: RfpParams = {
  client: 'Embraer S.A.',
  scope: 'Software de gestão de frota com 200+ veículos',
  category: 'TI / Software',
  deadline: '30 dias',
  budget: 'R$ 200k–400k/ano',
  criteria: ['Preço', 'SLA'],
  notes: '',
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

const rfpMd = '# RFP — Software de frota\n\n## 1. Apresentação\n\nTexto do RFP gerado…';

describe('buildRefineSystem', () => {
  it('includes the RFP markdown inside <rfp> tags', () => {
    const out = buildRefineSystem(rfpMd, params, []);
    expect(out).toMatch(/<rfp>[\s\S]*?# RFP — Software de frota[\s\S]*?<\/rfp>/);
  });

  it('embeds the original params (client, scope, criteria)', () => {
    const out = buildRefineSystem(rfpMd, params, []);
    expect(out).toMatch(/Empresa contratante: Embraer S\.A\./);
    expect(out).toMatch(/Categoria: TI \/ Software/);
    expect(out).toMatch(/Preço, SLA/);
  });

  it('falls back gracefully when no chunks were retrieved', () => {
    const out = buildRefineSystem(rfpMd, params, []);
    expect(out).toMatch(/nenhum trecho relevante recuperado/);
  });

  it('formats retrieved chunks under <base>', () => {
    const chunks = [
      chunk('a', 'Kraljic 1983', 'Matriz de Kraljic para segmentação de risco.'),
      chunk('b', 'Lei 14.133', 'Governança em compras públicas.'),
    ];
    const out = buildRefineSystem(rfpMd, params, chunks);
    expect(out).toMatch(/<base>[\s\S]*Kraljic 1983[\s\S]*Lei 14\.133[\s\S]*<\/base>/);
  });

  it('system prompt forbids invented sources and conversational preamble', () => {
    expect(RFP_REFINE_SYSTEM_PROMPT).toMatch(/Sem preâmbulo conversacional|sem preâmbulo|sem preambulo|Sem preâmbulo/i);
    expect(RFP_REFINE_SYSTEM_PROMPT).toMatch(/NÃO cite autores/);
  });
});
