# Proc2Pay — plano de implementação (Fase 1 / MVP)

Spec: `docs/superpowers/specs/2026-06-29-proc2pay-design.md`.
Objetivo da fase: **trilho ponta a ponta manual** — da requisição (formulário) ao envio da
PO ao fornecedor, encadeando os assistentes existentes com handoff de contexto automático e
avanço manual entre etapas. Entrada por e-mail e tela de exemplo ficam pra Fase 2 (mas o
modelo de dados já nasce preparado).

## 1. Dados — migration `0042_proc2pay.sql`
- [ ] `proc2pay_processes` (+ RLS owner-only espelhando `sessions`).
- [ ] `proc2pay_stage_runs` (FK cascade, herda RLS via process_id).
- [ ] `proc2pay_approvals`.
- [ ] Seed: nenhum nesta fase (exemplo é Fase 2).
- [ ] Aplicar via `scripts/db_connect.py` (pooler IPv4, us-west-2).

## 2. Config das etapas — `lib/proc2pay/stages.ts`
- [ ] Tipo `Stage = { id, label, executor, mapInput(context), mapOutput(resp): Partial<context> }`.
- [ ] `STAGES` (array ordenado) com as etapas 3,6,7,8,10,11,12,13 do MVP (4,5,9,14,15 stubadas/puláveis).
- [ ] `nextStage(process)` / `canAdvance(process)` puros e testáveis.

## 3. Núcleo dos assistentes reusados (refactor aditivo)
- [ ] Garantir função pura por assistente usada: `kraljic` (`classifyItems` já existe),
      `comprador` (TCO — extrair `(propostas) => equalizacao` se acoplado à rota),
      `rfp` (wrapper `(params) => { output_md, run_id }`), `scoreSuppliers` (já puro).
- [ ] Não alterar as rotas/handlers existentes (aditivo).

## 4. Orquestrador — `lib/proc2pay/orchestrator.ts`
- [ ] `runStage(processId, stageId)`: carrega processo → `mapInput` → executa executor →
      grava `proc2pay_stage_runs` + faz merge da saída no `process.context` →
      `recordApiUsage(metadata.proc2pay_process_id)` → trace span.
- [ ] `viaProc2Pay` flag propagada → pula `canUseAssistant` no handler.
- [ ] Fail-soft por etapa (erro não corrompe o context já consolidado).

## 5. Rotas — `app/api/proc2pay/*`
- [ ] `POST /processes` (gate `isPro`; cria processo a partir do formulário de requisição).
- [ ] `GET /processes` + `GET /processes/[id]`.
- [ ] `POST /processes/[id]/stages/[stage]/run` (executa etapa; owner-gate).
- [ ] `POST /processes/[id]/approve` (decisão 1-aprovador).
- [ ] `POST /processes/[id]/po` (emite + envia PO ao fornecedor; reusa comprador + e-mail).

## 6. UI
- [ ] `/proc2pay` — lista de processos (cards) + estado vazio.
- [ ] `/proc2pay/[id]` — stepper vertical das etapas; por etapa: estado, resumo da saída,
      "Executar etapa" (abre o assistente pré-preenchido), destrava a próxima ao concluir.
- [ ] Aba "Documentos" (artefatos acumulados: RFP .docx, mapa comparativo, PO).
- [ ] Formulário de requisição (entrada manual nesta fase).
- [ ] Registrar no `AssistantToolCTA` + SYSTEM_PROMPT (regra do CLAUDE.md).

## 7. Billing
- [ ] Gate `isPro` na criação do processo.
- [ ] `viaProc2Pay` pulando `canUseAssistant` nas etapas (com teste).

## 8. Observabilidade
- [ ] Trace `proc2pay.process` + span por etapa (`stage:<id>`).

## 9. Testes
- [ ] `stages.ts` (nextStage/canAdvance, mapInput/mapOutput puros).
- [ ] `orchestrator.runStage` (handoff de context, merge, fail-soft).
- [ ] Rotas (gate isPro, owner-gate, approve flow).
- [ ] Quota: etapa via Proc2Pay não consome free lifetime.

## Critério de pronto (Fase 1)
Um comprador Pro consegue: abrir um processo manual → rodar Kraljic → puxar fornecedores
homologados → gerar RFP → equalizar propostas (coladas) → registrar negociação → aprovar →
**emitir e enviar a PO por e-mail ao fornecedor**, tudo amarrado a um número de processo,
com o contexto fluindo automaticamente entre as etapas.
