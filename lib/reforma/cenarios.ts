import type { Classificacao, ItemOperacao, RespostaCalculo } from './calculadora';

// Cenários ano a ano da Calculadora da Reforma (sub-projeto 96). Puro: monta o
// que vai para o motor oficial e interpreta o que volta. Roda no servidor e
// nos testes.
//
// Regras da transição (LC 214/2025):
//  - 2026: ano de teste. CBS 0,9% e IBS 0,1%, compensáveis: o motor usa as
//    alíquotas oficiais dele e o valor não vira custo.
//  - 2027 e 2028: CBS cheia menos 0,1 ponto e IBS de 0,1% (0,05 + 0,05).
//  - 2029 a 2032: o IBS sobe em parcelas (10%, 20%, 30%, 40% da alíquota)
//    enquanto o ICMS e o ISS caem.
//  - 2033: só CBS e IBS.
// De 2027 em diante a própria calculadora exige que quem chama informe as
// alíquotas, porque ainda não foram fixadas. Usamos a alíquota de
// referência (editável na tela) e marcamos como estimativa. As reduções, o
// direito a crédito e a base legal vêm sempre do motor oficial.

export const REFERENCIA_PADRAO = { cbs: 8.8, ibs: 17.7 } as const;

/** Parte do IBS que é estadual (o resto é municipal). Só muda a divisão
 *  mostrada, não o total. */
const PARTILHA_IBS_UF = 0.5;

export type Referencia = { cbs: number; ibs: number };

export type Cenario = {
  ano: number;
  rotulo: string;
  /** Alíquotas oficiais do motor (2026) ou estimadas pela referência. */
  oficial: boolean;
  /** Fração do IBS cheio cobrada no ano. */
  fatiaIbs: number;
};

export const CENARIOS_REFORMA: readonly Cenario[] = [
  { ano: 2026, rotulo: '2026 · teste', oficial: true, fatiaIbs: 0 },
  { ano: 2027, rotulo: '2027', oficial: false, fatiaIbs: 0 },
  { ano: 2029, rotulo: '2029', oficial: false, fatiaIbs: 0.1 },
  { ano: 2031, rotulo: '2031', oficial: false, fatiaIbs: 0.3 },
  { ano: 2033, rotulo: '2033 · completa', oficial: false, fatiaIbs: 1 },
];

const r2 = (n: number) => Math.round(n * 100) / 100;
const r4 = (n: number) => Math.round(n * 10000) / 10000;

/** Alíquotas nominais que o motor exige a partir de 2027. 2026 devolve null
 *  (o motor proíbe informar e usa as oficiais). */
export function aliquotasDoAno(
  ano: number,
  ref: Referencia,
): { cbs: number; ibsEstadual: number; ibsMunicipal: number } | null {
  if (ano <= 2026) return null;
  if (ano <= 2028) return { cbs: r4(Math.max(0, ref.cbs - 0.1)), ibsEstadual: 0.05, ibsMunicipal: 0.05 };
  const fatia = ano >= 2033 ? 1 : (ano - 2028) / 10;
  const ibs = ref.ibs * fatia;
  return { cbs: r4(ref.cbs), ibsEstadual: r4(ibs * PARTILHA_IBS_UF), ibsMunicipal: r4(ibs * (1 - PARTILHA_IBS_UF)) };
}

export function dataDoFatoGerador(ano: number, agora = new Date()): string {
  if (ano === agora.getFullYear()) {
    const d = agora.toISOString().slice(0, 10);
    return `${d}T10:00:00-03:00`;
  }
  return `${ano}-06-01T10:00:00-03:00`;
}

export type ItemCalculo = {
  descricao: string;
  ncm: string;
  cst: string;
  cClassTrib: string;
  /** Valor do item SEM CBS e IBS (o imposto novo é cobrado por fora). */
  valor: number;
  quantidade?: number;
  unidade?: string;
  /** CBS e IBS destacados na nota, quando o item veio de um XML. */
  destacado?: { cbs: number | null; ibs: number | null };
};

export function itensParaMotor(itens: ItemCalculo[], ano: number, ref: Referencia): ItemOperacao[] {
  const aliq = aliquotasDoAno(ano, ref);
  return itens.map((it, i) => ({
    numero: i + 1,
    ...(it.ncm.replace(/\D/g, '').length === 8 ? { ncm: it.ncm.replace(/\D/g, '') } : {}),
    cst: it.cst,
    cClassTrib: it.cClassTrib,
    baseCalculo: r2(it.valor),
    ...(it.quantidade ? { quantidade: it.quantidade } : {}),
    ...(it.unidade ? { unidade: it.unidade.slice(0, 6) } : {}),
    ...(aliq ? { aliquotasNominais: aliq } : {}),
  }));
}

export type ResultadoItemAno = {
  cbs: number;
  ibsUf: number;
  ibsMun: number;
  ibs: number;
  total: number;
  /** Alíquota nominal (%) do ano, antes da redução. */
  aliqCbs: number;
  aliqIbs: number;
  /** Redução da classificação (%). */
  reducao: number;
  /** Total de CBS + IBS sobre o valor do item (%). */
  aliquotaEfetiva: number;
  credito: number;
  /** Quanto o item custa de fato para a empresa: valor + imposto − crédito. */
  custoReal: number;
  memoria: string;
};

function num(s: string | undefined): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export type RegimeComprador = 'regular' | 'simples';

export function interpretarResposta(args: {
  resposta: RespostaCalculo;
  itens: ItemCalculo[];
  ano: number;
  regime: RegimeComprador;
  classificacoes: Map<string, Pick<Classificacao, 'creditoCbs' | 'creditoIbs'>>;
}): ResultadoItemAno[] {
  const { resposta, itens, ano, regime, classificacoes } = args;
  const teste = ano <= 2026;
  return itens.map((it, i) => {
    const obj = resposta.objetos.find((o) => o.nObj === i + 1);
    const g = obj?.tribCalc?.IBSCBS?.gIBSCBS;
    const cbs = num(g?.gCBS?.vCBS);
    const ibsUf = num(g?.gIBSUF?.vIBSUF);
    const ibsMun = num(g?.gIBSMun?.vIBSMun);
    const ibs = g?.vIBS != null ? num(g.vIBS) : ibsUf + ibsMun;
    const total = r2(cbs + ibs);
    const cl = classificacoes.get(it.cClassTrib);
    const credito =
      regime === 'simples' ? 0 : r2((cl?.creditoCbs ? cbs : 0) + (cl?.creditoIbs ? ibs : 0));
    return {
      cbs: r2(cbs),
      ibsUf: r2(ibsUf),
      ibsMun: r2(ibsMun),
      ibs: r2(ibs),
      total,
      aliqCbs: num(g?.gCBS?.pCBS),
      aliqIbs: r4(num(g?.gIBSUF?.pIBSUF) + num(g?.gIBSMun?.pIBSMun)),
      reducao: num(g?.gCBS?.gRed?.pRedAliq),
      aliquotaEfetiva: it.valor > 0 ? r2((total / it.valor) * 100) : 0,
      credito,
      // 2026 é teste: o valor é informativo e compensável, não vira custo.
      custoReal: teste ? r2(it.valor) : r2(it.valor + total - credito),
      memoria: (g?.gCBS?.memoriaCalculo as string | undefined) ?? '',
    };
  });
}

export type TotalAno = { valor: number; cbs: number; ibs: number; total: number; credito: number; custoReal: number };

export function totalizar(itens: ItemCalculo[], resultados: ResultadoItemAno[]): TotalAno {
  const t = { valor: 0, cbs: 0, ibs: 0, total: 0, credito: 0, custoReal: 0 };
  itens.forEach((it, i) => {
    const r = resultados[i];
    if (!r) return;
    t.valor += it.valor;
    t.cbs += r.cbs;
    t.ibs += r.ibs;
    t.total += r.total;
    t.credito += r.credito;
    t.custoReal += r.custoReal;
  });
  return { valor: r2(t.valor), cbs: r2(t.cbs), ibs: r2(t.ibs), total: r2(t.total), credito: r2(t.credito), custoReal: r2(t.custoReal) };
}

export type Conferencia = { situacao: 'confere' | 'diverge' | 'sem_destaque'; mensagem: string };

/** Compara o CBS/IBS destacado na nota com o que o motor oficial calcula. */
export function conferirDestaque(it: ItemCalculo, r: ResultadoItemAno | undefined): Conferencia {
  const d = it.destacado;
  if (!d || (d.cbs == null && d.ibs == null) || !r) {
    return { situacao: 'sem_destaque', mensagem: 'A nota não destaca CBS e IBS neste item.' };
  }
  const difCbs = d.cbs == null ? 0 : Math.abs(d.cbs - r.cbs);
  const difIbs = d.ibs == null ? 0 : Math.abs(d.ibs - r.ibs);
  const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  if (difCbs <= 0.05 && difIbs <= 0.05) {
    return { situacao: 'confere', mensagem: 'O destaque da nota bate com o cálculo oficial.' };
  }
  const partes: string[] = [];
  if (d.cbs != null && difCbs > 0.05) partes.push(`CBS na nota ${brl(d.cbs)}, oficial ${brl(r.cbs)}`);
  if (d.ibs != null && difIbs > 0.05) partes.push(`IBS na nota ${brl(d.ibs)}, oficial ${brl(r.ibs)}`);
  return { situacao: 'diverge', mensagem: partes.join('; ') };
}

/** Classificações com redução por lista de produtos (anexos da LC 214) que
 *  valem para venda entre empresas. A sugestão testa o NCM em cada uma no
 *  motor oficial. Ficam de fora:
 *  - as específicas de órgão público, emergência, ZFM, produtor rural e
 *    veículos de PcD;
 *  - 200009, 200013, 200032 e 200036, porque o motor aceita QUALQUER NCM
 *    nelas (testado em 2026-11-12: cimento e notebook "se enquadram" em
 *    medicamentos). Sugerir essas seria errado; continuam disponíveis para
 *    escolha manual. */
export const CANDIDATAS_SUGESTAO = [
  '200003', // cesta básica nacional (Anexo I), redução de 100%
  '200014', // hortícolas, frutas e ovos (Anexo XV)
  '200004', // dispositivos médicos (Anexo XII)
  '200011', // nutrição enteral e parenteral
  '200007', // acessibilidade (Anexo XIII)
  '200030', // dispositivos médicos (Anexo IV), 60%
  '200031', // acessibilidade (Anexo V), 60%
  '200033', // nutrição (Anexo VI), 60%
  '200034', // alimentos (Anexo VII), 60%
  '200035', // higiene pessoal e limpeza (Anexo VIII), 60%
] as const;

export const PADRAO_CLASSIFICACAO = { cst: '000', cClassTrib: '000001' } as const;
