import { describe, it, expect } from 'vitest';
import { ITEM_STATUS, SYSTEM_PROMPT } from '@/lib/assistants/comprador';
import { buildComparisonMatrix } from '@/lib/assistants/comprador-comparison';

// Feedback de cliente (30/10/2026, equipe da Karla): "muita das vezes a
// descrição do fornecedor é o nome técnico do produto e o nosso é a versão
// comercial e isso na equalização aparece como se fosse um erro (falta do
// item) ou uma informação 'não é compatível'".
//
// Os testes abaixo travam a correção: a correspondência é pelo QUE o item é,
// e redação diferente não pode virar "ausente".

describe('status de item do Equalizador', () => {
  it('tem um status para "mesmo item, outro nome"', () => {
    expect(ITEM_STATUS).toContain('equivalente');
  });

  it('tem um status intermediário para a dúvida, em vez de só ausente', () => {
    expect(ITEM_STATUS).toContain('verificar');
  });

  it('mantém os status de divergência real que já existiam', () => {
    for (const s of [
      'correto',
      'ausente',
      'quantidade_divergente',
      'especificacao_alterada',
      'marca_diferente',
      'condicao_diferente',
      'outro',
    ]) {
      expect(ITEM_STATUS).toContain(s);
    }
  });
});

describe('regra de correspondência no prompt', () => {
  it('manda casar pelo que o item é, não pelo texto da descrição', () => {
    expect(SYSTEM_PROMPT).toMatch(/pelo que o item É, nunca pelo texto da descrição/i);
  });

  it('diz explicitamente que nome técnico × nome comercial não é erro', () => {
    expect(SYSTEM_PROMPT).toContain('nome técnico');
    expect(SYSTEM_PROMPT).toContain('nome comercial');
  });

  it('proíbe usar "ausente" por diferença de redação', () => {
    expect(SYSTEM_PROMPT).toMatch(/duas coisas NUNCA são ausência: redação diferente/);
  });

  // Peça da mesma natureza com medida errada é divergência: o comprador precisa
  // ver o que foi oferecido no lugar, não uma coluna vazia.
  it('proíbe "ausente" quando existe linha da mesma natureza com medida divergente', () => {
    expect(SYSTEM_PROMPT).toMatch(/linha da mesma natureza com medida\/material\/marca divergente/);
  });

  it('manda escolher "verificar" na dúvida, com candidata na mão', () => {
    expect(SYSTEM_PROMPT).toMatch(/Entre "equivalente" e "ausente" com uma candidata na mão, escolha "verificar"/);
  });

  it('sem linha candidata, não existe "verificar" — só "ausente"', () => {
    expect(SYSTEM_PROMPT).toMatch(/se for "—", o status só pode ser "ausente"/);
  });

  // Item cobrado sem ter sido pedido é dinheiro na fatura: a varredura final
  // precisa continuar no prompt.
  it('manda varrer as linhas que sobraram para itens_nao_solicitados', () => {
    expect(SYSTEM_PROMPT).toMatch(/varra cada linha de cada proposta/);
    expect(SYSTEM_PROMPT).toContain('itens_nao_solicitados');
  });

  it('restringe "especificacao_alterada" a característica mensurável', () => {
    expect(SYSTEM_PROMPT).toMatch(/SOMENTE quando uma característica MENSURÁVEL diverge/);
    expect(SYSTEM_PROMPT).toMatch(/Jamais porque a redação é diferente/);
  });

  it('exige a descrição literal do fornecedor, para o comprador conferir', () => {
    expect(SYSTEM_PROMPT).toContain('descricao_fornecedor');
    expect(SYSTEM_PROMPT).toMatch(/palavras literais que o fornecedor usou/);
  });
});

describe('matriz item × fornecedor com os status novos', () => {
  it('leva a descrição do fornecedor até a célula da tabela', () => {
    const matriz = buildComparisonMatrix([
      {
        item: 'Cantoneira de proteção de carga',
        quantidade_solicitada: '400 un',
        especificacao_solicitada: 'papelão reforçado',
        fornecedores: [
          {
            fornecedor: 'A',
            status: 'equivalente',
            descricao_fornecedor: 'Perfil L kraft 60×60×3mm',
            detalhe: 'mesma peça, nome técnico',
          },
          {
            fornecedor: 'B',
            status: 'verificar',
            descricao_fornecedor: 'Cantoneira 60mm',
            detalhe: 'não informou o material',
          },
        ],
      },
    ]);

    expect(matriz.fornecedores).toEqual(['A', 'B']);
    const linha = matriz.rows[0]!;
    expect(linha.porFornecedor['A']?.status).toBe('equivalente');
    expect(linha.porFornecedor['A']?.descricao_fornecedor).toBe('Perfil L kraft 60×60×3mm');
    expect(linha.porFornecedor['B']?.status).toBe('verificar');
  });
});
