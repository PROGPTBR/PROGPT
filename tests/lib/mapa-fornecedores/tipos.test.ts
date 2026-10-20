import { describe, expect, it } from 'vitest';
import {
  csvFornecedores,
  distribuirFornecedores,
  pareceMapaDaOperacao,
  porCategoriaAlvo,
  totalSeguro,
  type FornecedorMapa,
  type Plano,
} from '@/lib/mapa-fornecedores/tipos';
import { lerFornecedores } from '@/lib/mapa-fornecedores/servidor';

function f(nome: string, categoria: string, site: string | null = null): FornecedorMapa {
  return {
    id: nome, nome, categoria, site, telefone: null, endereco: null, bairro: null, cep: null,
    cidade: 'Curitiba', uf: 'PR', oQueVende: null, lat: null, lng: null, precisao: null,
  };
}

describe('distribuirFornecedores', () => {
  it('alterna entre as categorias para nenhuma ficar de fora', () => {
    const r = distribuirFornecedores(
      [
        { categoria: 'A', fornecedores: [f('a1', 'A'), f('a2', 'A'), f('a3', 'A')] },
        { categoria: 'B', fornecedores: [f('b1', 'B')] },
        { categoria: 'C', fornecedores: [f('c1', 'C'), f('c2', 'C')] },
      ],
      4,
    );
    expect(r.map((x) => x.nome)).toEqual(['a1', 'b1', 'c1', 'a2']);
  });

  it('não repete a mesma empresa (mesmo site ou mesmo nome, ignorando LTDA e acento)', () => {
    const r = distribuirFornecedores(
      [
        { categoria: 'A', fornecedores: [f('Elétrica Paraná LTDA', 'A', 'https://www.eletricapr.com.br/')] },
        {
          categoria: 'B',
          fornecedores: [f('Eletrica Parana', 'B'), f('Outra', 'B', 'https://eletricapr.com.br/contato'), f('Nova', 'B')],
        },
      ],
      50,
    );
    expect(r.map((x) => x.nome)).toEqual(['Elétrica Paraná LTDA', 'Nova']);
  });
});

describe('limites', () => {
  it('total entre 10 e 60, padrão 50', () => {
    expect(totalSeguro(0)).toBe(50);
    expect(totalSeguro(NaN)).toBe(50);
    expect(totalSeguro(500)).toBe(60);
    expect(totalSeguro(3)).toBe(10);
    expect(totalSeguro(30)).toBe(30);
  });

  it('pede por categoria com folga, entre 4 e 10', () => {
    expect(porCategoriaAlvo(50, 10)).toBe(7);
    expect(porCategoriaAlvo(50, 2)).toBe(10);
    expect(porCategoriaAlvo(10, 12)).toBe(4);
  });
});

describe('lerFornecedores', () => {
  it('lê o JSON mesmo cercado de texto e limpa campos', () => {
    const r = lerFornecedores(
      'Achei estes:\n```json\n[{"nome":"Broadcast Sul","site":"broadcastsul.com.br","telefone":"(41) 3333-0000","endereco":"Rua X, 10","cep":"80010000","cidade":"Curitiba","uf":"pr","oQueVende":"transmissores"},{"nome":"","site":null},{"nome":"Sem site","site":"N/A","cep":"123"}]\n```',
      'Broadcast',
    );
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({
      nome: 'Broadcast Sul',
      categoria: 'Broadcast',
      site: 'https://broadcastsul.com.br/',
      cep: '80010-000',
      uf: 'PR',
    });
    expect(r[1]).toMatchObject({ site: null, cep: null });
  });

  it('texto sem JSON vira lista vazia', () => {
    expect(lerFornecedores('não encontrei nada', 'X')).toEqual([]);
  });
});

describe('csvFornecedores', () => {
  it('gera planilha com BOM, ";" e aspas escapadas', () => {
    const plano = { categorias: [{ nome: 'A', tipo: 'OPEX' }] } as unknown as Plano;
    const csv = csvFornecedores({ plano, fornecedores: [{ ...f('Loja "Boa"', 'A'), telefone: '41 9999' }] });
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('"Loja ""Boa""";"A";"OPEX"');
  });
});

describe('pareceMapaDaOperacao', () => {
  it('reconhece pedido da operação inteira', () => {
    expect(pareceMapaDaOperacao('Quero os 50 fornecedores da região de Curitiba para esta empresa')).toBe(true);
    expect(pareceMapaDaOperacao('fornecedores de capex e opex do grupo')).toBe(true);
  });
  it('item específico fica na busca', () => {
    expect(pareceMapaDaOperacao('preciso de fornecedores de luva nitrílica em Natal')).toBe(false);
  });
});

describe('lerFornecedores descarta valores de exemplo', () => {
  it('"Rua X, 123", "logradouro…" e CEP genérico de cidade viram null', () => {
    const r = lerFornecedores(
      '[{"nome":"A","endereco":"Rua X, 123","cep":"80000-000"},{"nome":"B","endereco":"logradouro e número","cep":"00000-000"},{"nome":"C","endereco":"Rua XV de Novembro, 100","cep":"80020-310"}]',
      'Cat',
    );
    expect(r.map((x) => [x.endereco, x.cep])).toEqual([
      [null, null],
      [null, null],
      ['Rua XV de Novembro, 100', '80020-310'],
    ]);
  });
});
