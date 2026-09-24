import { describe, expect, it } from 'vitest';

import {
  RAIOS_KM,
  acharMunicipio,
  cidadesNoRaio,
  distanciaEntreMunicipios,
  distanciaKm,
  normalizarNomeCidade,
} from '@/lib/suppliers/proximity';

// Busca por proximidade — nasceu do feedback de 24/09/2026: "nossas obras
// rodam em vários pontos do estado, e dependendo do volume não compensa
// comprar de alguém de outra cidade distante".
//
// Os números aqui são conferidos contra a geografia real: Jundiaí fica a
// ~17 km de Itupeva; Petrolina/PE e Juazeiro/BA são cidades coladas.

describe('normalizarNomeCidade', () => {
  it('ignora acento, caixa e espaço extra (a base da Receita grava sem acento)', () => {
    expect(normalizarNomeCidade(' São Paulo ')).toBe('SAO PAULO');
    expect(normalizarNomeCidade('jundiaí')).toBe('JUNDIAI');
    expect(normalizarNomeCidade('Mogi  das   Cruzes')).toBe('MOGI DAS CRUZES');
  });
});

describe('acharMunicipio', () => {
  it('encontra por nome com ou sem acento', () => {
    expect(acharMunicipio('SP', 'Jundiaí')?.id).toBe(3525904);
    expect(acharMunicipio('sp', 'JUNDIAI')?.id).toBe(3525904);
  });

  it('não confunde cidades homônimas de estados diferentes', () => {
    const sp = acharMunicipio('SP', 'Bom Jesus dos Perdões');
    const rs = acharMunicipio('RS', 'Bom Jesus');
    expect(sp?.uf).toBe('SP');
    expect(rs?.uf).toBe('RS');
  });

  it('devolve null para cidade inexistente', () => {
    expect(acharMunicipio('SP', 'Cidade Que Não Existe')).toBeNull();
  });
});

describe('distância', () => {
  it('mede a distância real entre duas cidades', () => {
    const itupeva = acharMunicipio('SP', 'Itupeva')!;
    const jundiai = acharMunicipio('SP', 'Jundiaí')!;
    // ~17 km na estrada; toleramos a folga do centroide.
    expect(distanciaKm(itupeva, jundiai)).toBeGreaterThan(10);
    expect(distanciaKm(itupeva, jundiai)).toBeLessThan(25);
  });

  it('dá zero entre municípios que se tocam, mesmo sendo enormes', () => {
    // Petrolina/PE e Juazeiro/BA são vizinhas coladas, mas os CENTROS
    // ficam a 68 km — medir centro a centro as excluiria de um raio de
    // 30 km. Medindo borda a borda, dá 0.
    const petrolina = acharMunicipio('PE', 'Petrolina')!;
    const juazeiro = acharMunicipio('BA', 'Juazeiro')!;
    expect(distanciaEntreMunicipios(petrolina, juazeiro)).toBe(0);
    expect(distanciaKm(petrolina, juazeiro)).toBeGreaterThan(50);
  });
});

describe('cidadesNoRaio', () => {
  it('raio 0 devolve só a cidade da obra', () => {
    const r = cidadesNoRaio({ uf: 'SP', cidade: 'Itupeva', raioKm: 0 });
    expect(r).toHaveLength(1);
    expect(r[0]!.nome).toBe('Itupeva');
    expect(r[0]!.distanciaKm).toBe(0);
  });

  it('traz as vizinhas reais de Itupeva num raio de 30 km', () => {
    const nomes = cidadesNoRaio({ uf: 'SP', cidade: 'Itupeva', raioKm: 30 })
      .map((c) => c.nome);

    expect(nomes).toContain('Itupeva');
    expect(nomes).toContain('Jundiaí');
    expect(nomes).toContain('Indaiatuba');
    expect(nomes).toContain('Louveira');
    // Ribeirão Preto fica a ~250 km — não pode entrar.
    expect(nomes).not.toContain('Ribeirão Preto');
  });

  it('ordena da mais perto para a mais longe', () => {
    const d = cidadesNoRaio({ uf: 'SP', cidade: 'Itupeva', raioKm: 50 })
      .map((c) => c.distanciaKm);
    expect(d[0]).toBe(0);
    expect([...d].sort((a, b) => a - b)).toEqual(d);
  });

  it('cruza a divisa de estado — frete não respeita limite administrativo', () => {
    const ufs = new Set(
      cidadesNoRaio({ uf: 'PE', cidade: 'Petrolina', raioKm: 30 }).map((c) => c.uf),
    );
    expect(ufs.has('BA')).toBe(true);
  });

  it('respeita o teto de cidades (a query usa `= any(array)`)', () => {
    const r = cidadesNoRaio({ uf: 'SP', cidade: 'São Paulo', raioKm: 200, limite: 10 });
    expect(r).toHaveLength(10);
  });

  it('devolve vazio para cidade desconhecida, sem lançar', () => {
    expect(cidadesNoRaio({ uf: 'SP', cidade: 'Xanadu', raioKm: 50 })).toEqual([]);
  });

  it('quanto maior o raio, mais cidades (nunca menos)', () => {
    const contas = RAIOS_KM.map(
      (raio) => cidadesNoRaio({ uf: 'SP', cidade: 'Itupeva', raioKm: raio }).length,
    );
    for (let i = 1; i < contas.length; i++) {
      expect(contas[i]!).toBeGreaterThanOrEqual(contas[i - 1]!);
    }
  });
});
