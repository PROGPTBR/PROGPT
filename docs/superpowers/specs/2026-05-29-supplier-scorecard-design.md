# Supplier Scorecard — design (Strategic Sourcing, passo 8)

## Contexto

8 assistentes em produção; o ranking esforço×impacto (`docs/product/assistants-ranking.xlsx`) colocou o **Supplier Scorecard** como o #1 a construir (score 1.33, melhor bang-for-buck, alta defensabilidade SRM). O usuário aprovou construir o próximo assistente do ranking.

Dor que resolve: comprador precisa avaliar/ranquear fornecedores de uma categoria por múltiplos critérios ponderados e decidir o que fazer com cada um (manter/desenvolver/sair). Hoje é planilha manual ad-hoc.

Decisões fechadas no brainstorm (2026-05-29):
- **Critérios**: conjunto padrão editável + custom (usuário ajusta pesos, remove, renomeia, adiciona).
- **Classificação**: determinística por faixa de score (não LLM).
- **Escopo v1**: inclui gráfico de ranking **e** import `.xlsx` (além do core: grade manual, export `.xlsx`, `.docx`).

## Arquitetura

Espelha o **arquétipo Kraljic**: `buildAssistantHandler` ([lib/assistants/handler.ts](../../../lib/assistants/handler.ts)) com passo `classify` determinístico + narrativa LLM. Reusa auth, paywall (`canUseAssistant`, free = 1 run lifetime), rate-limit, retrieval híbrido + rerank, trace Langfuse, persistência de run, `mdToDocxBuffer`. Nada de rota custom (negotiation é o outlier; scorecard não precisa).

## Modelo de dados — `lib/assistants/types.ts`

```
ScorecardCriterion  { id: string; label: string; weight: number }   // weights normalizados p/ somar 100
ScorecardSupplier   { name: string; segment?: string; scores: Record<criterionId, number> }  // nota 0–10
ScorecardParams     { scorecardName; period?; criteria: ScorecardCriterion[];
                      suppliers: ScorecardSupplier[]; thresholds: {strategic:70, development:40}; notes? }
ScorecardRequest    { templateId: string; params: ScorecardParams }   // Zod schema
ClassifiedSupplier  = ScorecardSupplier & { weightedScore: number /*0–100*/; rank: number;
                                            band: 'estrategico' | 'desenvolvimento' | 'saida' }
```
- `DEFAULT_SCORECARD_CRITERIA`: Qualidade 25, Prazo de entrega 20, Preço/competitividade 20, Atendimento/relacionamento 15, Inovação 10, ESG/sustentabilidade 10.
- `SCORECARD_BAND_LABELS`: estrategico→"Estratégico (manter/desenvolver parceria)", desenvolvimento→"Desenvolvimento", saida→"Saída/substituição".
- Validação Zod: ≥1 critério, ≥1 fornecedor, notas 0–10, pesos > 0; thresholds 0–100 com strategic > development.

## Scoring determinístico — `lib/assistants/scorecard.ts`

`scoreSuppliers(params): ClassifiedSupplier[]`
1. Normaliza pesos: `w_i / Σw`.
2. `weightedScore = Σ( (nota_i / 10) × pesoNormalizado_i ) × 100` → 0–100, arredondado 1 casa.
3. Ranqueia desc (empate: ordem estável de entrada).
4. Faixa: `≥ thresholds.strategic` → estrategico; `≥ thresholds.development` → desenvolvimento; senão saida.

Puro, sem I/O, totalmente testável (espelha `classifyItems` do Kraljic).

## Narrativa LLM — `buildScorecardPrompt(params, classified, template, chunks, company)`

System prompt: persona sênior SRM (supplier relationship management — Cousins, supplier segmentation). Regras espelham `KRALJIC_SYSTEM_PROMPT`:
- **Classificação é INPUT** — não reclassifica, não discute scoring.
- Por faixa: **Estratégico** = parceria/QBR/co-desenvolvimento/joint roadmap; **Desenvolvimento** = plano de melhoria com metas SMART + cadência; **Saída** = dual-sourcing/substituição/desmobilização com mitigação de risco.
- Profundidade sênior (threshold + ferramenta + cadência), sem citar fontes, markdown limpo.
- User message: bloco do scorecard (critérios+pesos, ranking com score/faixa por fornecedor), empresa do comprador, head do template renderizado, chunks da base, instrução de tarefa (gera comparativo + plano por fornecedor; NÃO recria o gráfico, será inserido como imagem).

## Gráfico — `lib/assistants/scorecard-chart.ts`

`renderScorecardChartPng(classified): Promise<Buffer>` — barras horizontais (fornecedor × weightedScore), ordenado desc, cor por faixa, linhas tracejadas nos thresholds, `@napi-rs/canvas`. Espelha `kraljic-chart.ts` (sem dep nova).

## Import/Export

- **Import** `lib/assistants/scorecard-import.ts`: `parseScorecardXlsx(buffer)` → `{ criteria, suppliers }`. 1ª coluna = nome do fornecedor; colunas seguintes = critérios (cabeçalho casado fuzzy aos labels, coerção pt-BR de número). Padrão de `kraljic-import`/`abc-import`. Endpoint `POST /api/assistants/scorecard/import-xlsx` (MIME + size check, ~5 MB).
- **Export `.xlsx`** `lib/assistants/scorecard-xlsx.ts`: `scorecardToXlsxBuffer(params, classified)` — aba **Scorecard** (matriz fornecedor×critério + peso na header + weightedScore + rank) e aba **Ranking** (ordenado: rank, fornecedor, score, faixa, coluna "Recomendação" = postura determinística por faixa). Plano de ação detalhado (prosa) vive no `.docx`.
- **`.docx`**: reusa `mdToDocxBuffer` (narrativa) + chart embutido. Estender o dispatcher de `app/api/assistants/runs/[id]/chart/route.ts` e o de `runs/[id]/xlsx/route.ts` pra reconhecer `assistant_type === 'scorecard'`.

## Wiring

- `app/api/assistants/scorecard/route.ts`: `buildAssistantHandler<typeof ScorecardRequestSchema, ClassifiedSupplier[]>({ type:'scorecard', requestSchema, classify:{run:scoreSuppliers, spanInput/Output}, buildRetrievalQuery (SRM + scorecardName + segmentos), rerankTopN:6, buildPrompt, generateOp:'assistant-scorecard-generate', annotation, paramsForAssembly })`.
- `AssistantType` += `'scorecard'`.
- `refine-dispatch` += caso `scorecard` (refine da narrativa).
- **Migration 0031** (`00000000000031_scorecard_assistant_type.sql`): `templates_assistant_type_check` += `'scorecard'`; INSERT idempotente do template default (id fixo, `on conflict do nothing`). Fonte do markdown: novo `docs/product/templates/scorecard-padrao.md`.

## UI

- `app/assistants/scorecard/page.tsx` → `ScorecardAssistant.tsx` (wrapper: fetch template, paywall via `handlePaywallResponse`, state machine form→result).
- `ScorecardForm.tsx`: editor de critérios (label + peso, add/remove, aviso se Σ≠100 → normaliza no submit), grade fornecedor×critério (nota 0–10), botão "Importar .xlsx" → `ScorecardImportDialog.tsx`.
- `ScorecardResult.tsx`: tabela de ranking (faixa colorida) + `<img>` do chart + downloads `.xlsx`/`.docx` + refine chat.
- Card "Supplier Scorecard" no `AssistantsHub`.

## Testes (TDD)

vitest, espelhando cobertura do Kraljic:
- `scoreSuppliers`: normalização de pesos (Σ≠100), score 0–100, ranking, faixas nos limites dos thresholds, empate estável, 1 critério/1 fornecedor.
- `parseScorecardXlsx`: cabeçalho fuzzy, célula inválida/vazia, coerção pt-BR.
- `buildScorecardPrompt`: classificação aparece como input; system prompt byte-estável.
- handler route: 402 paywall, 400 template_not_found, shape de sucesso (mock retrieve/rerank).
- `scorecardToXlsxBuffer`: 2 abas, headers corretos.

## Fora de escopo (v2)

- Histórico/versionamento de scorecards do mesmo fornecedor ao longo do tempo.
- Pesos por categoria de fornecedor (segmento) diferentes.
- Importar performance de ERP/integração.

## Verificação end-to-end

1. Aplicar migration 0031 via `scripts/db_connect.py` (pooler us-west-2).
2. `npm run dev` → `/assistants/scorecard`: preencher 3 fornecedores × critérios default → gerar → conferir ranking, faixas, chart, downloads `.xlsx`/`.docx`.
3. Importar um `.xlsx` de exemplo → conferir preenchimento da grade.
4. Free user: 2ª execução → 402 paywall. `vitest` + `typecheck` verdes.
