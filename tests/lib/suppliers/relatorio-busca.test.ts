import { describe, expect, it } from 'vitest';
import { formatarCnpj, montarRelatorioBusca, nomeArquivoRelatorio } from '@/lib/suppliers/relatorio-busca';

const unidade = (cnpj: string, extra: Record<string, unknown> = {}) => ({
  cnpj, razao_social: 'ALFA LTDA', nome_fantasia: 'Alfa', cnae_primario: '4647801', cnaes_secundarios: null, porte: 'ME',
  capital_social: 1000, faixa_funcionarios: null, uf: 'RN', municipio: 'NATAL', telefone: '(84) 3222-0000', email: 'CONTATO@ALFA.COM', ultima_atualizacao_rf: null, ...extra,
});

describe('relatório da busca de fornecedores', () => {
  it('monta resumo e a seção da Receita com a matriz de cada empresa', () => {
    const rel = montarRelatorioBusca({
      pedido: 'caneta em natal', cnae: '4647801', cnaeName: 'Comércio atacadista de papelaria', regiao: 'Natal/RN',
      receita: [{ cnpjBasico: '12345678', aberturaAno: 2010, units: [unidade('12345678000290', { municipio: 'MOSSORO' }), unidade('12345678000190')] }],
      geradoEm: new Date('2026-10-08T12:00:00Z'),
    });
    expect(rel.resumo).toContainEqual(['Pedido', 'caneta em natal']);
    expect(rel.resumo).toContainEqual(['Empresas na Receita', '1']);
    expect(rel.secoes).toHaveLength(1); // sem busca ampliada: só a Receita
    expect(rel.secoes[0]!.linhas[0]).toEqual([
      'ALFA LTDA (Alfa)', '12.345.678/0001-90', 'NATAL/RN', 'Microempresa', '(84) 3222-0000', 'contato@alfa.com', '2010', '2',
    ]);
  });

  it('com busca ampliada inclui vendor list e internet, sem travessão', () => {
    const rel = montarRelatorioBusca({
      pedido: 'x', cnae: '1', cnaeName: null, regiao: '', receita: [],
      vendorList: [{ razaoSocial: 'Gerdau', nomeFantasia: null, cnpj: null, categoria: 'AÇO', municipio: 'São Paulo', uf: 'SP', telefone: null, email: null, notas: null, motivo: 'categoria AÇO — nome', pontos: 10 }],
      web: [{ nome: 'Loja', site: 'https://loja.com.br/', telefone: null, cidade: null, uf: null, oQueVende: 'vende — tudo' }],
    });
    expect(rel.secoes.map((s) => s.titulo)).toEqual(['Empresas na base da Receita Federal', 'Na sua vendor list', expect.stringMatching(/^Na internet/)]);
    expect(JSON.stringify(rel)).not.toMatch(/[—–]/);
    expect(rel.resumo).toContainEqual(['Região', 'Brasil']);
  });

  it('nome de arquivo e CNPJ legíveis', () => {
    expect(nomeArquivoRelatorio('Caneta 5B em Natal/RN', new Date('2026-10-08T12:00:00Z'))).toBe('relatorio-fornecedores-caneta-5b-em-natal-rn-2026-10-08');
    expect(formatarCnpj('33611500000119')).toBe('33.611.500/0001-19');
  });
});
