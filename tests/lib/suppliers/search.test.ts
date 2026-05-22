import { describe, expect, it } from 'vitest';
import { normalizeRow } from '@/lib/suppliers/search';

describe('suppliers search — normalizeRow', () => {
  it('coerces capital_social string to number', () => {
    const r = normalizeRow({
      cnpj: '12345678000190',
      razao_social: 'X',
      nome_fantasia: null,
      cnae_primario: '1111111',
      cnaes_secundarios: null,
      porte: 'ME',
      capital_social: '1500.50',
      faixa_funcionarios: null,
      uf: 'SP',
      municipio: 'São Paulo',
      telefone: null,
      email: null,
      ultima_atualizacao_rf: null,
    });
    expect(r.capital_social).toBe(1500.5);
  });

  it('strips trailing whitespace from UF', () => {
    const r = normalizeRow({
      cnpj: 'x',
      razao_social: 'x',
      nome_fantasia: null,
      cnae_primario: null,
      cnaes_secundarios: null,
      porte: null,
      capital_social: null,
      faixa_funcionarios: null,
      uf: 'SP ',
      municipio: null,
      telefone: null,
      email: null,
      ultima_atualizacao_rf: null,
    });
    expect(r.uf).toBe('SP');
  });

  it('treats string "None" porte as null', () => {
    const r = normalizeRow({
      cnpj: 'x',
      razao_social: 'x',
      nome_fantasia: null,
      cnae_primario: null,
      cnaes_secundarios: null,
      porte: 'None',
      capital_social: null,
      faixa_funcionarios: null,
      uf: null,
      municipio: null,
      telefone: null,
      email: null,
      ultima_atualizacao_rf: null,
    });
    expect(r.porte).toBeNull();
  });

  it('formats Date to ISO yyyy-mm-dd', () => {
    const r = normalizeRow({
      cnpj: 'x',
      razao_social: 'x',
      nome_fantasia: null,
      cnae_primario: null,
      cnaes_secundarios: null,
      porte: null,
      capital_social: null,
      faixa_funcionarios: null,
      uf: null,
      municipio: null,
      telefone: null,
      email: null,
      ultima_atualizacao_rf: new Date('2026-05-21T12:00:00Z'),
    });
    expect(r.ultima_atualizacao_rf).toBe('2026-05-21');
  });

  it('passes through cnaes_secundarios array unchanged', () => {
    const r = normalizeRow({
      cnpj: 'x',
      razao_social: 'x',
      nome_fantasia: null,
      cnae_primario: null,
      cnaes_secundarios: ['1111111', '2222222'],
      porte: null,
      capital_social: null,
      faixa_funcionarios: null,
      uf: null,
      municipio: null,
      telefone: null,
      email: null,
      ultima_atualizacao_rf: null,
    });
    expect(r.cnaes_secundarios).toEqual(['1111111', '2222222']);
  });
});
