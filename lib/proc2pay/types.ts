// Proc2Pay — tipos do orquestrador Source-to-Pay.
// Spec: docs/superpowers/specs/2026-06-29-proc2pay-design.md

// --- Etapas -----------------------------------------------------------------

export type StageId =
  | 'requisicao'              // 3 (+2 entrada)
  | 'analise_critica'         // 4
  | 'validacao_escopo'        // 5
  | 'estrategia'              // 6
  | 'selecao_fornecedores'    // 7
  | 'rfq_rfp'                 // 8
  | 'recebimento_propostas'   // 9
  | 'equalizacao'             // 10
  | 'negociacao'              // 11
  | 'aprovacao'               // 12
  | 'emissao_po'              // 13
  | 'follow_up'               // 14 (opcional)
  | 'avaliacao';              // 15 (opcional)

// Quem executa a etapa. O orquestrador (lib/proc2pay/orchestrator.ts) resolve
// `assistant`/`llm` para a função real; aqui fica só a referência declarativa.
export type StageExecutor =
  | { kind: 'form' }                              // entrada do usuário (requisição)
  | { kind: 'llm'; ref: string }                  // etapa LLM dedicada (crítica, escopo)
  | { kind: 'assistant'; assistant: AssistantRef } // reusa assistente existente
  | { kind: 'approval' }                          // gate de 1 aprovador
  | { kind: 'po' };                               // emite + envia PO

export type AssistantRef =
  | 'kraljic'
  | 'suppliers'      // busca + homologação
  | 'rfp'
  | 'comprador-inbox'
  | 'comprador'      // equalização / TCO
  | 'negotiation'
  | 'scorecard';

export type Stage = {
  id: StageId;
  num: number;                          // numeração do cliente (2..15)
  label: string;
  executor: StageExecutor;
  produces: keyof Proc2PayContext | null; // chave que grava no context ao concluir
  optional: boolean;                    // 14/15 não bloqueiam o trilho
  mvp: boolean;                         // ativo na Fase 1
};

// --- Contexto (acumulador de handoff entre etapas) --------------------------

export type RequisicaoItem = {
  descricao: string;
  qtd: number;
  unidade: string;
  especificacao?: string;
};

export type RequisicaoPayload = {
  solicitante: string;
  centroDeCusto?: string;
  categoria?: string;
  descricao: string;
  itens: RequisicaoItem[];
  prazoDesejado?: string;
  orcamentoEstimado?: number;
  criticidade?: 'baixa' | 'media' | 'alta';
};

export type FornecedorRef = {
  nome: string;
  cnpj?: string;
  email?: string;
  homologado?: boolean;
};

// Cada etapa escreve sua saída-chave aqui. Tudo opcional — o trilho preenche
// incrementalmente.
export type Proc2PayContext = {
  requisicao?: RequisicaoPayload;
  analise_critica?: { ok: boolean; gaps: string[] };
  escopo?: { resumo: string; criterios?: string[] };
  estrategia?: { quadranteKraljic?: string; postura?: string; runId?: string };
  fornecedores?: FornecedorRef[];
  rfp?: { runId?: string; enviadoEm?: string };
  propostas?: Array<Record<string, unknown>>;
  equalizacao?: { ranking?: Array<Record<string, unknown>>; vencedor?: FornecedorRef; runId?: string };
  negociacao?: { acordo?: string; valorFinal?: number; runId?: string };
  aprovacao?: { decision: 'aprovado' | 'reprovado'; comment?: string };
  po?: { numero: string; valor?: number; fornecedor: FornecedorRef; enviadaEm?: string };
  entregas?: Array<Record<string, unknown>>;
  avaliacao?: { runId?: string; score?: number };
};

// --- Linhas do banco --------------------------------------------------------

export type ProcessState = 'em_andamento' | 'concluido' | 'cancelado';
export type ProcessOrigem = 'email' | 'manual' | 'exemplo';

export type Proc2PayProcess = {
  id: string;
  user_id: string;
  numero: string;
  titulo: string;
  status: StageId;
  state: ProcessState;
  origem: ProcessOrigem;
  requisicao: RequisicaoPayload | Record<string, never>;
  context: Proc2PayContext;
  is_example: boolean;
  created_at: string;
  updated_at: string;
};

export type StageRunStatus =
  | 'pendente'
  | 'em_andamento'
  | 'concluido'
  | 'pulado'
  | 'erro';

export type Proc2PayStageRun = {
  id: string;
  process_id: string;
  user_id: string;
  stage: StageId;
  assistant_run_id: string | null;
  status: StageRunStatus;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  artifact_md: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type Proc2PayApproval = {
  id: string;
  process_id: string;
  user_id: string;
  approver_id: string | null;
  decision: 'aprovado' | 'reprovado';
  comment: string | null;
  decided_at: string;
};
