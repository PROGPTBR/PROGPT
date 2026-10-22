import { describe, expect, it } from 'vitest';
import { padraoDeRelevancia, termosDaBusca, termosDeRelevancia } from '@/lib/suppliers/relevancia';

// 21/10/2026 (Alexandre): "artigo de papelaria" trazia a Suzano no topo. A
// busca passa a dar preferência a quem tem no nome o que foi pedido.
describe('termos de relevância da busca de fornecedores', () => {
  it('fica só com o que identifica o item, em radical sem acento', () => {
    expect(termosDeRelevancia('artigo de papelaria')).toEqual(['PAPELA']);
    expect(termosDeRelevancia('fornecedor material de escritório')).toEqual(['ESCRIT']);
  });

  it('não transforma lugar em termo (estado e cidades do pedido)', () => {
    expect(termosDeRelevancia('material de escritório amazonas')).toEqual(['ESCRIT']);
    expect(termosDeRelevancia('vergalhão em São José dos Campos', ['São José dos Campos'])).toEqual(['VERGAL']);
  });

  it('pedido só com palavras genéricas não gera termo', () => {
    expect(termosDeRelevancia('quero fornecedores de materiais')).toEqual([]);
  });

  it('junta o nome do ramo depois do pedido, sem repetir', () => {
    expect(termosDaBusca('material de escritório', 'Comércio atacadista de artigos de escritório e de papelaria')).toEqual([
      'ESCRIT',
      'PAPELA',
    ]);
  });

  it('o padrão do banco só aceita radicais limpos', () => {
    expect(padraoDeRelevancia(['PAPELA', 'ESCRIT'])).toBe('(PAPELA|ESCRIT)');
    expect(padraoDeRelevancia(['PAP|.*', "'; drop", 'ab'])).toBeNull();
    expect(padraoDeRelevancia(undefined)).toBeNull();
  });
});
