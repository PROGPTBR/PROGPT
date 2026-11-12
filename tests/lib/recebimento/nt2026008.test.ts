import { describe, expect, it } from 'vitest';

import { lerNfeXml, valorSemTributos } from '@/lib/recebimento/nfe-xml';
import { conferirNota } from '@/lib/recebimento/conferencia';
import type { PedidoItem } from '@/lib/recebimento/types';

// NT 2026.008 (em produção desde 16/11/2026): vUnComLiq e vProdLiq no item,
// vProdLiqTot nos totais e vICMSPrevisto na nota de pagamento antecipado.
// Exemplo do próprio texto da NT: ICMS de 18%, líquido 200,00, vProd 243,90.
function nota(opts: { vProd: string; vICMS: string; liq?: string; liqUnit?: string; previsto?: string; pis?: string; cofins?: string }) {
  const liq = opts.liq ? `<vUnComLiq>${opts.liqUnit ?? opts.liq}</vUnComLiq><vProdLiq>${opts.liq}</vProdLiq>` : '';
  const previsto = opts.previsto ? `<ICMSPrevistoPagtoAntecip><vICMSPrevisto>${opts.previsto}</vICMSPrevisto></ICMSPrevistoPagtoAntecip>` : '';
  return `<nfeProc><NFe><infNFe Id="NFe35261112345678000199550010000012341000012345">
<ide><natOp>VENDA</natOp><serie>1</serie><nNF>9</nNF><dhEmi>2026-11-16T10:00:00-03:00</dhEmi></ide>
<emit><CNPJ>12345678000199</CNPJ><xNome>Fornecedor</xNome></emit>
<det nItem="1"><prod><cProd>A</cProd><xProd>CIMENTO CP II 50KG</xProd><NCM>25232910</NCM><CFOP>5102</CFOP><uCom>SC</uCom><qCom>1</qCom><vUnCom>${opts.vProd}</vUnCom><vProd>${opts.vProd}</vProd>${liq}</prod>
<imposto><ICMS><ICMS00><pICMS>18.00</pICMS><vICMS>${opts.vICMS}</vICMS></ICMS00></ICMS>
${opts.pis ? `<PIS><PISAliq><vPIS>${opts.pis}</vPIS></PISAliq></PIS>` : ''}${opts.cofins ? `<COFINS><COFINSAliq><vCOFINS>${opts.cofins}</vCOFINS></COFINSAliq></COFINS>` : ''}${previsto}</imposto></det>
<total><ICMSTot><vNF>263.90</vNF></ICMSTot>${opts.liq ? `<vProdLiqTot>${opts.liq}</vProdLiqTot>` : ''}</total></infNFe></NFe></nfeProc>`;
}

const pedido: PedidoItem[] = [
  { codigo: 'M1', descricao: 'Cimento CP II 50kg', ncm: '25232910', unidade: 'SC', quantidade: 1, valor_unitario: 243.9, icms_pct: 18, ipi_pct: null },
];

describe('leitura dos campos da NT 2026.008', () => {
  it('lê líquido unitário e total, total líquido da nota, tributos embutidos e ICMS previsto', () => {
    const n = lerNfeXml(nota({ vProd: '243.90', vICMS: '43.90', liq: '200.00', previsto: '43.90' }));
    expect(n.itens[0]!.liquido).toEqual({ unitario: 200, total: 200 });
    expect(n.itens[0]!.embutidos).toEqual({ icms: 43.9, fcp: null, pis: null, cofins: null });
    expect(n.itens[0]!.icms_previsto).toBe(43.9);
    expect(n.valor_liquido_total).toBe(200);
  });

  it('nota sem os campos novos (opcionais no leiaute) fica com líquido nulo', () => {
    const n = lerNfeXml(nota({ vProd: '243.90', vICMS: '43.90' }));
    expect(n.itens[0]!.liquido).toBeNull();
    expect(n.valor_liquido_total).toBeNull();
  });
});

describe('valor sem tributos (base da CBS e do IBS)', () => {
  it('usa o líquido da nota quando existe', () => {
    const it = lerNfeXml(nota({ vProd: '243.90', vICMS: '43.90', liq: '200.00' })).itens[0]!;
    expect(valorSemTributos(it)).toEqual({ valor: 200, origem: 'liquido_da_nota' });
  });

  it('sem o líquido, desconta ICMS, PIS e Cofins do vProd', () => {
    const it = lerNfeXml(nota({ vProd: '243.90', vICMS: '43.90', pis: '1.65', cofins: '7.60' })).itens[0]!;
    expect(valorSemTributos(it)).toEqual({ valor: 190.75, origem: 'sem_embutidos' });
  });

  it('sem nada, fica o valor do produto', () => {
    expect(valorSemTributos({ valor_total: 100, quantidade: 1, valor_unitario: 100, liquido: null, embutidos: null })).toEqual({
      valor: 100,
      origem: 'valor_do_produto',
    });
  });
});

describe('o que a SEFAZ não confere: líquido x vProd menos tributos embutidos', () => {
  it('nota coerente (preço formado dividindo por 1 menos a alíquota) passa sem aviso', () => {
    const n = lerNfeXml(nota({ vProd: '243.90', vICMS: '43.90', liq: '200.00' }));
    const c = conferirNota({ pedido: { itens: pedido, fornecedor_cnpj: '' }, nota: n, finalidade: 'unica' });
    expect(c.apontamentos.some((a) => a.tipo === 'liquido_divergente')).toBe(false);
  });

  it('preço formado multiplicando por 1 mais a alíquota vira aviso para o financeiro, sem travar a nota', () => {
    // 200 x 1,18 = 236,00; ICMS de 18% sobre 236 = 42,48; vProd menos ICMS = 193,52, mas o líquido informado é 200.
    const n = lerNfeXml(nota({ vProd: '236.00', vICMS: '42.48', liq: '200.00' }));
    const c = conferirNota({
      pedido: { itens: [{ ...pedido[0]!, valor_unitario: 236 }], fornecedor_cnpj: '' },
      nota: n,
      finalidade: 'unica',
    });
    const a = c.apontamentos.find((x) => x.tipo === 'liquido_divergente');
    expect(a).toMatchObject({ severidade: 'info', financeiro: true, item: 0 });
    expect(a!.mensagem).toMatch(/193,52/);
    expect(c.ok).toBe(true);
  });

  it('nota só de entrega não recebe o aviso (é assunto do financeiro)', () => {
    const n = lerNfeXml(nota({ vProd: '236.00', vICMS: '42.48', liq: '200.00' }));
    const c = conferirNota({ pedido: { itens: pedido, fornecedor_cnpj: '' }, nota: n, finalidade: 'entrega' });
    expect(c.apontamentos.some((a) => a.tipo === 'liquido_divergente')).toBe(false);
  });
});
