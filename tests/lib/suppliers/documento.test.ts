import { describe, expect, it } from 'vitest';
import { chaveFornecedor, cnpjBasicoOf, mesclarDuplicados, normalizarDocumento } from '@/lib/suppliers/base';

// Planilha real (Costa Feitosa, 2026-10-15): coluna de CNPJ com CPF e códigos internos com zeros.
describe('cnpjBasicoOf', () => {
  it('só devolve a raiz de CNPJ válido', () => {
    expect(cnpjBasicoOf('60.746.948/0001-12')).toBe('60746948');
    expect(cnpjBasicoOf('00000000002453')).toBeNull(); // código interno, não CNPJ
    expect(cnpjBasicoOf('04434492365')).toBeNull(); // CPF
    expect(cnpjBasicoOf('60746948000199')).toBeNull(); // dígito verificador errado
    expect(cnpjBasicoOf('00000000')).toBeNull();
  });
});

describe('normalizarDocumento', () => {
  it('aceita CNPJ válido e completa o zero que o Excel tira', () => {
    expect(normalizarDocumento('60746948000112')).toEqual({ cnpj: '60746948000112', documento: null });
    expect(normalizarDocumento('360305000104')).toEqual({ cnpj: '00360305000104', documento: null });
  });
  it('CPF e código interno vão para as observações, sem virar CNPJ', () => {
    expect(normalizarDocumento('04434492365')).toEqual({ cnpj: null, documento: 'CPF 04434492365' });
    expect(normalizarDocumento('00000000002453')).toEqual({ cnpj: null, documento: 'Documento na planilha: 00000000002453' });
    expect(normalizarDocumento('')).toEqual({ cnpj: null, documento: null });
  });
});

describe('mesclarDuplicados', () => {
  it('junta a mesma empresa (mesma raiz de CNPJ) e completa os campos', () => {
    const r = mesclarDuplicados([
      { razaoSocial: 'Caixa', cnpj: '00360305000104', telefone: null, notas: 'Matriz' },
      { razaoSocial: 'Caixa Filial', cnpj: '00360305000104', telefone: '1133334444', notas: 'Filial' },
      { razaoSocial: 'Outra', cnpj: '60746948000112' },
    ]);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ razaoSocial: 'Caixa', telefone: '1133334444', notas: 'Matriz · Filial' });
  });
  it('nenhuma raiz de CNPJ repetida depois de juntar', () => {
    const r = mesclarDuplicados([
      { razaoSocial: 'A', cnpj: '60746948000112' },
      { razaoSocial: 'A', cnpj: '60746948000112' },
      { razaoSocial: 'B', cnpj: null, municipio: 'Natal' },
      { razaoSocial: 'B', cnpj: null, municipio: 'Natal' },
    ]);
    const chaves = r.map(chaveFornecedor);
    expect(new Set(chaves).size).toBe(chaves.length);
  });
});
