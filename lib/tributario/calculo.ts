import { z } from 'zod';

// Análise Tributária de Propostas (pedido do Alexandre, 2026-10-20: "jogar 3
// propostas e ver qual tem a melhor situação pelo lado tributário, imaginando
// a reforma tributária").
//
// Função PURA, usada no servidor (prompt do LLM) e no navegador (tabela e
// gráfico na tela), para que o número que o cliente vê seja o mesmo que a IA
// comenta. A IA nunca calcula: só interpreta.
//
// Modelo simplificado e declarado (não substitui parecer fiscal):
// - "Custo líquido" = o que sai do caixa (preço + IPI + ST + frete) menos os
//   créditos que o comprador recupera. É o número que compara propostas.
// - Hoje: crédito de ICMS (revenda, insumo, ativo), IPI (insumo) e PIS/Cofins
//   9,25% (só Lucro Real; base sem ICMS, Lei 14.592/2023). Simples não credita.
// - Reforma (LC 214/2025): a partir de 2027 PIS/Cofins dão lugar à CBS e o
//   IPI zera (fora a Zona Franca); de 2029 a 2032 o ICMS cai 10% ao ano e o
//   IBS ocupa o espaço; em 2033 só IBS + CBS. IBS/CBS são "por fora", com
//   crédito amplo para comprador do regime regular (Lucro Real ou Presumido),
//   inclusive uso e consumo. Fornecedor do Simples transfere só o crédito que
//   recolhe no DAS (percentual estimado, editável).
// - Alíquotas de IBS/CBS ainda não são definitivas: os padrões (CBS 8,8% +
//   IBS 17,7% = 26,5%) são estimativas e ficam editáveis na tela.

export const REGIMES_COMPRADOR = ['lucro_real', 'lucro_presumido', 'simples'] as const;
export type RegimeComprador = (typeof REGIMES_COMPRADOR)[number];
export const REGIME_COMPRADOR_LABELS: Record<RegimeComprador, string> = {
  lucro_real: 'Lucro Real',
  lucro_presumido: 'Lucro Presumido',
  simples: 'Simples Nacional',
};

export const DESTINACOES = ['revenda', 'insumo', 'uso_consumo', 'ativo_imobilizado'] as const;
export type Destinacao = (typeof DESTINACOES)[number];
export const DESTINACAO_LABELS: Record<Destinacao, string> = {
  revenda: 'Revenda',
  insumo: 'Insumo (industrialização ou prestação)',
  uso_consumo: 'Uso e consumo',
  ativo_imobilizado: 'Ativo imobilizado',
};

export const REGIMES_FORNECEDOR = ['regular', 'simples'] as const;
export type RegimeFornecedor = (typeof REGIMES_FORNECEDOR)[number];
export const REGIME_FORNECEDOR_LABELS: Record<RegimeFornecedor, string> = {
  regular: 'Regime normal (Real ou Presumido)',
  simples: 'Simples Nacional',
};

/** Redução de alíquota de IBS/CBS prevista para o item (LC 214/2025). */
export const REDUCOES = [0, 30, 60, 100] as const;
export const REDUCAO_LABELS: Record<number, string> = {
  0: 'Alíquota cheia',
  30: 'Redução de 30%',
  60: 'Redução de 60%',
  100: 'Alíquota zero',
};

const pct = z.number().min(0).max(100);
const valor = z.number().min(0).max(1_000_000_000_000);

export const PropostaTributariaSchema = z.object({
  fornecedor: z.string().trim().min(1).max(200),
  cnpj: z.string().trim().max(20),
  uf: z.string().trim().max(2),
  regimeFornecedor: z.enum(REGIMES_FORNECEDOR),
  /** Valor dos produtos/serviços como na nota: ICMS e PIS/Cofins embutidos, sem IPI e sem ST. */
  valorProdutos: valor,
  ipiPct: pct,
  /** Alíquota de ICMS destacada. No Simples, o percentual de crédito informado na nota. */
  icmsPct: pct,
  /** PIS/Cofins embutidos no preço pelo fornecedor (9,25% no Real, 3,65% no Presumido). */
  pisCofinsPct: pct,
  stValor: valor,
  freteValor: valor,
  reducaoReformaPct: z.union([z.literal(0), z.literal(30), z.literal(60), z.literal(100)]),
});
export type PropostaTributaria = z.infer<typeof PropostaTributariaSchema>;

export const ParametrosTributariosSchema = z.object({
  descricaoCompra: z.string().trim().min(2).max(300),
  regimeComprador: z.enum(REGIMES_COMPRADOR),
  destinacao: z.enum(DESTINACOES),
  ufComprador: z.string().trim().max(2),
  cbsPct: pct,
  ibsPct: pct,
  /** Crédito de IBS/CBS que um fornecedor do Simples transfere, em % do valor. */
  simplesCreditoPct: pct,
  propostas: z.array(PropostaTributariaSchema).min(2).max(8),
  notes: z.string().trim().max(4000),
});
export type ParametrosTributarios = z.infer<typeof ParametrosTributariosSchema>;

export const PADROES_REFORMA = { cbsPct: 8.8, ibsPct: 17.7, simplesCreditoPct: 4 } as const;

export const CENARIOS = [
  { id: 'atual', ano: 2026, rotulo: 'Hoje (2026)', fatiaIbs: 0, reforma: false },
  { id: '2027', ano: 2027, rotulo: '2027', fatiaIbs: 0, reforma: true },
  { id: '2029', ano: 2029, rotulo: '2029', fatiaIbs: 0.1, reforma: true },
  { id: '2031', ano: 2031, rotulo: '2031', fatiaIbs: 0.3, reforma: true },
  { id: '2033', ano: 2033, rotulo: '2033 (reforma completa)', fatiaIbs: 1, reforma: true },
] as const;
export type CenarioId = (typeof CENARIOS)[number]['id'];

export type ResultadoCenario = {
  desembolso: number;
  creditos: number;
  custoLiquido: number;
  /** Tributos pagos ao fornecedor que NÃO voltam como crédito. */
  tributoNaoRecuperado: number;
  detalhe: {
    icms: number;
    ipi: number;
    pisCofins: number;
    cbs: number;
    ibs: number;
    st: number;
    creditoIcms: number;
    creditoIpi: number;
    creditoPisCofins: number;
    creditoIbsCbs: number;
  };
};

export type ResultadoProposta = {
  fornecedor: string;
  cenarios: Record<CenarioId, ResultadoCenario>;
};

export type AnaliseTributaria = {
  propostas: ResultadoProposta[];
  /** Índice da proposta de menor custo líquido em cada cenário. */
  melhorPorCenario: Record<CenarioId, number>;
  /** A melhor proposta de hoje deixa de ser a melhor em algum ano da transição. */
  viradaNaReforma: boolean;
  avisos: string[];
};

const r2 = (n: number) => Math.round(n * 100) / 100;

function zero(): ResultadoCenario['detalhe'] {
  return {
    icms: 0, ipi: 0, pisCofins: 0, cbs: 0, ibs: 0, st: 0,
    creditoIcms: 0, creditoIpi: 0, creditoPisCofins: 0, creditoIbsCbs: 0,
  };
}

function calcularCenario(
  p: PropostaTributaria,
  ctx: ParametrosTributarios,
  cen: (typeof CENARIOS)[number],
): ResultadoCenario {
  const d = zero();
  const f = cen.fatiaIbs;
  const compradorCredita = ctx.regimeComprador !== 'simples';
  const creditaIcms =
    compradorCredita && ctx.destinacao !== 'uso_consumo';
  const reducao = 1 - p.reducaoReformaPct / 100;
  const cbsRate = (ctx.cbsPct / 100) * reducao;
  const ibsRate = (ctx.ibsPct / 100) * reducao;

  const icmsHoje = p.valorProdutos * (p.icmsPct / 100);
  let desembolso: number;

  if (!cen.reforma) {
    d.icms = icmsHoje;
    d.ipi = p.valorProdutos * (p.ipiPct / 100);
    d.pisCofins = p.regimeFornecedor === 'regular' ? p.valorProdutos * (p.pisCofinsPct / 100) : 0;
    d.st = p.stValor;
    desembolso = p.valorProdutos + d.ipi + d.st + p.freteValor;

    if (creditaIcms) d.creditoIcms = d.icms;
    if (compradorCredita && ctx.destinacao === 'insumo') d.creditoIpi = d.ipi;
    if (ctx.regimeComprador === 'lucro_real' && ctx.destinacao !== 'uso_consumo') {
      d.creditoPisCofins = Math.max(0, p.valorProdutos - d.icms) * 0.0925;
    }
  } else if (p.regimeFornecedor === 'regular') {
    // O fornecedor reprecifica: tira do preço o ICMS e o PIS/Cofins embutidos,
    // fica com a base "limpa" e soma os tributos do ano (IBS/CBS por fora; a
    // base deles não inclui ICMS durante a transição).
    const base = Math.max(0, p.valorProdutos - icmsHoje - p.valorProdutos * (p.pisCofinsPct / 100));
    d.icms = icmsHoje * (1 - f);
    d.cbs = base * cbsRate;
    d.ibs = base * ibsRate * f;
    d.st = p.stValor * (1 - f);
    desembolso = base + d.icms + d.cbs + d.ibs + d.st + p.freteValor;

    if (creditaIcms) d.creditoIcms = d.icms;
    if (compradorCredita) d.creditoIbsCbs = d.cbs + d.ibs;
  } else {
    // Simples: o preço continua o mesmo (o DAS está dentro dele) e o crédito
    // de IBS/CBS é só o que o fornecedor recolhe no DAS.
    d.icms = icmsHoje * (1 - f);
    d.st = p.stValor * (1 - f);
    desembolso = p.valorProdutos + d.st + p.freteValor;

    if (creditaIcms) d.creditoIcms = d.icms;
    if (compradorCredita) {
      const total = ctx.cbsPct + ctx.ibsPct;
      const fatia = total > 0 ? (ctx.cbsPct + ctx.ibsPct * f) / total : 0;
      d.creditoIbsCbs = p.valorProdutos * (ctx.simplesCreditoPct / 100) * fatia * reducao;
    }
  }

  const creditos = d.creditoIcms + d.creditoIpi + d.creditoPisCofins + d.creditoIbsCbs;
  const tributos = d.icms + d.ipi + d.pisCofins + d.cbs + d.ibs + d.st;
  const detalhe = Object.fromEntries(
    Object.entries(d).map(([k, v]) => [k, r2(v)]),
  ) as ResultadoCenario['detalhe'];

  return {
    desembolso: r2(desembolso),
    creditos: r2(creditos),
    custoLiquido: r2(desembolso - creditos),
    tributoNaoRecuperado: r2(Math.max(0, tributos - creditos)),
    detalhe,
  };
}

export function analisarPropostas(ctx: ParametrosTributarios): AnaliseTributaria {
  const propostas: ResultadoProposta[] = ctx.propostas.map((p) => ({
    fornecedor: p.fornecedor,
    cenarios: Object.fromEntries(
      CENARIOS.map((c) => [c.id, calcularCenario(p, ctx, c)]),
    ) as Record<CenarioId, ResultadoCenario>,
  }));

  const melhorPorCenario = Object.fromEntries(
    CENARIOS.map((c) => {
      let melhor = 0;
      propostas.forEach((p, i) => {
        // Empate: fica a que veio primeiro (ordem estável).
        if (p.cenarios[c.id].custoLiquido < propostas[melhor]!.cenarios[c.id].custoLiquido) melhor = i;
      });
      return [c.id, melhor];
    }),
  ) as Record<CenarioId, number>;

  const avisos: string[] = [];
  if (ctx.regimeComprador === 'simples') {
    avisos.push(
      'Empresa do Simples Nacional não aproveita crédito hoje e, na reforma, só credita IBS/CBS se optar pelo regime regular. O custo líquido é o próprio desembolso.',
    );
  }
  if (ctx.destinacao === 'uso_consumo' && ctx.regimeComprador !== 'simples') {
    avisos.push(
      'Uso e consumo não gera crédito de ICMS hoje, mas gera crédito de IBS/CBS na reforma: compras de fornecedores do regime normal tendem a ficar mais baratas a partir de 2027.',
    );
  }
  if (ctx.destinacao === 'ativo_imobilizado') {
    avisos.push('Crédito de ICMS de ativo imobilizado é apropriado em 48 meses (CIAP); o cálculo mostra o valor total, não o fluxo mensal.');
  }
  if (ctx.propostas.some((p) => p.regimeFornecedor === 'simples') && ctx.regimeComprador !== 'simples') {
    avisos.push(
      `Fornecedor do Simples transfere pouco crédito de IBS/CBS (estimado em ${ctx.simplesCreditoPct}% do valor). Vale perguntar se ele vai optar pelo regime regular a partir de 2027.`,
    );
  }

  return {
    propostas,
    melhorPorCenario,
    viradaNaReforma: CENARIOS.some((c) => melhorPorCenario[c.id] !== melhorPorCenario.atual),
    avisos,
  };
}

export function brl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Tabela em markdown com o custo líquido por proposta e por ano (vai para o prompt e para o relatório). */
export function tabelaCustoLiquido(ctx: ParametrosTributarios, a: AnaliseTributaria): string {
  const cab = `| Proposta | ${CENARIOS.map((c) => c.rotulo).join(' | ')} |`;
  const sep = `|---|${CENARIOS.map(() => '---:').join('|')}|`;
  const linhas = a.propostas.map((p, i) => {
    const cels = CENARIOS.map((c) => {
      const v = brl(p.cenarios[c.id].custoLiquido);
      return a.melhorPorCenario[c.id] === i ? `**${v}**` : v;
    });
    const regime = REGIME_FORNECEDOR_LABELS[ctx.propostas[i]!.regimeFornecedor];
    return `| ${p.fornecedor} (${regime}) | ${cels.join(' | ')} |`;
  });
  return [cab, sep, ...linhas].join('\n');
}
