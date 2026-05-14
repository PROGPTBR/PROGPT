import { describe, expect, it } from 'vitest';
import {
  splitTemplateBody,
  renderTail,
  assembleOutput,
} from '@/lib/assistants/template-assembly';
import type { RfpParams } from '@/lib/assistants/types';

const params: RfpParams = {
  client: 'Embraer S.A.',
  scope: 'Software de gestão de frota',
  category: 'TI / Software',
  deadline: '30 dias',
  budget: 'R$ 200k/ano',
  criteria: ['Preço', 'SLA'],
  notes: 'Notas livres',
};

describe('splitTemplateBody', () => {
  it('returns { head, tail } when the marker is present', () => {
    const body = `# RFP

## 4. Critérios

Conteúdo.

<!-- @verbatim-from-here -->

## 5. Cotação

Texto verbatim.`;
    const { head, tail } = splitTemplateBody(body);
    expect(head).toMatch(/## 4\. Critérios/);
    expect(head).not.toMatch(/## 5\. Cotação/);
    expect(tail).not.toBeNull();
    expect(tail!).toMatch(/## 5\. Cotação/);
  });

  it('returns { head: full, tail: null } when no marker', () => {
    const body = '# RFP\n\nSem marker.';
    const { head, tail } = splitTemplateBody(body);
    expect(head).toBe(body);
    expect(tail).toBeNull();
  });

  it('takes only the first occurrence of the marker', () => {
    const body = `head\n<!-- @verbatim-from-here -->\nmiddle\n<!-- @verbatim-from-here -->\nend`;
    const { head, tail } = splitTemplateBody(body);
    expect(head).toBe('head');
    expect(tail).toMatch(/middle/);
    expect(tail).toMatch(/<!-- @verbatim-from-here -->/);
  });
});

describe('renderTail', () => {
  it('substitutes every supported placeholder', () => {
    const tail =
      'Cliente: {{cliente}} | Categoria: {{categoria}} | Escopo: {{escopo}} | Prazo: {{prazo}} | Orçamento: {{orcamento}} | Notas: {{notas}}';
    const out = renderTail(tail, params);
    expect(out).toContain('Embraer S.A.');
    expect(out).toContain('TI / Software');
    expect(out).toContain('Software de gestão de frota');
    expect(out).toContain('30 dias');
    expect(out).toContain('R$ 200k/ano');
    expect(out).toContain('Notas livres');
  });

  it('renders criteria as a markdown bullet list', () => {
    const out = renderTail('Critérios:\n{{criterios}}', params);
    expect(out).toMatch(/- Preço/);
    expect(out).toMatch(/- SLA/);
  });

  it('falls back to a default when criteria is empty', () => {
    const out = renderTail('{{criterios}}', { ...params, criteria: [] });
    expect(out).toMatch(/padrão de procurement/);
  });

  it('leaves unknown placeholders untouched (defensive)', () => {
    const out = renderTail('{{cliente}} {{desconhecido}}', params);
    expect(out).toBe('Embraer S.A. {{desconhecido}}');
  });

  it('substitutes the SAME placeholder in multiple positions', () => {
    const tail = '{{cliente}} A {{cliente}} B {{cliente}}';
    const out = renderTail(tail, params);
    expect(out).toBe('Embraer S.A. A Embraer S.A. B Embraer S.A.');
  });
});

describe('assembleOutput', () => {
  it('joins llm text + rendered tail with a blank line', () => {
    const out = assembleOutput('# Generated\n\nBody.', 'Tail: {{cliente}}', params);
    expect(out).toBe('# Generated\n\nBody.\n\nTail: Embraer S.A.');
  });

  it('returns llm text unchanged when tail is null', () => {
    const out = assembleOutput('# Just LLM', null, params);
    expect(out).toBe('# Just LLM');
  });
});
