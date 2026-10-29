// Módulos que o super admin pode ligar ou desligar por empresa (org)
// (pedido do diretor, 2026-10-20: "personalizar os agentes de acordo com a
// empresa, selecionar ou não selecionar módulos").
//
// Puro e sem dependência de servidor: usado no middleware, nas rotas, no
// console /plataforma e nos menus do navegador.
//
// A empresa guarda só a lista dos DESLIGADOS (orgs.org_settings
// .modulos_desativados). Módulo novo nasce ligado para todo mundo.
// O id é o mesmo usado no hub (assistants-data.ts), no card do chat
// (assistant-tool-cta-shared.ts) e em assistant_runs.assistant_type, então
// um id serve para esconder o card, o atalho e bloquear a rota.

export type ModuloGrupo = 'assistentes' | 'plataforma';

export type Modulo = {
  id: string;
  rotulo: string;
  grupo: ModuloGrupo;
  /** Caminhos de tela que pertencem ao módulo (prefixo, com fronteira em "/"). */
  caminhos: readonly string[];
};

export const MODULOS: readonly Modulo[] = [
  // Plataforma
  { id: 'painel', rotulo: 'Painel', grupo: 'plataforma', caminhos: ['/painel'] },
  { id: 'fluxo_compras', rotulo: 'Fluxo de Compras', grupo: 'plataforma', caminhos: ['/fluxo'] },
  { id: 'dashboard', rotulo: 'Dashboards personalizados', grupo: 'plataforma', caminhos: ['/dashboard'] },
  { id: 'fornecedores', rotulo: 'Bases de fornecedores e materiais', grupo: 'plataforma', caminhos: ['/fornecedores'] },
  { id: 'prompts', rotulo: 'Biblioteca de Prompts', grupo: 'plataforma', caminhos: ['/prompts'] },
  { id: 'proc2pay', rotulo: 'Proc2Pay', grupo: 'plataforma', caminhos: ['/proc2pay'] },
  { id: 'gestao_obras', rotulo: 'Gestão de Obras', grupo: 'plataforma', caminhos: ['/gestao-obras'] },
  { id: 'obras_materiais', rotulo: 'Obras & Materiais', grupo: 'plataforma', caminhos: ['/obras-materiais'] },
  { id: 'gestao_demandas', rotulo: 'Gestão de Demandas', grupo: 'plataforma', caminhos: ['/gestao-demandas'] },
  // Assistentes
  { id: 'abc', rotulo: 'Análise ABC', grupo: 'assistentes', caminhos: ['/assistants/abc'] },
  { id: 'spend_analysis', rotulo: 'Análise de Gastos', grupo: 'assistentes', caminhos: ['/assistants/spend_analysis'] },
  { id: 'porter', rotulo: 'Porter', grupo: 'assistentes', caminhos: ['/assistants/porter'] },
  { id: 'suppliers', rotulo: 'Busca de Fornecedores', grupo: 'assistentes', caminhos: ['/assistants/suppliers'] },
  { id: 'mapa_fornecedores', rotulo: 'Mapa de Fornecedores da Operação', grupo: 'assistentes', caminhos: ['/assistants/mapa_fornecedores'] },
  { id: 'kraljic', rotulo: 'Kraljic', grupo: 'assistentes', caminhos: ['/assistants/kraljic'] },
  { id: 'rfp', rotulo: 'RFP', grupo: 'assistentes', caminhos: ['/assistants/rfp'] },
  { id: 'comprador', rotulo: 'Equalizador de Propostas', grupo: 'assistentes', caminhos: ['/assistants/comprador'] },
  { id: 'tributario_propostas', rotulo: 'Análise Tributária de Propostas', grupo: 'assistentes', caminhos: ['/assistants/tributario_propostas'] },
  { id: 'negotiation', rotulo: 'Negociação', grupo: 'assistentes', caminhos: ['/assistants/negotiation'] },
  { id: 'financial', rotulo: 'Análise Financeira', grupo: 'assistentes', caminhos: ['/assistants/financial'] },
  { id: 'scorecard', rotulo: 'Scorecard de Fornecedores', grupo: 'assistentes', caminhos: ['/assistants/scorecard'] },
  { id: 'homologacao', rotulo: 'Homologação de Fornecedor', grupo: 'assistentes', caminhos: ['/assistants/homologacao'] },
  { id: 'pesquisa_precos', rotulo: 'Pesquisa de Preços', grupo: 'assistentes', caminhos: ['/assistants/pesquisa_precos'] },
  { id: 'indicadores', rotulo: 'Indicadores Econômicos', grupo: 'assistentes', caminhos: ['/assistants/indicadores'] },
  { id: 'diagnostico_aquisicao', rotulo: 'Diagnóstico de Aquisição', grupo: 'assistentes', caminhos: ['/assistants/diagnostico_aquisicao'] },
  { id: 'profile', rotulo: 'Perfil de Categoria', grupo: 'assistentes', caminhos: ['/assistants/profile'] },
  { id: 'grafico_rapido', rotulo: 'Gráfico Rápido', grupo: 'assistentes', caminhos: ['/assistants/graficos'] },
  { id: 'simulador_tributario', rotulo: 'Simulador Tributário', grupo: 'assistentes', caminhos: ['/simulador'] },
  { id: 'simulador_logistico', rotulo: 'Simulador Logístico', grupo: 'assistentes', caminhos: ['/simulador-logistico'] },
];

export const MODULO_IDS: ReadonlySet<string> = new Set(MODULOS.map((m) => m.id));

const porCaminho = MODULOS.flatMap((m) => m.caminhos.map((c) => ({ c, id: m.id }))).sort(
  (a, b) => b.c.length - a.c.length,
);

/** Módulo dono de uma tela, ou null. "/simulador-logistico" não cai em "/simulador". */
export function moduloDoCaminho(pathname: string): string | null {
  for (const { c, id } of porCaminho) {
    if (pathname === c || pathname.startsWith(`${c}/`)) return id;
  }
  return null;
}

/** Módulo dono de um href de menu/link (ignora query e hash). */
export function moduloDoHref(href: string): string | null {
  return moduloDoCaminho(href.split(/[?#]/)[0] ?? href);
}

/** Lê a lista de desligados de org_settings, descartando ids desconhecidos. */
export function lerDesativados(orgSettings: unknown): string[] {
  const v = (orgSettings as { modulos_desativados?: unknown } | null)?.modulos_desativados;
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((x): x is string => typeof x === 'string' && MODULO_IDS.has(x)))];
}

export function rotuloDoModulo(id: string): string {
  return MODULOS.find((m) => m.id === id)?.rotulo ?? id;
}
