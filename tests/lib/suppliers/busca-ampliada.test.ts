import { describe, expect, it } from 'vitest';
import {
  buscarNaVendorList,
  categoriasDistintas,
  equipeDoUsuario,
  extrairFornecedoresWeb,
  semDuplicados,
  siteSeguro,
  termosDaConsulta,
  type FornecedorVendorList,
} from '@/lib/suppliers/busca-ampliada';

function f(p: Partial<FornecedorVendorList> & { razaoSocial: string }): FornecedorVendorList {
  return {
    nomeFantasia: null,
    cnpj: null,
    categoria: null,
    municipio: null,
    uf: null,
    telefone: null,
    email: null,
    notas: null,
    ...p,
  };
}

const LISTA = [
  f({ razaoSocial: 'GERDAU', categoria: 'AÇO', municipio: 'São Paulo', uf: 'SP' }),
  f({ razaoSocial: 'MESTRE AÇO', categoria: 'AÇO', municipio: 'Recife', uf: 'PE' }),
  f({ razaoSocial: 'A CASA MAX', categoria: 'CONCRETO', municipio: 'São Paulo', uf: 'SP' }),
  f({ razaoSocial: 'ANDMAX', categoria: 'CIMBRAMENTO, FÔRMA E ANDAIME', notas: 'Atende Natal' }),
  f({ razaoSocial: 'CARGO FLEX', categoria: 'NIVELADORA; SISTEMA SEGURANÇA' }),
  f({ razaoSocial: 'MP PORTAS CORTA FOGO', categoria: 'PORTA CORTA FOGO' }),
];

describe('equipeDoUsuario', () => {
  it('libera só os e-mails listados, sem diferença de caixa', () => {
    expect(equipeDoUsuario('Camila.Santos@costafeitosa.com.br')?.id).toBe('costa-feitosa');
    expect(equipeDoUsuario('kate.sa@costafeitosa.com.br')?.id).toBe('costa-feitosa');
    expect(equipeDoUsuario('cristiano.camargo@costafeitosa.com.br')?.id).toBe('costa-feitosa');
  });

  it('colega novo do mesmo domínio NÃO entra sozinho', () => {
    expect(equipeDoUsuario('outra.pessoa@costafeitosa.com.br')).toBeNull();
    expect(equipeDoUsuario(null)).toBeNull();
    expect(equipeDoUsuario('')).toBeNull();
  });
});

describe('termosDaConsulta', () => {
  it('fica com o item e tira palavras de pedido, UF e plural simples', () => {
    expect(termosDaConsulta('Quero fornecedores de luvas de segurança em Natal/RN')).toEqual([
      'luva',
      'seguranca',
      'natal',
    ]);
    expect(termosDaConsulta('locação de andaime')).toEqual(['andaime']);
  });
});

describe('buscarNaVendorList', () => {
  it('categoria escolhida pela IA traz o grupo inteiro, a 1ª pesando mais', () => {
    const r = buscarNaVendorList(LISTA, 'vergalhão CA-50', ['AÇO', 'CONCRETO']);
    expect(r.map((x) => x.razaoSocial)).toEqual(['GERDAU', 'MESTRE AÇO', 'A CASA MAX']);
    expect(r[0]!.motivo).toBe('categoria AÇO');
  });

  it('termo curto só casa como palavra inteira ("ca" de CA-50 não pega "CASA")', () => {
    const r = buscarNaVendorList(LISTA, 'vergalhão CA-50', []);
    expect(r).toEqual([]);
  });

  it('cidade citada no pedido sobe o fornecedor de lá', () => {
    const r = buscarNaVendorList(LISTA, 'vergalhão em Recife', ['AÇO']);
    expect(r[0]!.razaoSocial).toBe('MESTRE AÇO');
  });

  it('sem categoria da IA, exige o termo principal no nome ou na categoria', () => {
    // "segurança" sozinho não pode puxar o grupo de alarmes para "luva".
    expect(buscarNaVendorList(LISTA, 'luva de segurança', [])).toEqual([]);
    const r = buscarNaVendorList(LISTA, 'porta corta fogo', []);
    expect(r.map((x) => x.razaoSocial)).toEqual(['MP PORTAS CORTA FOGO']);
  });

  it('observação sozinha não basta', () => {
    expect(buscarNaVendorList(LISTA, 'caneta em natal', [])).toEqual([]);
  });
});

describe('categoriasDistintas / semDuplicados', () => {
  it('categorias sem repetir, ignorando acento e caixa', () => {
    const cats = categoriasDistintas([...LISTA, f({ razaoSocial: 'X', categoria: 'aco' })]);
    expect(cats.filter((c) => /^a[çc]o$/i.test(c))).toHaveLength(1);
  });

  it('a mesma linha subida por duas pessoas da equipe aparece uma vez', () => {
    const a = f({ razaoSocial: 'Gerdau', email: 'x@gerdau.com', categoria: 'AÇO' });
    const b = f({ razaoSocial: 'GERDAU ', email: 'x@gerdau.com', categoria: 'aço' });
    const c = f({ razaoSocial: 'GERDAU', email: 'y@gerdau.com', categoria: 'AÇO' });
    expect(semDuplicados([a, b, c])).toHaveLength(2);
  });
});

describe('internet', () => {
  it('extrai a lista mesmo cercada de texto e descarta lixo', () => {
    const texto = `Aqui está:\n\`\`\`json\n[
      {"nome":"Papelaria Confiança","site":"livrariaconfianca.com.br","telefone":"(84) 3222-0000","cidade":"Natal","uf":"rn","oQueVende":"Canetas"},
      {"nome":"","site":"https://x.com"},
      {"nome":"Kalunga","site":"N/A","telefone":null,"cidade":"Natal","uf":"Rio Grande do Norte"}
    ]\n\`\`\``;
    const r = extrairFornecedoresWeb(texto);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ nome: 'Papelaria Confiança', site: 'https://livrariaconfianca.com.br/', uf: 'RN' });
    expect(r[1]).toMatchObject({ nome: 'Kalunga', site: null, uf: null });
  });

  it('resposta sem JSON vira lista vazia', () => {
    expect(extrairFornecedoresWeb('Não encontrei nada.')).toEqual([]);
    expect(extrairFornecedoresWeb('[quebrado')).toEqual([]);
  });

  it('siteSeguro só aceita http(s)', () => {
    expect(siteSeguro('javascript:alert(1)')).toBeNull();
    expect(siteSeguro('loja')).toBeNull();
    expect(siteSeguro('http://loja.com.br/x')).toBe('http://loja.com.br/x');
  });
});

describe('juntarFornecedoresWeb', () => {
  it('junta local + ampla sem repetir empresa (mesmo site ou mesmo nome) e respeita o limite', async () => {
    const { juntarFornecedoresWeb } = await import('@/lib/suppliers/busca-ampliada');
    const w = (nome: string, site: string | null) => ({ nome, site, telefone: null, cidade: null, uf: null, oQueVende: null });
    const local = [w('Loja A', 'https://www.loja-a.com.br/'), w('Loja B', null)];
    const amplo = [w('Loja A Matriz', 'https://loja-a.com.br/produtos'), w('loja b', null), w('Distribuidora C', 'https://c.com.br/')];
    expect(juntarFornecedoresWeb([local, amplo]).map((f) => f.nome)).toEqual(['Loja A', 'Loja B', 'Distribuidora C']);
    expect(juntarFornecedoresWeb([local, amplo], 2)).toHaveLength(2);
  });
});
