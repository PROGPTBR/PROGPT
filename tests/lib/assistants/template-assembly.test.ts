import { describe, expect, it } from 'vitest';
import {
  splitTemplateBody,
  renderTail,
  renderPlaceholders,
  assembleOutput,
  splitAssembledOutput,
  ASSEMBLY_BOUNDARY,
} from '@/lib/assistants/template-assembly';
import type { RfpParams } from '@/lib/assistants/types';
import type { CompanyData } from '@/lib/db/user-company';

const company: CompanyData = {
  company_name: 'ACME S.A.',
  company_legal_name: 'ACME Indústria Ltda.',
  company_cnpj: '12.345.678/0001-90',
  company_email: 'compras@acme.com.br',
  company_phone: '(11) 99999-9999',
  company_address: 'Av. Exemplo, 100 — São Paulo/SP',
  company_description: 'Empresa de teste para suíte de unit tests.',
};

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
  it('joins llm text + rendered tail with a boundary marker between them', () => {
    const out = assembleOutput('# Generated\n\nBody.', 'Tail: {{cliente}}', params);
    expect(out).toContain('<!-- @assembled-tail-below -->');
    expect(out.indexOf('Body.')).toBeLessThan(out.indexOf('<!-- @assembled-tail-below -->'));
    expect(out.indexOf('<!-- @assembled-tail-below -->')).toBeLessThan(out.indexOf('Embraer S.A.'));
  });

  it('returns llm text unchanged (no marker) when tail is null', () => {
    const out = assembleOutput('# Just LLM', null, params);
    expect(out).toBe('# Just LLM');
    expect(out).not.toContain('@assembled-tail-below');
  });
});

describe('renderPlaceholders — company fields', () => {
  it('substitutes every supported {{empresa_*}} placeholder when company is provided', () => {
    const text =
      'Nome: {{empresa_nome}} | Razão: {{empresa_razao_social}} | CNPJ: {{empresa_cnpj}} | E-mail: {{empresa_email}} | Telefone: {{empresa_telefone}} | Endereço: {{empresa_endereco}} | Descrição: {{empresa_descricao}}';
    const out = renderPlaceholders(text, params, company);
    expect(out).toContain('ACME S.A.');
    expect(out).toContain('ACME Indústria Ltda.');
    expect(out).toContain('12.345.678/0001-90');
    expect(out).toContain('compras@acme.com.br');
    expect(out).toContain('(11) 99999-9999');
    expect(out).toContain('Av. Exemplo, 100');
    expect(out).toContain('Empresa de teste');
  });

  it('falls back to the form client value when company_name is unset', () => {
    const out = renderPlaceholders('{{empresa_nome}}', params, {
      ...company,
      company_name: null,
    });
    expect(out).toBe(params.client);
  });

  it('renders empty strings (not raw placeholders) when a company field is unset', () => {
    const out = renderPlaceholders('CNPJ: {{empresa_cnpj}}.', params, {
      ...company,
      company_cnpj: null,
    });
    expect(out).toBe('CNPJ: .');
  });

  it('uses empresa_phone and empresa_telefone as aliases for the same value', () => {
    const out = renderPlaceholders('A:{{empresa_phone}} B:{{empresa_telefone}}', params, company);
    expect(out).toBe('A:(11) 99999-9999 B:(11) 99999-9999');
  });

  it('renderTail back-compat still works (no company arg)', () => {
    // Tail uses only form-derived placeholders — should render fine.
    const out = renderTail('Cliente: {{cliente}}', params);
    expect(out).toBe('Cliente: Embraer S.A.');
  });
});

describe('splitAssembledOutput', () => {
  it('splits an assembled output back into head + tail at the boundary', () => {
    const assembled = `# Head section\n\nSome content.\n\n${ASSEMBLY_BOUNDARY}\n\n## Tail section\n\nLegal text.`;
    const { head, tail } = splitAssembledOutput(assembled);
    expect(head).toBe('# Head section\n\nSome content.');
    expect(tail).toBe('## Tail section\n\nLegal text.');
  });

  it('treats the whole document as head when no boundary is present (back-compat)', () => {
    const md = '# Just head\n\nNo marker here.';
    const { head, tail } = splitAssembledOutput(md);
    expect(head).toBe(md);
    expect(tail).toBeNull();
  });

  it('round-trips: assemble then split recovers head + rendered tail', () => {
    const assembled = assembleOutput('# Customizable head\n\nBody.', 'Cliente: {{cliente}}', params);
    const { head, tail } = splitAssembledOutput(assembled);
    expect(head).toBe('# Customizable head\n\nBody.');
    expect(tail).toBe('Cliente: Embraer S.A.');
  });
});
