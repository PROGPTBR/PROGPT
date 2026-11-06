import { describe, expect, it } from 'vitest';

import { finalidadeDaNota, lerNfeXml, pareceNfe } from '@/lib/recebimento/nfe-xml';
import {
  casarItens,
  conferirNota,
  podeAtestar,
  saldoDoPedido,
  statusDoPedido,
  unidadeCanonica,
  validarEntrada,
  type NotaAnterior,
} from '@/lib/recebimento/conferencia';
import type { NotaLida, PedidoItem } from '@/lib/recebimento/types';

function xmlNfe(dets: string, opts: { natOp?: string; cnpj?: string; nNF?: string } = {}) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><NFe><infNFe Id="NFe35261112345678000199550010000012341000012345" versao="4.00">
<ide><cUF>35</cUF><natOp>${opts.natOp ?? 'VENDA DE MERCADORIA'}</natOp><mod>55</mod><serie>1</serie><nNF>${opts.nNF ?? '1234'}</nNF><dhEmi>2026-11-05T10:00:00-03:00</dhEmi></ide>
<emit><CNPJ>${opts.cnpj ?? '12345678000199'}</CNPJ><xNome>Casa do Construtor Ltda</xNome></emit>
${dets}
<total><ICMSTot><vProd>3590.00</vProd><vNF>3769.50</vNF></ICMSTot></total>
</infNFe></NFe></nfeProc>`;
}

function det(n: number, p: { cProd: string; xProd: string; ncm: string; cfop: string; u: string; q: string; v: string; vp: string; icms?: string; ipi?: string }) {
  return `<det nItem="${n}"><prod><cProd>${p.cProd}</cProd><cEAN/><xProd>${p.xProd}</xProd><NCM>${p.ncm}</NCM><CFOP>${p.cfop}</CFOP><uCom>${p.u}</uCom><qCom>${p.q}</qCom><vUnCom>${p.v}</vUnCom><vProd>${p.vp}</vProd></prod>
<imposto><ICMS><ICMS00><orig>0</orig><CST>00</CST><pICMS>${p.icms ?? '18.00'}</pICMS></ICMS00></ICMS><IPI><cEnq>999</cEnq><IPITrib><CST>50</CST><pIPI>${p.ipi ?? '5.00'}</pIPI></IPITrib></IPI></imposto></det>`;
}

const PEDIDO: PedidoItem[] = [
  { codigo: 'MAT-01', descricao: 'Cimento CP II 50kg', ncm: '2523.29.10', unidade: 'SC', quantidade: 100, valor_unitario: 32, icms_pct: 18, ipi_pct: 5 },
  { codigo: 'MAT-02', descricao: 'Vergalhão CA-50 10mm barra 12m', ncm: '72142000', unidade: 'BR', quantidade: 20, valor_unitario: 19.5, icms_pct: 18, ipi_pct: 5 },
];

const xmlOk = xmlNfe(
  det(1, { cProd: 'F100', xProd: 'CIMENTO CP II 50KG', ncm: '25232910', cfop: '5102', u: 'SC', q: '100.0000', v: '32.00', vp: '3200.00' }) +
    det(2, { cProd: 'F200', xProd: 'VERGALHAO CA-50 10MM BARRA 12M', ncm: '72142000', cfop: '5102', u: 'BR', q: '20.0000', v: '19.50', vp: '390.00' }),
);

describe('leitura do XML da NF-e', () => {
  it('lê cabeçalho, itens, NCM e alíquotas', () => {
    expect(pareceNfe(xmlOk)).toBe(true);
    const n = lerNfeXml(xmlOk);
    expect(n.numero).toBe('1234');
    expect(n.serie).toBe('1');
    expect(n.chave).toBe('35261112345678000199550010000012341000012345');
    expect(n.emitente_cnpj).toBe('12345678000199');
    expect(n.data_emissao).toBe('2026-11-05');
    expect(n.valor_total).toBe(3769.5);
    expect(n.itens).toHaveLength(2);
    expect(n.itens[0]).toMatchObject({ ncm: '25232910', cfop: '5102', quantidade: 100, valor_unitario: 32, icms_pct: 18, ipi_pct: 5 });
  });

  it('aceita XML com prefixo de namespace e recusa o que não é NF-e', () => {
    const comPrefixo = xmlOk.replace(/<(\/?)(\w+)/g, (m, b, t) => (t === 'xml' ? m : `<${b}nfe:${t}`));
    expect(lerNfeXml(comPrefixo).itens).toHaveLength(2);
    expect(pareceNfe('<html><body>oi</body></html>')).toBe(false);
    expect(() => lerNfeXml('<a/>')).toThrow();
  });

  it('separa a nota de entrega da financeira pelo CFOP (venda para entrega futura)', () => {
    const fat = lerNfeXml(xmlNfe(det(1, { cProd: 'F', xProd: 'Cimento', ncm: '25232910', cfop: '5922', u: 'SC', q: '1', v: '1', vp: '1' })));
    const rem = lerNfeXml(xmlNfe(det(1, { cProd: 'F', xProd: 'Cimento', ncm: '25232910', cfop: '6117', u: 'SC', q: '1', v: '1', vp: '1' })));
    expect(finalidadeDaNota(fat)).toBe('financeira');
    expect(finalidadeDaNota(rem)).toBe('entrega');
    expect(finalidadeDaNota(lerNfeXml(xmlOk))).toBe('unica');
    expect(finalidadeDaNota({ itens: [], natureza: 'Simples faturamento de venda para entrega futura' })).toBe('financeira');
  });
});

describe('conferência da nota contra o pedido', () => {
  const pedido = { itens: PEDIDO, fornecedor_cnpj: '12.345.678/0001-99' };

  it('nota igual ao pedido passa sem apontamento grave', () => {
    const c = conferirNota({ pedido, nota: lerNfeXml(xmlOk), finalidade: 'unica' });
    expect(c.casamento).toEqual([0, 1]);
    expect(c.ok).toBe(true);
    expect(c.apontamentos.filter((a) => a.severidade !== 'info')).toEqual([]);
  });

  it('acusa NCM diferente, preço acima, imposto diferente e item fora do pedido', () => {
    const nota = lerNfeXml(
      xmlNfe(
        det(1, { cProd: 'F100', xProd: 'CIMENTO CP II 50KG', ncm: '25239000', cfop: '5102', u: 'SC', q: '100', v: '33.50', vp: '3350', icms: '12.00' }) +
          det(2, { cProd: 'F900', xProd: 'Cal hidratada 20kg', ncm: '25222000', cfop: '5102', u: 'SC', q: '5', v: '15', vp: '75' }),
      ),
    );
    const c = conferirNota({ pedido, nota, finalidade: 'unica' });
    const tipos = c.apontamentos.map((a) => a.tipo);
    expect(c.ok).toBe(false);
    expect(tipos).toContain('ncm_divergente');
    expect(tipos).toContain('preco_acima');
    expect(tipos).toContain('imposto_divergente');
    expect(tipos).toContain('item_fora_do_pedido');
    // O vergalhão não veio: entrega parcial, fica pendente.
    expect(c.apontamentos.find((a) => a.tipo === 'entrega_parcial')?.item).toBe(1);
  });

  it('nota de entrega não confere preço; nota financeira não confere entrega parcial', () => {
    const nota = lerNfeXml(xmlNfe(det(1, { cProd: 'F100', xProd: 'Cimento CP II 50kg', ncm: '25232910', cfop: '5117', u: 'SC', q: '60', v: '99', vp: '5940' })));
    const ent = conferirNota({ pedido, nota, finalidade: 'entrega' });
    expect(ent.apontamentos.some((a) => a.tipo === 'preco_acima')).toBe(false);
    expect(ent.apontamentos.some((a) => a.tipo === 'entrega_parcial')).toBe(true);

    const fin = conferirNota({ pedido, nota, finalidade: 'financeira' });
    expect(fin.apontamentos.some((a) => a.tipo === 'preco_acima')).toBe(true);
    expect(fin.apontamentos.some((a) => a.tipo === 'entrega_parcial')).toBe(false);
  });

  it('soma as notas anteriores: segunda entrega acima do saldo é apontada', () => {
    const primeira = lerNfeXml(xmlNfe(det(1, { cProd: 'F100', xProd: 'Cimento CP II 50kg', ncm: '25232910', cfop: '5117', u: 'SC', q: '70', v: '32', vp: '2240' }), { nNF: '1' }));
    const anterior: NotaAnterior = { ...primeira, finalidade: 'entrega', casamento: [0] };
    const segunda = lerNfeXml(xmlNfe(det(1, { cProd: 'F100', xProd: 'Cimento CP II 50kg', ncm: '25232910', cfop: '5117', u: 'SC', q: '40', v: '32', vp: '1280' }), { nNF: '2' }));
    const c = conferirNota({ pedido, nota: segunda, finalidade: 'entrega', anteriores: [anterior] });
    expect(c.apontamentos.find((a) => a.tipo === 'quantidade_acima')?.item).toBe(0);
  });

  it('acusa nota repetida e emitente diferente do fornecedor', () => {
    const nota = lerNfeXml(xmlOk.replace('<CNPJ>12345678000199</CNPJ>', '<CNPJ>99888777000166</CNPJ>'));
    const anterior: NotaAnterior = { ...nota, finalidade: 'unica', casamento: [0, 1] };
    const c = conferirNota({ pedido, nota, finalidade: 'unica', anteriores: [anterior] });
    const tipos = c.apontamentos.map((a) => a.tipo);
    expect(tipos).toContain('nota_repetida');
    expect(tipos).toContain('emitente_diferente');
  });

  it('avisa quando o pedido não informa a alíquota', () => {
    const semImposto = PEDIDO.map((p) => ({ ...p, icms_pct: null }));
    const c = conferirNota({ pedido: { itens: semImposto, fornecedor_cnpj: '' }, nota: lerNfeXml(xmlOk), finalidade: 'financeira' });
    expect(c.apontamentos.some((a) => a.tipo === 'imposto_nao_informado')).toBe(true);
    expect(c.ok).toBe(true);
  });

  it('apontamentos de preço e imposto são marcados como financeiros (não vão para o almoxarifado)', () => {
    const nota: NotaLida = { ...lerNfeXml(xmlOk) };
    nota.itens = nota.itens.map((i) => ({ ...i, valor_unitario: (i.valor_unitario ?? 0) * 2 }));
    const c = conferirNota({ pedido, nota, finalidade: 'unica' });
    expect(c.apontamentos.filter((a) => a.tipo === 'preco_acima').every((a) => a.financeiro)).toBe(true);
  });
});

describe('casamento e unidades', () => {
  it('casa pela descrição mesmo com código do fornecedor diferente', () => {
    expect(casarItens(PEDIDO, [{ codigo: 'X', descricao: 'Vergalhao CA50 10 mm 12m', ncm: '72142000', cfop: '', unidade: 'BR', quantidade: 1, valor_unitario: 1, valor_total: 1, icms_pct: null, ipi_pct: null }])).toEqual([1]);
    expect(casarItens(PEDIDO, [{ codigo: 'X', descricao: 'Tinta acrílica 18L', ncm: '32091010', cfop: '', unidade: 'GL', quantidade: 1, valor_unitario: 1, valor_total: 1, icms_pct: null, ipi_pct: null }])).toEqual([null]);
  });

  it('casa descrição com número colado na unidade ("10MM" = "10 mm") e aponta o NCM errado', () => {
    const item = { codigo: 'F1', descricao: 'VERGALHAO CA-50 10MM BARRA 12M', ncm: '72141000', cfop: '5117', unidade: 'BR', quantidade: 20, valor_unitario: 19.5, valor_total: 390, icms_pct: null, ipi_pct: null };
    expect(casarItens(PEDIDO, [item])).toEqual([1]);
    const c = conferirNota({ pedido: { itens: PEDIDO, fornecedor_cnpj: '' }, nota: { numero: '1', serie: '1', chave: '', emitente_nome: '', emitente_cnpj: '', data_emissao: '', natureza: '', valor_total: 390, itens: [item] }, finalidade: 'entrega' });
    expect(c.apontamentos.map((a) => a.tipo)).toContain('ncm_divergente');
    expect(c.apontamentos.map((a) => a.tipo)).not.toContain('item_fora_do_pedido');
  });

  it('trata sinônimos de unidade', () => {
    expect(unidadeCanonica('UND')).toBe(unidadeCanonica('un'));
    expect(unidadeCanonica('Saco')).toBe(unidadeCanonica('SC'));
    expect(unidadeCanonica('m²')).toBe('m2');
    expect(unidadeCanonica('KG')).not.toBe(unidadeCanonica('SC'));
  });
});

describe('recebimento físico, pendências e OK para pagamento', () => {
  it('entrega parcial deixa pendência e só libera o OK com tudo entregue', () => {
    const e1 = { itens: [{ item: 0, quantidade: 60, ressalva: '' }] };
    let saldo = saldoDoPedido(PEDIDO, [e1]);
    expect(saldo[0]).toMatchObject({ recebida: 60, pendente: 40 });
    expect(saldo[1]!.pendente).toBe(20);
    expect(podeAtestar(saldo)).toBe(false);
    expect(statusDoPedido({ cancelado: false, pagamentoLiberado: false, temNota: true, saldo })).toBe('parcial');

    const e2 = { itens: [{ item: 0, quantidade: 40, ressalva: '2 sacos rasgados, trocados na hora' }, { item: 1, quantidade: 20, ressalva: '' }] };
    saldo = saldoDoPedido(PEDIDO, [e1, e2]);
    expect(podeAtestar(saldo)).toBe(true);
    expect(saldo[0]!.ressalvas).toEqual(['2 sacos rasgados, trocados na hora']);
    expect(statusDoPedido({ cancelado: false, pagamentoLiberado: false, temNota: true, saldo })).toBe('aguardando_ok');
    expect(statusDoPedido({ cancelado: false, pagamentoLiberado: true, temNota: true, saldo })).toBe('pagamento_liberado');
  });

  it('recusa entrada acima do pendente ou vazia', () => {
    const saldo = saldoDoPedido(PEDIDO, [{ itens: [{ item: 0, quantidade: 90, ressalva: '' }] }]);
    expect(validarEntrada(saldo, [{ item: 0, quantidade: 11, ressalva: '' }])).toMatch(/faltam 10/);
    expect(validarEntrada(saldo, [{ item: 0, quantidade: 0, ressalva: '' }])).toMatch(/pelo menos um item/);
    expect(validarEntrada(saldo, [{ item: 0, quantidade: 10, ressalva: '' }])).toBeNull();
  });

  it('status sem nota e sem entrega', () => {
    const saldo = saldoDoPedido(PEDIDO, []);
    expect(statusDoPedido({ cancelado: false, pagamentoLiberado: false, temNota: false, saldo })).toBe('aguardando_nota');
    expect(statusDoPedido({ cancelado: false, pagamentoLiberado: false, temNota: true, saldo })).toBe('aguardando_entrega');
    expect(statusDoPedido({ cancelado: true, pagamentoLiberado: false, temNota: true, saldo })).toBe('cancelado');
  });
});
