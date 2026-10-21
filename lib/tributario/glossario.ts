// Glossário de impostos em linguagem de comprador (pedido do dono,
// 2026-10-21: "criar nome para que alguém que não tem experiência na área de
// tributação não fique perdido").
//
// Cada termo tem um nome simples, a sigla que aparece na nota e na proposta,
// o que é em 1 ou 2 frases e onde encontrar. A tela da Análise Tributária usa
// estes textos nos rótulos e nos botões "?"; o Equalizador usa no aviso de
// impostos. Puro: sem servidor. Sem travessão (regra do produto).

export type TermoTributario = {
  id: string;
  /** Nome que o comprador entende. */
  nome: string;
  /** Como aparece na nota fiscal ou na proposta. */
  sigla: string;
  oQueE: string;
  ondeAcho?: string;
};

export const GLOSSARIO: readonly TermoTributario[] = [
  {
    id: 'custo_real',
    nome: 'Custo real da compra',
    sigla: 'Custo líquido',
    oQueE:
      'Quanto a compra custa de verdade para a sua empresa: o que você paga ao fornecedor menos o imposto que volta para a empresa como crédito. É este número que diz qual proposta é mais barata, não o preço da proposta.',
  },
  {
    id: 'credito',
    nome: 'Imposto que volta',
    sigla: 'Crédito de imposto',
    oQueE:
      'Parte do imposto embutido na compra que a sua empresa pode descontar dos impostos que ela mesma paga. Na prática, é dinheiro que volta. Quanto volta depende de como a sua empresa paga impostos e para que serve a compra.',
  },
  {
    id: 'icms',
    nome: 'Imposto estadual sobre a mercadoria',
    sigla: 'ICMS',
    oQueE:
      'Imposto dos estados, cobrado sobre a venda de mercadorias e alguns serviços (transporte, energia, telecom). Normalmente já está dentro do preço. A alíquota varia por estado e por produto (7%, 12%, 18% são comuns).',
    ondeAcho: 'Na proposta ou na nota: "ICMS 12%" ou "ICMS incluso".',
  },
  {
    id: 'icms_st',
    nome: 'Imposto estadual cobrado antecipado',
    sigla: 'ICMS-ST (substituição tributária)',
    oQueE:
      'Em alguns produtos o fornecedor já cobra de você o ICMS do restante da cadeia. Vem como um valor separado, somado ao preço. Em geral não volta como crédito, então pesa no custo.',
    ondeAcho: 'Na proposta ou na nota: "ICMS-ST" ou "ST", em reais.',
  },
  {
    id: 'ipi',
    nome: 'Imposto sobre produto industrializado',
    sigla: 'IPI',
    oQueE:
      'Imposto federal cobrado de quem fabrica ou importa. Vem somado ao preço (por fora). Volta como crédito quando o produto é usado na produção. Será zerado na reforma a partir de 2027, fora da Zona Franca de Manaus.',
    ondeAcho: 'Na proposta: "IPI 5%" ou "+ IPI".',
  },
  {
    id: 'pis_cofins',
    nome: 'Impostos federais sobre o faturamento',
    sigla: 'PIS e Cofins',
    oQueE:
      'Dois impostos federais que a empresa paga sobre o que fatura. Ficam dentro do preço (9,25% no Lucro Real, 3,65% no Lucro Presumido). Só a empresa do Lucro Real recupera como crédito. Serão trocados pela CBS em 2027.',
  },
  {
    id: 'simples',
    nome: 'Pequena empresa com imposto em guia única',
    sigla: 'Simples Nacional (DAS)',
    oQueE:
      'Regime das micro e pequenas empresas: pagam quase todos os impostos numa guia só (o DAS). Por isso a nota delas destaca pouco ou nenhum imposto, e a sua empresa recupera pouco crédito ao comprar delas.',
  },
  {
    id: 'simples_puro',
    nome: 'Pequena empresa que mantém tudo na guia única',
    sigla: 'Simples puro (não optante pelo regime regular do IBS/CBS)',
    oQueE:
      'A partir de 2027 continua recolhendo IBS e CBS dentro do DAS. Para você, o crédito que volta continua pequeno.',
    ondeAcho: 'Consulta do CNPJ no Portal do Simples: "Regime Regular do IBS/CBS: Não optante".',
  },
  {
    id: 'simples_hibrido',
    nome: 'Pequena empresa que cobra IBS e CBS à parte',
    sigla: 'Simples híbrido (optante pelo regime regular do IBS/CBS)',
    oQueE:
      'Continua no Simples, mas a partir de 2027 cobra IBS e CBS separados na nota. Para você, esse imposto volta inteiro como crédito, como numa empresa normal.',
    ondeAcho: 'Consulta do CNPJ no Portal do Simples: "Regime Regular do IBS/CBS: Optante".',
  },
  {
    id: 'lucro_real',
    nome: 'Empresa grande, imposto sobre o lucro de verdade',
    sigla: 'Lucro Real',
    oQueE:
      'Regime obrigatório para empresas com faturamento acima de R$ 78 milhões por ano e opcional para as demais. É o que mais recupera crédito nas compras hoje (ICMS, IPI e PIS/Cofins).',
  },
  {
    id: 'lucro_presumido',
    nome: 'Empresa média, imposto sobre lucro estimado',
    sigla: 'Lucro Presumido',
    oQueE:
      'A Receita presume um lucro em vez de calcular o real. Hoje recupera crédito de ICMS e IPI, mas não de PIS/Cofins. Na reforma passa a recuperar IBS e CBS como o Lucro Real.',
  },
  {
    id: 'regime_comprador',
    nome: 'Como a sua empresa paga imposto',
    sigla: 'Regime tributário',
    oQueE:
      'Lucro Real, Lucro Presumido ou Simples Nacional. Define quanto imposto volta nas compras. Se não souber, pergunte ao contador ou ao financeiro; empresas grandes costumam ser Lucro Real.',
  },
  {
    id: 'cbs',
    nome: 'Novo imposto federal da reforma',
    sigla: 'CBS',
    oQueE:
      'Contribuição sobre Bens e Serviços. Substitui PIS e Cofins a partir de 2027. É cobrada à parte na nota (por fora) e volta como crédito para quase toda compra de empresa que não é do Simples.',
  },
  {
    id: 'ibs',
    nome: 'Novo imposto de estados e municípios',
    sigla: 'IBS',
    oQueE:
      'Imposto sobre Bens e Serviços. Substitui ICMS e ISS aos poucos, de 2029 a 2033. Funciona como a CBS: cobrado à parte e com crédito amplo.',
  },
  {
    id: 'aliquota_reduzida',
    nome: 'Produto com imposto menor na reforma',
    sigla: 'Redução de alíquota do IBS/CBS',
    oQueE:
      'A lei da reforma dá desconto de 30% ou 60% no IBS e na CBS para alguns itens (saúde, educação, alimentos, insumos agropecuários) e zera outros (cesta básica). Se não souber, deixe "alíquota cheia".',
  },
  {
    id: 'destinacao',
    nome: 'Para que serve a compra',
    sigla: 'Destinação',
    oQueE:
      'Muda quanto imposto volta. Revenda e matéria-prima recuperam mais hoje. Material de uso e consumo (limpeza, escritório) não recupera ICMS hoje, mas passa a recuperar IBS e CBS na reforma. Máquinas e equipamentos recuperam ICMS em 48 meses.',
  },
];

const POR_ID = new Map(GLOSSARIO.map((t) => [t.id, t]));

export function termo(id: string): TermoTributario {
  const t = POR_ID.get(id);
  if (!t) throw new Error(`termo tributário desconhecido: ${id}`);
  return t;
}
