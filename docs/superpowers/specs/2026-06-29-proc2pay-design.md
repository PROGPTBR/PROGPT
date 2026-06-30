# Proc2Pay — design (orquestrador Source-to-Pay)

## Contexto

O PROGPT tem hoje ~11 assistentes em produção, todos **ilhas isoladas**: o comprador
abre o Kraljic, depois separadamente a Busca de Fornecedores, depois o RFP, depois a
Negociação, e copia/cola contexto de um pro outro na mão. A dor real do comprador não é
a compra em si — é **todo o caminho antes e depois dela** (planejamento da demanda →
requisição → estratégia → cotação → equalização → negociação → PO → entrega → avaliação).

**Proc2Pay** é o módulo orquestrador que liga as ilhas num **fluxo com estado** (máquina
de estados Source-to-Pay): um único "processo de compra" nasce no recebimento da
requisição (por e-mail, em formulário estruturado) e percorre as etapas carregando o
contexto adiante, até a **emissão e envio da PO ao fornecedor**. Cada etapa consome a
saída da anterior e produz a entrada da próxima.

Briefing fechado com o cliente (2B Supply) em 2026-06-29 — áudio WhatsApp transcrito.
Memória: `proc2pay-briefing`.

## Decisões fechadas (2026-06-29)

- **Nome do produto:** **Proc2Pay** (subtítulo técnico: Procure-to-Pay / Source-to-Pay).
- **Entrada por e-mail é obrigatória** no MVP — a requisição da produção chega por e-mail
  e abre o processo automaticamente. **Mas há uma "tela de exemplo"**: um processo-demo
  já populado, navegável sem depender de um e-mail real (onboarding + teste + venda).
- **Aprovação interna = um aprovador só** (sem alçada por valor / multi-nível na v1).
- **Billing:** o Proc2Pay é a feature **Pro**. Os sub-assistentes disparados *dentro* de um
  processo **não contam** no limite free por-assistente — o gate de paywall é a abertura do
  processo, não cada etapa.
- Reusa o **Resend Inbound** já construído no Robô Comprador (PR #152, `lib/email/inbound.ts`).

## Por que NÃO é um `buildAssistantHandler`

Os assistentes atuais (Kraljic, Scorecard, etc.) são **síncronos e stateless**: 1 request →
classify determinístico → narrativa LLM → artefato. O `spend_analysis` já é o primeiro
outlier (pipeline assíncrono com job + polling). O Proc2Pay é um outlier maior: é uma
**máquina de estados de longa duração**, multi-sessão, multi-etapa, com handoff de contexto
entre assistentes. Portanto:

- **Não** usa `buildAssistantHandler`.
- **Reusa** os handlers/funções dos assistentes existentes como "passos" — chamando a
  lógica de cada um com a entrada montada a partir do estado do processo, e gravando a saída
  de volta no processo.
- Tem **modelo de dados próprio** (o processo + as etapas) e **UI própria** (o cockpit).

## Modelo de dados — migration `0042_proc2pay.sql`

```
proc2pay_processes
  id uuid pk default gen_random_uuid()
  user_id uuid not null default auth.uid()           -- owner (RLS owner-only)
  numero text not null                                -- "PC-2026-000123" legível
  titulo text not null                                -- resumo da demanda
  status text not null default 'requisicao'           -- estágio corrente (enum de etapas)
  state text not null default 'em_andamento'          -- em_andamento | concluido | cancelado
  origem text not null default 'email'                -- email | manual | exemplo
  requisicao jsonb not null                           -- payload estruturado da requisição (ver abaixo)
  context jsonb not null default '{}'                 -- acumulador de saídas por etapa (handoff)
  is_example boolean not null default false           -- a "tela de exemplo"
  created_at timestamptz default now()
  updated_at timestamptz default now()

proc2pay_stage_runs                                    -- 1 linha por execução de etapa
  id uuid pk
  process_id uuid fk -> proc2pay_processes on delete cascade
  stage text not null                                  -- requisicao | analise_critica | estrategia | ...
  assistant_run_id uuid null fk -> assistant_runs      -- quando a etapa rodou um assistente existente
  status text not null default 'pendente'              -- pendente | em_andamento | concluido | pulado
  input jsonb                                          -- entrada montada do context
  output jsonb                                         -- saída normalizada (volta pro context)
  artifact_md text null                                -- narrativa/markdown da etapa (se houver)
  created_at, updated_at timestamptz

proc2pay_approvals                                     -- gate do passo 12 (1 aprovador)
  id uuid pk
  process_id uuid fk
  approver_id uuid                                     -- quem aprovou (v1 = o próprio owner ou 1 designado)
  decision text                                        -- aprovado | reprovado
  comment text null
  decided_at timestamptz
```

RLS owner-only em `proc2pay_processes` (espelha `sessions` / `spend_invoices`); as tabelas
filhas herdam via `process_id`. **NÃO** copiar `is_admin()` — é user-scoped.

`requisicao` (JSONB) — o formulário estruturado que vem do e-mail:
```
{ solicitante, centro_de_custo?, categoria?, descricao, itens: [{descricao, qtd, unidade, especificacao?}],
  prazo_desejado?, orcamento_estimado?, criticidade?, anexos?: [{nome, url}] }
```

`context` (JSONB) — acumulador de handoff (cada etapa escreve sua saída-chave aqui):
```
{ estrategia?: { quadrante_kraljic, postura }, fornecedores?: [{nome, cnpj, homologado}],
  rfp_run_id?, propostas?: [...], equalizacao?: { ranking, vencedor }, negociacao?: { acordo },
  po?: { numero, valor, fornecedor, enviada_em } }
```

## Contrato das etapas (o coração do orquestrador)

`lib/proc2pay/stages.ts` — config declarativa: cada etapa define `id`, label, o assistente/
função que executa, o **mapeador de entrada** (lê `context` → monta input do assistente) e o
**mapeador de saída** (resposta do assistente → grava em `context`). Tabela do MVP:

| # | Etapa (status) | Executor | Entrada (de context) | Saída (pro context) | Estado |
|---|----------------|----------|----------------------|---------------------|--------|
| 3 | `requisicao` | formulário / e-mail | — | `requisicao` | 🆕 |
| 4 | `analise_critica` | LLM crítico (novo, `lib/proc2pay/critique.ts`) | `requisicao` | `requisicao.gaps`, ok? | 🆕 |
| 5 | `validacao_escopo` | Perfil de Categoria (reuso) | `requisicao` | `escopo` | 🟡 |
| 6 | `estrategia` | **Kraljic** (`lib/assistants/kraljic.ts`) | `requisicao`, `escopo` | `estrategia` | ✅ |
| 7 | `selecao_fornecedores` | **Busca** + **Homologação** (`lib/fiscal`) | `estrategia`, categoria | `fornecedores[]` | ✅ |
| 8 | `rfq_rfp` | **RFP** (`lib/assistants/rfp.ts`) | `requisicao`, `fornecedores` | `rfp_run_id`, envio | ✅ |
| 9 | `recebimento_propostas` | **Caixa de Cotações** (`comprador-inbox`) | `rfp_run_id` | `propostas[]` | ✅ |
| 10 | `equalizacao` | **Robô Comprador** (`lib/assistants/comprador.ts`, TCO) | `propostas` | `equalizacao` | ✅ |
| 11 | `negociacao` | **Negociação** (`lib/assistants/negotiation`) | `equalizacao.vencedor` | `negociacao` | ✅ |
| 12 | `aprovacao` | gate 1-aprovador (novo) | `equalizacao`, `negociacao` | `aprovacao` | 🆕 |
| 13 | `emissao_po` | **Robô Comprador** PO + e-mail (reuso) | `negociacao`, `fornecedor` | `po` | ✅ |
| 14 | `follow_up` *(opcional)* | tracker (novo, fase 4) | `po` | `entregas[]` | 🆕 |
| 15 | `avaliacao` *(opcional)* | **Scorecard** (`lib/assistants/scorecard.ts`) | fornecedor, `po` | `avaliacao` | ✅ |

Princípio: o orquestrador **nunca** reimplementa um assistente — só adapta entrada/saída. Onde
a função do assistente hoje só existe acoplada à rota HTTP, refatorar para extrair o núcleo
puro (ex.: `scoreSuppliers`, `classifyItems` já são puros; `rfp`/`comprador` podem precisar de
um wrapper que receba params e retorne `{ output_md, run_id }`).

## Entrada por e-mail + tela de exemplo

- Reusa `lib/email/inbound.ts` (Resend Inbound). Novo parser `lib/proc2pay/intake.ts`:
  e-mail recebido → LLM estrutura o corpo no schema `requisicao` (campos + itens) →
  cria `proc2pay_processes` (origem=`email`, status=`requisicao`) → notifica o comprador.
- Endereço dedicado (ex.: `compras+<token>@inbound...`) por usuário/empresa, igual ao
  padrão do Robô Comprador inbound. Config em `settings`.
- **Tela de exemplo:** seed de um processo `is_example=true` com requisição fictícia
  realista (ex.: "10 válvulas de esfera 2'' inox 316") já avançada até a etapa de
  equalização, somente-leitura, com banner "Exemplo — abra um processo real por e-mail".
  Endpoint `POST /api/proc2pay/example` materializa uma cópia editável pro usuário testar.

## Aprovação (passo 12) — 1 aprovador

Gate simples: na etapa `aprovacao`, mostra o resumo (equalização + acordo da negociação +
valor) e o comprador (ou 1 aprovador designado em `settings`) clica **Aprovar/Reprovar** +
comentário. Aprovado → libera `emissao_po`. Reprovado → volta pra `negociacao` ou
`equalizacao` com a justificativa. `proc2pay_approvals` registra a decisão (audit).

## Saída — emissão e envio da PO

Reusa o gerador de PO do Robô Comprador (`lib/assistants/comprador.ts`) + envio por e-mail
ao fornecedor (`lib/email`). A PO referencia o `numero` do processo, o vencedor da
equalização e o acordo da negociação. Grava `context.po` + fecha o processo
(`state='concluido'`) — ou mantém aberto se as etapas 14/15 estiverem ativas.

## UI — cockpit do processo

- `/proc2pay` — lista de processos (cards: número, título, etapa atual, status) + botão
  "Ver exemplo".
- `/proc2pay/[id]` — **stepper vertical das 15 etapas** (com 2–13 ativas no MVP): cada etapa
  mostra estado (pendente/feito/pulado), a saída resumida, e botão "Executar etapa" que abre
  o assistente correspondente **pré-preenchido** com o contexto. Ao concluir, a saída volta
  pro processo e a próxima etapa destrava.
- Artefatos (.docx do RFP, mapa comparativo, PO) acumulam numa aba "Documentos" do processo.

## Billing / paywall

- Abrir um processo Proc2Pay exige Pro (`isPro`) — gate em `POST /api/proc2pay/processes`.
- Os sub-assistentes rodados via etapa **não** chamam `canUseAssistant` (não consomem o free
  lifetime); recebem uma flag `viaProc2Pay` que pula o gate. Documentar no `handler.ts`.
- `recordApiUsage` continua instrumentando cada chamada LLM (custo real visível em /admin/costs),
  com `metadata.proc2pay_process_id` pra rastrear custo por processo.

## Observabilidade

Trace Langfuse `proc2pay.process` por processo, com 1 span por etapa executada. Tag
`stage:<id>`. Permite ver onde os processos travam (funil de etapas).

## Faseamento

1. **Fase 1 — MVP / trilho ponta a ponta (manual):** modelo de dados (0042), stepper UI,
   config de etapas, e o encadeamento **requisição(form) → Kraljic → Busca/Homologação →
   RFP → equalização (Robô Comprador) → negociação → aprovação(1) → PO+e-mail**, com avanço
   manual entre etapas e handoff de contexto automático. Caixa de Cotações (etapa 9) entra
   se o tempo permitir; senão a proposta é colada manualmente na fase 1.
2. **Fase 2 — entrada por e-mail obrigatória + tela de exemplo:** `lib/proc2pay/intake.ts`
   (Resend Inbound + estruturação LLM) abre o processo sozinho; seed do processo-exemplo.
3. **Fase 3 — elos novos refinados:** análise crítica da requisição (4) + validação de
   escopo (5) como etapas LLM dedicadas; aprovação com aprovador designado.
4. **Fase 4 — cauda opcional:** follow-up de entrega (14) + avaliação consolidada via
   Scorecard (15) numa aba.

## Riscos / pontos de atenção

- **Extração do núcleo dos assistentes acoplados à rota** (RFP, comprador): pode exigir
  refactor aditivo pra expor função pura `(params) => { output_md, run_id }`. Não quebrar as
  rotas existentes.
- **Numeração de migration:** próxima livre = **0042** (já há 2 arquivos `0036_*` duplicados
  no histórico — não repetir número).
- **Custo por processo:** um processo roda vários LLMs (Kraljic + RFP + equalização +
  negociação). Monitorar via `metadata.proc2pay_process_id`. Pode justificar um tier/preço
  específico no futuro.
- **CTA do chat:** registrar o Proc2Pay no `AssistantToolCTA` + SYSTEM_PROMPT como os outros
  (regra do CLAUDE.md — senão o chat não sugere).
- **Não** tratar como assistente do `buildAssistantHandler` (ver seção acima).
