import { describe, expect, it } from 'vitest';
import {
  SUPPLIER_STATUSES,
  SUPPLIER_STATUS_LABEL,
  SUPPLIER_STATUS_STYLE,
  cnpjBasicoOf,
  isSupplierStatus,
} from '@/lib/suppliers/base';

describe('suppliers/base', () => {
  it('every status has a label and a style', () => {
    for (const st of SUPPLIER_STATUSES) {
      expect(SUPPLIER_STATUS_LABEL[st]).toBeTruthy();
      expect(SUPPLIER_STATUS_STYLE[st]).toBeTruthy();
    }
  });

  it('isSupplierStatus guards', () => {
    expect(isSupplierStatus('ativo')).toBe(true);
    expect(isSupplierStatus('homologado')).toBe(true);
    expect(isSupplierStatus('inexistente')).toBe(false);
    expect(isSupplierStatus(null)).toBe(false);
    expect(isSupplierStatus(42)).toBe(false);
  });

  it('cnpjBasicoOf takes first 8 digits, tolerating mask', () => {
    expect(cnpjBasicoOf('12.345.678/0001-90')).toBe('12345678');
    expect(cnpjBasicoOf('12345678000190')).toBe('12345678');
    expect(cnpjBasicoOf('123')).toBeNull();
    expect(cnpjBasicoOf(null)).toBeNull();
    expect(cnpjBasicoOf(undefined)).toBeNull();
  });
});

describe('chaveFornecedor', () => {
  it('usa o CNPJ base quando existe', async () => {
    const { chaveFornecedor } = await import('@/lib/suppliers/base');
    expect(chaveFornecedor({ razaoSocial: 'X', cnpj: '12.345.678/0001-90' })).toBe('cnpj:12345678');
  });

  it('sem CNPJ, reconhece o mesmo fornecedor por nome + e-mail, ignorando acento e caixa', async () => {
    const { chaveFornecedor } = await import('@/lib/suppliers/base');
    const a = chaveFornecedor({ razaoSocial: 'Mestre Aço ', email: 'SP09@mestreaco.com' });
    const b = chaveFornecedor({ razaoSocial: 'MESTRE ACO', email: 'sp09@mestreaco.com' });
    expect(a).toBe(b);
  });

  it('o mesmo fornecedor com outro contato vira outro cadastro', async () => {
    const { chaveFornecedor } = await import('@/lib/suppliers/base');
    const a = chaveFornecedor({ razaoSocial: 'ArcelorMittal', email: 'thais@arcelormittal.com' });
    const b = chaveFornecedor({ razaoSocial: 'ArcelorMittal', email: 'daniel@arcelormittal.com' });
    expect(a).not.toBe(b);
  });

  it('sem nome não há chave', async () => {
    const { chaveFornecedor } = await import('@/lib/suppliers/base');
    expect(chaveFornecedor({ razaoSocial: '   ' })).toBeNull();
  });
});

describe('filtrarBase', () => {
  const base = [
    { razaoSocial: 'DF BLOCOS', nomeFantasia: null, categoria: 'BLOCO DE CONCRETO', cnae: null, cnaeName: null, municipio: 'Sorocaba', uf: 'SP', cnpj: null, notas: 'Contato: LUCIANA', email: 'comercial@dfblocos.com' },
    { razaoSocial: 'Cerâmica Paulista', nomeFantasia: null, categoria: 'BLOCO CERÂMICO', cnae: null, cnaeName: null, municipio: 'Itu', uf: 'SP', cnpj: null, notas: null, email: null },
    { razaoSocial: 'Gerdau', nomeFantasia: null, categoria: 'AÇO', cnae: null, cnaeName: null, municipio: 'São Paulo', uf: 'SP', cnpj: '33611500000119', notas: null, email: null },
  ];

  it('ignora plural e acento: "blocos" acha o grupo BLOCO, "ceramico" acha "Cerâmica"', async () => {
    const { filtrarBase } = await import('@/lib/suppliers/base');
    expect(filtrarBase(base, 'blocos').map((s) => s.razaoSocial)).toEqual(['DF BLOCOS', 'Cerâmica Paulista']);
    expect(filtrarBase(base, 'ceramico').map((s) => s.razaoSocial)).toEqual(['Cerâmica Paulista']);
  });

  it('várias palavras: todas precisam aparecer (nome/grupo pesam mais que cidade)', async () => {
    const { filtrarBase } = await import('@/lib/suppliers/base');
    expect(filtrarBase(base, 'bloco sorocaba').map((s) => s.razaoSocial)).toEqual(['DF BLOCOS']);
    expect(filtrarBase(base, 'luciana').map((s) => s.razaoSocial)).toEqual(['DF BLOCOS']);
    expect(filtrarBase(base, '33611500').map((s) => s.razaoSocial)).toEqual(['Gerdau']);
  });

  it('sem busca devolve tudo na ordem original', async () => {
    const { filtrarBase } = await import('@/lib/suppliers/base');
    expect(filtrarBase(base, '  ')).toHaveLength(3);
  });
});
