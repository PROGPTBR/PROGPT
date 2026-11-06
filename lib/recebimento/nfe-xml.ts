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
