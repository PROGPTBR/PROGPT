// Tipos das respostas do mcp-fiscal-brasil (serviço REST FastAPI).
// Derivados do spike — ver docs/product/fiscal-api-contract.md.
// Campos dos endpoints agênticos são ASCII limpos (Pydantic → JSON direto).

export type RiskLevel = 'baixo' | 'medio' | 'alto' | 'critico';

export type SupplierRecommendation =
  | 'aprovar'
  | 'aprovar_com_ressalvas'
  | 'investigar'
  | 'recusar';

// GET /v1/agentic/supplier/{cnpj}
export type SupplierRiskScore = {
  cnpj: string;
  razao_social: string;
  risco: RiskLevel;
  score: number; // 0-100
  fatores: string[];
  recomendacao: SupplierRecommendation;
  data_analise: string; // ISO date
};

export type ComplianceCategoria =
  | 'situacao_cadastral'
  | 'regime_tributario'
  | 'atividade'
  | 'endereco'
  | 'certidoes'
  | 'qsa';

export type ComplianceFinding = {
  categoria: ComplianceCategoria;
  severidade: RiskLevel;
  titulo: string;
  detalhe: string;
  // O serviço omite a chave quando não há recomendação (visto no smoke-test).
  recomendacao?: string | null;
};

// GET /v1/agentic/compliance/{cnpj}
export type ComplianceReport = {
  cnpj: string;
  razao_social: string;
  risco_geral: RiskLevel;
  score: number; // 0-100
  achados: ComplianceFinding[];
  resumo_executivo: string;
  fontes_consultadas: string[];
};

export type TaxRegime =
  | 'simples_nacional'
  | 'lucro_presumido'
  | 'lucro_real'
  | 'mei';

export type TaxRegimeOption = {
  regime: TaxRegime;
  aplicavel: boolean;
  motivo_inaplicavel: string | null;
  aliquota_efetiva_estimada: number | null;
  imposto_anual_estimado: number | null;
  pros: string[];
  contras: string[];
};

// GET /v1/agentic/regimes
export type TaxRegimeComparison = {
  cenario_faturamento_anual: number;
  cenario_setor: 'comércio' | 'serviços' | 'indústria';
  folha_pagamento_anual: number | null;
  opcoes: TaxRegimeOption[];
  melhor_opcao: TaxRegime;
  economia_anual_vs_pior: number;
  observacoes: string;
};

// GET /v1/cnpj/{cnpj} — consumimos só o subconjunto top-level seguro
// (campos aninhados de atividade têm chaves acentuadas; evitamos).
export type CnpjData = {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  situacao_cadastral: string;
  data_situacao_cadastral: string | null;
  natureza_juridica: string;
  porte: string | null;
  capital_social: number | null;
  simples_nacional: boolean | null;
  mei: boolean | null;
};

export type CompareRegimesInput = {
  faturamentoAnual: number;
  setor: 'comércio' | 'serviços' | 'indústria';
  folhaPagamentoAnual?: number;
};
