# ProcurementGPT — Beta Readiness (Milestone 2 escopo)

Plano enxuto para abrir um **beta fechado** (3–5 gestores convidados) com o produto atual, single-tenant, focado em coletar traces no Langfuse para escopar Milestone 3 (B2B) com dados reais. Salvo em 2026-05-03.

> **Princípio**: o caminho para definir Milestone 3 é uso real. Beta hardening + feedback loop é a fase mínima para gerar esse uso sem queimar reputação nem orçamento.

---

## O que já está pronto a favor (não tocar)

- `/admin/users` + Supabase Auth invite (magic link)
- Histórico persistido em DB com RLS owner-only (sub-projetos 6a/6b)
- Langfuse trace por turno, 6 spans, `userId` pseudonimizado, `sessionId` agrupando conversa (sub-projeto 7)
- Eval automatizado com CI gate `recall@5 ≥ 0.85` (sub-projeto 7)

Tecnicamente, é suficiente. O que falta é "não quebrar" + "extrair sinal".

---

## Sub-projetos do Milestone 2

### Sub-projeto 8 — Beta Hardening
**Tag-alvo**: `beta-hardening-complete`
**Justificativa**: proteger orçamento, dar UX decente em falhas, separar tráfego de teste do tráfego real.

Itens:
1. **Rate limiting em `/api/chat`** — limite por `userId` (ex.: 60 msgs/hora, 10 msgs/min burst). Via Upstash Redis + Vercel KV ou via Postgres counter (mais simples; tradeoff de latência aceitável). Resposta 429 com `Retry-After` + UI mostra mensagem amigável "limite por hora atingido, tenta de novo em X min".
2. **Error boundary + toast amigável no `ChatSession`** — capturar `onError` do `useChat`, mostrar toast "tivemos um problema, tenta de novo" + log estruturado no console (e no Langfuse trace via `level=ERROR`).
3. **UX para `recall=0`** — quando o reranker retorna lista vazia ou só com scores baixos (ex.: `top1 < 0.3`), prompt-builder deve injetar uma instrução explícita "responda apenas com 'não tenho fonte sobre isso na base'" em vez de tentar deixar o Gemini decidir. Cobrir com vitest.
4. **Tag `env:beta` nos traces** — ler `NEXT_PUBLIC_APP_ENV` (`beta` | `production` | `local`) e propagar para o `tags` do Langfuse trace. Permite filtrar dashboards.
5. **Smoke test pré-beta** — checklist manual em `docs/product/beta-smoke-test.md`: mobile (drawer), dark mode, sessão expirada (cookie deletado mid-session), tab incognito, refresh durante streaming, cancel button durante streaming.

### Sub-projeto 9 — Feedback Loop
**Tag-alvo**: `feedback-loop-complete`
**Justificativa**: 100 traces sem rating é só latência; 100 traces com rating viram dataset de treino para iteração de prompt/retrieval. É a única coisa que transforma uso em sinal.

Itens:
1. **Migration 0007** — `message_feedback` table (`message_id` UUID, `session_id` FK cascade, `user_id` FK cascade, `rating` enum('up','down'), `comment` text nullable, `created_at`). RLS owner-only (mesmo padrão de `sessions`).
2. **UI 👍/👎 inline** — botões pequenos abaixo de cada `Message` (só assistant, não user). Click → POST `/api/feedback` (Edge). Down opcional abre textarea inline para comentário (opcional, max 1000 chars). Estado otimista no cliente.
3. **`/api/feedback`** route — valida session, escreve em `message_feedback`, **e** chama Langfuse `trace.score()` com `name=user-feedback`, `value=1|-1`, `comment` se houver. Idempotente por `(message_id, user_id)`.
4. **Link "feedback geral" no header** — abre `mailto:` ou Tally form (decisão futura). Para problemas que não cabem em 👎 inline.
5. **vitest** — testes do `/api/feedback` (auth, idempotência, RLS), e do componente de rating (renders, clicks, comment toggle).

---

## Decisões de escopo

- **NÃO incluir no Milestone 2**: status page, truncamento de conversa longa, vídeo onboarding, integrações Slack/Drive. Esses entram em Milestone 3+ (B2B) ou nunca.
- **NÃO mexer em multi-tenancy** — Milestone 2 é deliberadamente single-tenant. Beta usa o mesmo pool de dados que tu hoje, RLS already-owner-only.
- **Citações ainda escondidas** — decisão de 2026-05-02 mantida para o beta. Se um beta tester pedir "de onde veio?", vira input para Milestone 3 sub-projeto 11.
- **Storage/quota da Voyage e Cohere**: rate limit em `/api/chat` é o gate. Não criar quota separada por tier no Milestone 2.

---

## Critério de "beta pronto"

- [ ] sub-projeto 8 mergeado (`beta-hardening-complete`)
- [ ] sub-projeto 9 mergeado (`feedback-loop-complete`)
- [ ] `NEXT_PUBLIC_APP_ENV=beta` configurado no Vercel
- [ ] Domínio próprio apontando (TBD — depende do branding)
- [ ] Checklist de smoke test passa em mobile + dark + sessão expirada
- [ ] Dashboard mínimo no Langfuse: 1) latência p95 por estágio, 2) distribuição de rating 👍/👎, 3) traces tagged `env:beta`
- [ ] 3–5 convidados identificados, e-mails para invite preparados

---

## Critério de saída (para abrir Milestone 3)

Gate quantitativo: **mínimo 100 traces `env:beta` com pelo menos 30 ratings (👍 ou 👎) coletados ao longo de ≥2 semanas** antes de escopar Milestone 3.

Gate qualitativo: ler manualmente os 👎 + comentários e classificar em buckets (retrieval ruim / prompt ruim / produto faltando feature / fora de escopo). Esses buckets viram a backlog priorizada do Milestone 3.

---

## Ordem de execução

1. **Sub-projeto 8 primeiro** (rate limit é bloqueante de orçamento)
2. **Sub-projeto 9 em sequência** (depende do produto estar estável)
3. **Convidar primeiro tester só depois dos dois mergeados**

Tempo estimado: 8 = ~1 dia, 9 = ~1 dia. Total ~2 dias úteis até abrir convite.

---

## Próximo passo concreto

1. Atualizar `CLAUDE.md` declarando "Milestone 2 — Beta Readiness aberto"
2. Criar spec de sub-projeto 8 em `docs/superpowers/specs/2026-05-03-beta-hardening-design.md`
3. `superpowers:brainstorming` → `superpowers:writing-plans` → executar via TDD/subagent-driven

Aguardando aprovação do usuário antes de tocar em código.

---

## Fila pós-beta (capturado durante beta, decidir prioridade depois)

Itens identificados durante a operação do beta que NÃO bloqueiam o convite mas devem entrar antes do Milestone 3 ou em paralelo com ele:

### Sub-projeto 10 — Visibilidade da ingestão em `/admin/articles` (Opção A)
**Capturado em**: 2026-05-04
**Trigger**: precisa olhar quanto da apostila o RAG realmente "viu" antes de explicar misses para os beta testers.

Escopo:
- Listar todos os chunks de um artigo no detail pane (ord, primeiros ~150 chars + "Expandir" via `<details>` HTML nativo).
- Mostrar % de conteúdo absorvido = `sum(chunk.content.length) / source_chars` com nota visual "≈" (overcount por overlap de 400 chars é aceitável neste contexto admin).
- Migration 0009: `articles.source_chars int` populado pela pipeline TS de ingestão (`lib/ingest/pipeline.ts` grava `parsedText.length` ao inserir).
- Backfill script `npm run ingest:backfill-source-chars` que re-parseia cada artigo no Storage para preencher `source_chars` em rows existentes (one-shot, idempotente via `is null` filter).

Decisões já travadas:
- Opção A escolhida (sum-with-overlap, simples). Opções B (offsets exatos) e C (sem %) recusadas.
- Enfileirado para **depois do primeiro convite de beta** — sub-projeto 9 vai pra produção primeiro.

Não-objetivos:
- Não alterar a pipeline de chunking para emitir offsets exatos (Opção B).
- Não expor essa informação ao usuário final do `/chat`.
