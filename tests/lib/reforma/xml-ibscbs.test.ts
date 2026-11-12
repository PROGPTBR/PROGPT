import { describe, expect, it } from 'vitest';

import { lerNfeXml } from '@/lib/recebimento/nfe-xml';

// NF-e no layout da reforma (grupo IBSCBS dentro de <imposto>, obrigatório
// desde 2026): a Calculadora da Reforma lê o CST, o cClassTrib e o destaque.
const xml = `<nfeProc><NFe><infNFe Id="NFe35261112345678000199550010000012341000012345">
<ide><natOp>VENDA</natOp><serie>1</serie><nNF>77</nNF><dhEmi>2026-11-10T10:00:00-03:00</dhEmi></ide>
<emit><CNPJ>12345678000199</CNPJ><xNome>Fornecedor</xNome></emit>
<det nItem="1"><prod><cProd>A</cProd><xProd>SABAO EM BARRA</xProd><NCM>34011190</NCM><CFOP>5102</CFOP><uCom>UN</uCom><qCom>100</qCom><vUnCom>5.00</vUnCom><vProd>500.00</vProd></prod>
<imposto><ICMS><ICMS00><pICMS>18.00</pICMS></ICMS00></ICMS>
<IBSCBS><CST>200</CST><cClassTrib>200035</cClassTrib><gIBSCBS><vBC>500.00</vBC>
<gIBSUF><pIBSUF>0.10</pIBSUF><gRed><pRedAliq>60.00</pRedAliq><pAliqEfet>0.04</pAliqEfet></gRed><vIBSUF>0.20</vIBSUF></gIBSUF>
<gIBSMun><pIBSMun>0.00</pIBSMun><vIBSMun>0.00</vIBSMun></gIBSMun><vIBS>0.20</vIBS>
<gCBS><pCBS>0.90</pCBS><gRed><pRedAliq>60.00</pRedAliq><pAliqEfet>0.36</pAliqEfet></gRed><vCBS>1.80</vCBS></gCBS></gIBSCBS></IBSCBS>
</imposto></det>
<det nItem="2"><prod><cProd>B</cProd><xProd>CIMENTO</xProd><NCM>25232910</NCM><CFOP>5102</CFOP><uCom>SC</uCom><qCom>10</qCom><vUnCom>30</vUnCom><vProd>300.00</vProd></prod>
<imposto><ICMS><ICMS00><pICMS>18.00</pICMS></ICMS00></ICMS></imposto></det>
<total><ICMSTot><vNF>800.00</vNF></ICMSTot></total></infNFe></NFe></nfeProc>`;

describe('grupo IBSCBS no XML da NF-e', () => {
  it('lê CST, cClassTrib e os valores destacados de CBS e IBS', () => {
    const n = lerNfeXml(xml);
    expect(n.itens[0]!.ibscbs).toEqual({ cst: '200', cClassTrib: '200035', vCBS: 1.8, vIBS: 0.2 });
  });

  it('item sem o grupo fica com ibscbs nulo (nota antiga ou item sem destaque)', () => {
    expect(lerNfeXml(xml).itens[1]!.ibscbs).toBeNull();
  });
});
