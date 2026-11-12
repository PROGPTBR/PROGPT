import type { FinalidadeNota, NotaItem, NotaLida } from './types';

// Leitura do XML da NF-e (layout 4.00 da SEFAZ). O XML é o documento oficial
// e estruturado, então não precisa de IA: cada item traz código, descrição,
// NCM, CFOP, quantidade, valor e as alíquotas de ICMS e IPI.
//
// Lido por expressão regular de propósito (sem dependência nova): o layout é
// fixo e as tags que interessam nunca se repetem dentro do mesmo bloco.

function semPrefixo(xml: string): string {
  // <nfe:det> → <det>. Raro, mas alguns emissores exportam com prefixo.
  return xml.replace(/<(\/?)[A-Za-z_][\w.-]*:/g, '<$1');
}

function tag(bloco: string, nome: string): string {
  const m = bloco.match(new RegExp(`<${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</${nome}>`));
  return m ? decodificar(m[1]!.trim()) : '';
}

function bloco(xml: string, nome: string): string {
  const m = xml.match(new RegExp(`<${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</${nome}>`));
  return m ? m[1]! : '';
}

function decodificar(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function num(s: string): number | null {
  if (!s) return null;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** É um XML de NF-e (e não de outra coisa)? */
export function pareceNfe(texto: string): boolean {
  const x = semPrefixo(texto);
  return /<infNFe[\s>]/.test(x) && /<det[\s>]/.test(x);
}

export function lerNfeXml(texto: string): NotaLida {
  const xml = semPrefixo(texto);
  if (!pareceNfe(xml)) throw new Error('O arquivo não é o XML de uma NF-e.');

  const infId = xml.match(/<infNFe[^>]*\sId="([^"]+)"/)?.[1] ?? '';
  const chave = infId.replace(/^NFe/, '') || tag(xml, 'chNFe');

  const ide = bloco(xml, 'ide');
  const emit = bloco(xml, 'emit');
  const total = bloco(xml, 'ICMSTot');

  const itens: NotaItem[] = [];
  const dets = xml.match(/<det[\s>][\s\S]*?<\/det>/g) ?? [];
  for (const det of dets) {
    const prod = bloco(det, 'prod');
    const icms = bloco(det, 'ICMS');
    const ipi = bloco(det, 'IPI');
    const ibscbs = bloco(det, 'IBSCBS');
    const liqUnit = num(tag(prod, 'vUnComLiq'));
    const liqTotal = num(tag(prod, 'vProdLiq'));
    const embutidos = {
      icms: num(tag(icms, 'vICMS')),
      fcp: num(tag(icms, 'vFCP')),
      pis: num(tag(bloco(det, 'PIS'), 'vPIS')),
      cofins: num(tag(bloco(det, 'COFINS'), 'vCOFINS')),
    };
    itens.push({
      codigo: tag(prod, 'cProd'),
      descricao: tag(prod, 'xProd'),
      ncm: tag(prod, 'NCM'),
      cfop: tag(prod, 'CFOP'),
      unidade: tag(prod, 'uCom'),
      quantidade: num(tag(prod, 'qCom')),
      valor_unitario: num(tag(prod, 'vUnCom')),
      valor_total: num(tag(prod, 'vProd')),
      // Simples Nacional destaca pCredSN em vez de pICMS: fica nulo.
      icms_pct: num(tag(icms, 'pICMS')),
      ipi_pct: num(tag(ipi, 'pIPI')),
      ibscbs: ibscbs
        ? {
            cst: tag(ibscbs, 'CST'),
            cClassTrib: tag(ibscbs, 'cClassTrib'),
            vCBS: num(tag(bloco(ibscbs, 'gCBS'), 'vCBS')),
            vIBS: num(tag(ibscbs, 'vIBS')),
          }
        : null,
      liquido: liqUnit != null || liqTotal != null ? { unitario: liqUnit, total: liqTotal } : null,
      embutidos: Object.values(embutidos).some((v) => v != null) ? embutidos : null,
      icms_previsto: num(tag(det, 'vICMSPrevisto')),
    });
  }

  return {
    numero: tag(ide, 'nNF'),
    serie: tag(ide, 'serie'),
    chave,
    emitente_nome: tag(emit, 'xNome'),
    emitente_cnpj: tag(emit, 'CNPJ') || tag(emit, 'CPF'),
    data_emissao: (tag(ide, 'dhEmi') || tag(ide, 'dEmi')).slice(0, 10),
    natureza: tag(ide, 'natOp'),
    valor_total: num(tag(total, 'vNF')),
    valor_liquido_total: num(tag(bloco(xml, 'total'), 'vProdLiqTot')),
    itens,
  };
}

// CFOPs da venda para entrega futura: a empresa recebe DUAS notas.
//  - 5922/6922: simples faturamento (a nota financeira, sem mercadoria)
//  - 5116/5117/6116/6117: remessa da mercadoria (a nota de entrega)
const CFOP_FATURAMENTO = new Set(['5922', '6922']);
const CFOP_REMESSA = new Set(['5116', '5117', '6116', '6117']);

/** Para onde a nota vai, pelo CFOP dos itens (e, na falta, pela natureza
 *  da operação). Venda comum é nota única: serve à entrega e ao financeiro. */
export function finalidadeDaNota(nota: Pick<NotaLida, 'itens' | 'natureza'>): FinalidadeNota {
  const cfops = nota.itens.map((i) => i.cfop.replace(/\D/g, '')).filter(Boolean);
  if (cfops.length > 0 && cfops.every((c) => CFOP_FATURAMENTO.has(c))) return 'financeira';
  if (cfops.length > 0 && cfops.every((c) => CFOP_REMESSA.has(c))) return 'entrega';

  const nat = nota.natureza
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  if (/simples faturamento|faturamento antecipado/.test(nat)) return 'financeira';
  if (/remessa.*(entrega futura|venda)/.test(nat)) return 'entrega';
  return 'unica';
}

/** Valor do item sem tributos: o líquido que a nota informa (NT 2026.008)
 *  ou, na falta dele, o vProd menos os tributos que ficam "por dentro"
 *  (ICMS, FCP, PIS e Cofins). É a base que a reforma usa para CBS e IBS. */
export function valorSemTributos(
  item: Pick<NotaItem, 'valor_total' | 'quantidade' | 'valor_unitario' | 'liquido' | 'embutidos'>,
): { valor: number; origem: 'liquido_da_nota' | 'sem_embutidos' | 'valor_do_produto' } {
  if (item.liquido?.total != null) return { valor: item.liquido.total, origem: 'liquido_da_nota' };
  const bruto = item.valor_total ?? (item.quantidade ?? 0) * (item.valor_unitario ?? 0);
  const e = item.embutidos;
  if (e) {
    const soma = (e.icms ?? 0) + (e.fcp ?? 0) + (e.pis ?? 0) + (e.cofins ?? 0);
    return { valor: Math.round((bruto - soma) * 100) / 100, origem: 'sem_embutidos' };
  }
  return { valor: bruto, origem: 'valor_do_produto' };
}
