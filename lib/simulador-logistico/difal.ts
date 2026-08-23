import { UF_LIST, type UF } from '@/lib/suppliers/types';

export { UF_LIST, type UF };

// DIFAL — Diferencial de Alíquota do ICMS. Motor de cálculo PURO e
// determinístico (nenhuma chamada de LLM/API neste arquivo): imposto é
// aritmética, não geração de texto — um número calculado por um modelo é
// risco de alucinação inaceitável numa decisão de compra real.
//
// Base legal: EC 87/2015 (consumidor final não-contribuinte) + Art. 155 §2º
// VII/VIII CF (contribuinte comprando pra uso/consumo ou ativo imobilizado —
// o cenário mais relevante pro comprador corporativo B2B, público do
// PROGPT) + LC 190/2022 + Convênio ICMS 236/2021 (CONFAZ, unificou a base de
// cálculo "por dentro"/base dupla). Desde 2019, 100% do DIFAL vai pro estado
// de destino (fim da partilha transitória da EC 87/2015).
//
// Fórmula (base dupla / cálculo por dentro), verificada contra exemplo
// numérico público (ver tests/lib/simulador-logistico/difal.test.ts):
//   Base ICMS Origem  = Valor / (1 − alíq. interestadual)
//   ICMS Origem       = Base Origem × alíq. interestadual
//   Base ICMS Destino = Valor / (1 − (alíq. interna destino + FCP%))
//   ICMS Destino      = Base Destino × alíq. interna destino
//   FCP               = Base Destino × FCP%
//   DIFAL (ICMS)      = ICMS Destino − ICMS Origem
//   Total a recolher  = DIFAL + FCP

export type Regiao = 'norte' | 'nordeste' | 'centro-oeste' | 'sudeste' | 'sul';

export type UfInfo = {
  nome: string;
  regiao: Regiao;
  // Alíquota interna PADRÃO do estado, em %. NÃO cobre exceções por
  // NCM/produto (combustível, energia, comunicação, bebidas, cigarros,
  // cesta básica, substituição tributária) — é um DEFAULT editável no
  // form, não uma fonte de verdade travada.
  aliquotaInterna: number;
  // FCP (Fundo de Combate à Pobreza) padrão do estado, em %. 0 onde não
  // encontrei FCP confirmado pra alíquota geral (pode existir FCP
  // específico por produto mesmo assim).
  fcp: number;
};

// Pesquisado e cross-validado em fontes públicas (Focus NFe, TributoDevido,
// SIMTAX) em 23/08/2026. Alíquotas estaduais mudam por lei estadual — trate
// como ponto de partida, não como tabela oficial travada; o form permite
// sobrescrever aliquotaInternaDestino/fcp por cálculo.
export const UF_INFO: Record<UF, UfInfo> = {
  AC: { nome: 'Acre', regiao: 'norte', aliquotaInterna: 19, fcp: 0 },
  AL: { nome: 'Alagoas', regiao: 'nordeste', aliquotaInterna: 19, fcp: 1 },
  AP: { nome: 'Amapá', regiao: 'norte', aliquotaInterna: 18, fcp: 0 },
  AM: { nome: 'Amazonas', regiao: 'norte', aliquotaInterna: 20, fcp: 0 },
  BA: { nome: 'Bahia', regiao: 'nordeste', aliquotaInterna: 20.5, fcp: 0 },
  CE: { nome: 'Ceará', regiao: 'nordeste', aliquotaInterna: 20, fcp: 0 },
  DF: { nome: 'Distrito Federal', regiao: 'centro-oeste', aliquotaInterna: 20, fcp: 0 },
  ES: { nome: 'Espírito Santo', regiao: 'sudeste', aliquotaInterna: 17, fcp: 0 },
  GO: { nome: 'Goiás', regiao: 'centro-oeste', aliquotaInterna: 19, fcp: 0 },
  MA: { nome: 'Maranhão', regiao: 'nordeste', aliquotaInterna: 23, fcp: 0 },
  MT: { nome: 'Mato Grosso', regiao: 'centro-oeste', aliquotaInterna: 17, fcp: 0 },
  MS: { nome: 'Mato Grosso do Sul', regiao: 'centro-oeste', aliquotaInterna: 17, fcp: 0 },
  MG: { nome: 'Minas Gerais', regiao: 'sudeste', aliquotaInterna: 18, fcp: 0 },
  PA: { nome: 'Pará', regiao: 'norte', aliquotaInterna: 19, fcp: 0 },
  PB: { nome: 'Paraíba', regiao: 'nordeste', aliquotaInterna: 20, fcp: 0 },
  PR: { nome: 'Paraná', regiao: 'sul', aliquotaInterna: 19.5, fcp: 0 },
  PE: { nome: 'Pernambuco', regiao: 'nordeste', aliquotaInterna: 20.5, fcp: 0 },
  PI: { nome: 'Piauí', regiao: 'nordeste', aliquotaInterna: 22.5, fcp: 0 },
  RJ: { nome: 'Rio de Janeiro', regiao: 'sudeste', aliquotaInterna: 20, fcp: 2 },
  RN: { nome: 'Rio Grande do Norte', regiao: 'nordeste', aliquotaInterna: 20, fcp: 0 },
  RS: { nome: 'Rio Grande do Sul', regiao: 'sul', aliquotaInterna: 17, fcp: 0 },
  RO: { nome: 'Rondônia', regiao: 'norte', aliquotaInterna: 19.5, fcp: 0 },
  RR: { nome: 'Roraima', regiao: 'norte', aliquotaInterna: 20, fcp: 0 },
  SC: { nome: 'Santa Catarina', regiao: 'sul', aliquotaInterna: 17, fcp: 0 },
  SP: { nome: 'São Paulo', regiao: 'sudeste', aliquotaInterna: 18, fcp: 0 },
  SE: { nome: 'Sergipe', regiao: 'nordeste', aliquotaInterna: 19, fcp: 1 },
  TO: { nome: 'Tocantins', regiao: 'norte', aliquotaInterna: 20, fcp: 0 },
};

const SUL_SUDESTE_NAO_ES = new Set<UF>(['PR', 'RS', 'SC', 'SP', 'RJ', 'MG']);

/**
 * Alíquota interestadual do ICMS, em %.
 * - 4%: bem/mercadoria importado ou com conteúdo de importação > 40%,
 *   qualquer par origem-destino.
 * - 7%: origem em Sul/Sudeste (exceto ES) → destino Norte/Nordeste/
 *   Centro-Oeste/ES.
 * - 12%: demais combinações.
 */
export function aliquotaInterestadual(
  ufOrigem: UF,
  ufDestino: UF,
  importado: boolean,
): number {
  if (importado) return 4;
  if (SUL_SUDESTE_NAO_ES.has(ufOrigem) && !SUL_SUDESTE_NAO_ES.has(ufDestino)) {
    return 7;
  }
  return 12;
}

export type Finalidade = 'uso_consumo' | 'ativo_imobilizado' | 'revenda';

export type DifalInput = {
  valor: number;
  ufOrigem: UF;
  ufDestino: UF;
  importado?: boolean;
  // Overrides — default vem de UF_INFO[ufDestino]. Editáveis porque a
  // tabela bundled não cobre exceção por NCM/produto.
  aliquotaInternaDestino?: number;
  fcp?: number;
  finalidade?: Finalidade;
};

export type DifalResultado = {
  aliquotaInterestadual: number;
  aliquotaInternaDestino: number;
  fcp: number;
  baseOrigem: number;
  icmsOrigem: number;
  baseDestino: number;
  icmsDestino: number;
  fcpValor: number;
  difal: number;
  totalRecolher: number;
  mesmoEstado: boolean;
  // 'revenda' normalmente NÃO gera DIFAL (a mercadoria sai de novo com
  // ICMS na revenda) — ainda calculamos (é útil ver o número), mas o
  // form deve mostrar um aviso.
  avisoRevenda: boolean;
};

export function calcularDifal(input: DifalInput): DifalResultado {
  const finalidade = input.finalidade ?? 'uso_consumo';
  const destinoInfo = UF_INFO[input.ufDestino];
  const aliquotaInternaDestino =
    input.aliquotaInternaDestino ?? destinoInfo.aliquotaInterna;
  const fcp = input.fcp ?? destinoInfo.fcp;
  const avisoRevenda = finalidade === 'revenda';

  if (input.ufOrigem === input.ufDestino) {
    // Operação interna — não existe alíquota interestadual, logo não há
    // diferencial a recolher.
    return {
      aliquotaInterestadual: 0,
      aliquotaInternaDestino,
      fcp,
      baseOrigem: input.valor,
      icmsOrigem: 0,
      baseDestino: input.valor,
      icmsDestino: 0,
      fcpValor: 0,
      difal: 0,
      totalRecolher: 0,
      mesmoEstado: true,
      avisoRevenda,
    };
  }

  const aliqInter = aliquotaInterestadual(
    input.ufOrigem,
    input.ufDestino,
    input.importado ?? false,
  );

  const baseOrigem = input.valor / (1 - aliqInter / 100);
  const icmsOrigem = baseOrigem * (aliqInter / 100);

  const baseDestino = input.valor / (1 - (aliquotaInternaDestino + fcp) / 100);
  const icmsDestino = baseDestino * (aliquotaInternaDestino / 100);
  const fcpValor = baseDestino * (fcp / 100);

  const difal = icmsDestino - icmsOrigem;

  return {
    aliquotaInterestadual: aliqInter,
    aliquotaInternaDestino,
    fcp,
    baseOrigem,
    icmsOrigem,
    baseDestino,
    icmsDestino,
    fcpValor,
    difal,
    totalRecolher: difal + fcpValor,
    mesmoEstado: false,
    avisoRevenda,
  };
}

export type CenarioInput = {
  ufOrigem: UF;
  // Frete cotado pelo próprio comprador (opcional). Não estimamos frete —
  // não existe fonte pública confiável de tarifa de frete no Brasil pra
  // calcular isso sem inventar número.
  freteInformado?: number;
};

export type CenarioComparado = DifalResultado & {
  ufOrigem: UF;
  freteInformado: number;
  totalComFrete: number;
};

export type CompararOrigensInput = {
  valor: number;
  ufDestino: UF;
  importado?: boolean;
  finalidade?: Finalidade;
  aliquotaInternaDestino?: number;
  fcp?: number;
  cenarios: CenarioInput[];
};

/** Compara o mesmo valor/destino a partir de múltiplas UFs de origem, ordenado por menor custo total (DIFAL + FCP + frete informado). */
export function compararOrigens(
  input: CompararOrigensInput,
): CenarioComparado[] {
  const resultados = input.cenarios.map((cenario) => {
    const resultado = calcularDifal({
      valor: input.valor,
      ufOrigem: cenario.ufOrigem,
      ufDestino: input.ufDestino,
      importado: input.importado,
      finalidade: input.finalidade,
      aliquotaInternaDestino: input.aliquotaInternaDestino,
      fcp: input.fcp,
    });
    const freteInformado = cenario.freteInformado ?? 0;
    return {
      ...resultado,
      ufOrigem: cenario.ufOrigem,
      freteInformado,
      totalComFrete: resultado.totalRecolher + freteInformado,
    };
  });
  return resultados.sort((a, b) => a.totalComFrete - b.totalComFrete);
}
