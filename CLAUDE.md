# Projeto: ProcurementGPT — Especialista em Teorias de Compras

## Contexto
Chatbot especialista treinado em centenas de artigos sobre teorias, frameworks e práticas
de procurement. Empresa proprietária do produto **a definir** (não usar IAgentics — referência
removida em 2026-05-02). Audiência: gestores de compras brasileiros (PT-BR primário, EN secundário).

## Stack obrigatória
- Next.js 14 App Router + TypeScript strict
- Tailwind + shadcn/ui (tema light/dark via `next-themes`)
- Supabase (Postgres + pgvector + Auth + Storage)
- OpenAI SDK (`openai` v6) — `gpt-4o-mini` (default) para classificador, condenser, follow-ups, e o `parsePdfMultimodal` (Responses API com `input_file` PDF base64; >20 MB usa Files API). Toda a stack LLM passou para OpenAI em 2026-05-08 (Gemini removido)
- Vercel AI SDK (`ai` v4 + `@ai-sdk/openai`) — para o streaming SSE do endpoint de chat
- Voyage AI para embeddings (`voyage-3-large`, 1024 dims)
- Cohere Rerank 3 para reranking
- Langfuse para observabilidade (sub-projeto 7)
- **Deploy em Railway** (decisão 2026-05-04). Roda Next.js como processo long-lived (não serverless), então `maxDuration` exports são no-op e o padrão fire-and-forget de `/api/admin/ingest/run/[jobId]` fica naturalmente mais robusto que em Vercel — sem timeout de função nem morte súbita após response.

## Princípios não-negociáveis
1. **Retrieval híbrido obrigatório** — vetorial + lexical (FTS portuguese) + RRF + Cohere rerank, nunca só cosine
2. **Resposta fundamentada na base** — o contexto recuperado é injetado no prompt para fundamentar a resposta; o modelo NÃO menciona fontes, IDs, ou números entre colchetes para o usuário (decisão 2026-05-02). Sem fonte na base, dizer explicitamente "não tenho fonte sobre isso"
3. **Streaming SSE** — resposta começa a aparecer em <3s
4. **Node runtime em `/api/chat`** (era Edge até sub-projeto 6; trocou em sub-projeto 7 porque a SDK do Langfuse usa APIs Node — `crypto`, `fs` — que falham silenciosamente no Edge e perdem traces). Outras rotas Edge quando possível; ingestão Python em Node.
5. **LGPD compliance** — logs sem PII, opt-in para histórico (sub-projeto 6); Langfuse usa Supabase UUID pseudonimizado como `userId`, nunca email
6. **Custos sob controle** — cache de embeddings, `gpt-4o-mini` (OpenAI) para todas as chamadas LLM (chat, classifier, condenser, follow-ups, multimodal PDF parser)
7. **Observabilidade obrigatória** — `/api/chat` abre uma Langfuse trace por turno; cada estágio do RAG é um span. Sem isto, retrieval e prompt iteram às cegas

## Status — sub-projetos completos

| # | Tag | Entrega |
|---|---|---|
| 1 | `fundacao-complete` | Schema (`articles`, `chunks` com `vector(1024)` + `tsv` portuguese FTS), wrappers Node (gemini, voyage, cohere, supabase), `/api/health` Edge route, theme provider, env loader |
| 2 | `ingestao-complete` | `scripts/ingest.py` CLI: discover → parse (unstructured) → hybrid chunk → metadata (title/author/lang/date) → SHA-256 idempotência → Voyage embed → psycopg insert. `--dry-run`, `--force`, `--cache`. 23 pytest. Migration 0001 (`articles_content_hash_idx`) |
| 3 | `retrieval-complete` | `runRag(query) → { classification, sources, system, user, debug }`. classifier (Gemini Flash JSON) + retriever (vector RPC + FTS RPC + RRF) + reranker (Cohere) + prompt-builder + condenser. CLI `rag:query`, eval `rag:eval` (recall@5=1.00 inicial). Migration 0002 (RPCs `match_chunks`, `search_chunks_fts`) |
| 4 | `chat-complete` | `POST /api/chat` Edge SSE via Vercel AI SDK + `@ai-sdk/google`. Stateless. Multi-turn condenser. Sources annotation no stream (não exibida no UI) |
| 5 | `chat-ui-complete` | `/chat` SPA cliente: split-pane sidebar + ChatRoot/ChatSession (key remount), markdown rendering, theme toggle (system/light/dark), mobile drawer, hero + 4 suggestion cards, Composer (Enter sends, Stop button) |
| 6a | `auth-rls-complete` | Supabase Auth (email/senha + Google OAuth — invite-only no v1, self-service público com Turnstile no sub-projeto 25). `middleware.ts` gates `/chat` + `/admin`. Páginas: `/login`, `/forgot-password`, `/reset-password`, `/auth/callback`. `lib/auth.ts` (getCurrentUser/requireUser/getProfile). `UserRow` no rodapé do sidebar. Migration 0003 (`profiles` + RLS + `is_admin()` + trigger) |
| 6b | `conversation-persistence-complete` | DB-only conversation history (localStorage retired for authed). `useChatSessionsRemote` drop-in for `useChatSessions`. Migration 0004 (`sessions` table com 4 RLS owner-only policies, FK cascade para LGPD erasure mecânica) |
| 6c | `admin-ui-complete` | `/admin` (sidebar + sub-routes `/admin/{users,articles,ingest}`) gated por `requireAdmin()` → 404 (não 403) para non-admins. Port TS da pipeline de ingest (`pdf-parse@1.1.1` + `mammoth` + chunker/metadata/parser/pipeline) roda como Node route via fire-and-forget + 2s polling, sobrevive ao fechamento da aba. Migration 0005: `ingestion_jobs` + RLS, `profiles_with_email` view, `admin_user_session_counts()` RPC, `profiles_admin_update`/`articles_admin_delete` policies. Storage bucket `ingest-uploads` com policy admin-only path-scoped. Auto-cleanup de jobs `done` > 7d inline no `/jobs`. UserRow mostra link "Admin" só para admins |
| 7 | `langfuse-eval-complete` | Langfuse instrumentation em `/api/chat` (Edge): trace `chat.turn` por turno com 6 spans aninhados (condense, classify, retrieve, rerank, build-prompt, generate), `userId` = Supabase UUID, `sessionId` = sessions.id, flush em onFinish/error/abort. Wrapper `lib/observability/langfuse.ts` com no-op fallback quando keys ausentes. Eval expandido para 25 pares (5 ângulos × 4 artigos + 2 smalltalk + 3 comparison) com batched embed (1 chamada Voyage para todas as queries). CI workflow GitHub Actions roda typecheck + vitest + pytest + rag:eval em PR + push para main, falha se `recall@5 < 0.85`. Eval traces tagged `env:ci` agrupados em sessão por commit. Baseline atual: recall@5 = 1.00 (18/18 scoreable na corpus de 4 artigos). |
| 8 | `beta-hardening-complete` | Per-user rate limit em `/api/chat` (10/min, 60/h) via Postgres RPC `check_rate_limit` + tabela `rate_limit_events` (migration 0007, RLS sem policies, RPC security definer com cleanup probabilístico). Auth obrigatório em `/api/chat` (401 sem cookie). Threshold `MIN_RELEVANCE = 0.10` no reranker — chunks abaixo são descartados, prompt-builder cai no `REFUSAL_INSTRUCTION`. Tag dinâmica `env:${APP_ENV}` no trace (default `production`). Span `rerank` ganha `top1Score`; trace ganha tag `low-confidence` quando threshold zera tudo. `sonner` Toaster no root layout; `ChatSession` mostra toast amigável em 429 (lê `retry_after_secs`) e 500. `ChatErrorBoundary` envolvendo `<ChatSession/>`. Checklist manual em `docs/product/beta-smoke-test.md`. |
| 9 | `feedback-loop-complete` | 👍/👎 inline em cada resposta do assistant via `<MessageActions/>` (lucide ThumbsUp/ThumbsDown), 👎 expande textarea inline para comentário (≤1000 chars). Migration 0008: `message_feedback` + 4 RLS owner-only policies + `unique(user_id, trace_id)` para upsert flip. `Trace.id` exposto pelo wrapper Langfuse (real ou `crypto.randomUUID()` em no-op). `/api/chat` adiciona `traceId` à message annotation; client passa de volta em `POST /api/feedback` (Node, zod-validated, 401/400/404/500/204). `lib/feedback.recordFeedback` UPSERTa + chama `scoreTrace` fire-and-forget (`name: user-feedback`, `value: 1` ou `-1`). `useChatSessionsRemote` hidrata `ratings: Map<traceId, rating>` ao trocar sessão. Header ganha link mailto "Feedback geral" (hardcoded até decidir branding). |
| 10 | `admin-chunks-visibility-complete` | `/admin/articles` detail pane lista TODOS os chunks por artigo (sem `limit(20)`) e mostra "N chunks · ≈X% absorvido" no header. % = `sum(chunk.content.length) / source_chars`; pode exceder 100% por causa do overlap de 400 chars (prefix `≈` deixa explícito). Migration 0009 adiciona `articles.source_chars int NOT NULL` com backfill inline (`length(raw_md)`). Pipeline grava `source_chars: parsed.text.length` no insert do artigo. Chunks renderizam como `<details>` HTML nativo (sem dep nova; expand/collapse com a11y de browser). |
| 11 | `followup-questions-complete` | `/api/chat` estende `onFinish` com `suggestFollowups` (Gemini Flash Lite, JSON via zod, abort 3s, fail-soft → `[]`). Dois modos por `chunks.length`: **deepen** (system prompt PT/EN ancorado em títulos + snippets de 240 chars) e **redirect** (PT/EN — sugere reformulações para tópicos conhecidos de procurement; sem material no prompt). Span `suggest-followups` aninhado em `chat.turn` (`level:WARNING` em erro). Tag de trace `followups:empty` quando array sai vazio. Annotation `{ followups: string[] }` no SSE; `MessageList` lê via `pickFollowups`. `<FollowupChips/>` (button row, a11y, theme-aware) renderiza só na **última** mensagem do assistant da sessão (não persistido em `sessions.messages`). Click invoca `useChat.append({ role:'user', content })`, virando turno normal (rate-limit per-user já cobre). Skip do passo se `finishReason !== 'stop'` ou `text.length < 20`. `RagResult` agora expõe `chunks: RetrievedChunk[]` (refactor aditivo). |
| 12 | `multimodal-ingestion-complete` | Ingestão PDF agora via Gemini multimodal nativo (1 chamada por artigo, ~$0.02). `lib/ingest/multimodal-parse.ts` com zod schema + retry 1x + AbortController 120s; >20MB usa Files API (`ai.files.upload`). `lib/ingest/parse-source.ts` orquestra dispatch (PDF→multimodal-com-fallback, DOCX→tables-aware, TXT→trivial). Chunker ganha `chunkBlocks` que emite 1 chunk por table/figure (sem split mesmo >3200) e agrupa text contíguo. `chunks.metadata` ganha `kind`/`page`/`caption`/`figureKind` (sem migration — JSONB). `articles.metadata.parser` registra `multimodal`/`text-only-fallback`/`docx-tables`/`text-only`. `/admin/articles` mostra badge colorido por kind + número de página. Eval +5 pares (tabelas Kraljic, fluxos S2P/stakeholders, gráfico spend); CI gate `recall@5 ≥ 0.85` mantido sobre 30 pares (verificação após backfill manual dos 4 artigos atuais). |
| 13 | `auto-classified-library-complete` | Pipeline chama `classifyContent` (gpt-4o-mini, fail-soft, abort 15s) após dedup-check pra produzir `{ title, theme, summary }` baseados no conteúdo. Migration 0010 adiciona `articles.theme` (CHECK constraint nos 11 valores) + `articles.summary`. `lib/ingest/taxonomy.ts` é a fonte única da verdade pra os temas. `/admin/articles` ganha sidebar de temas (180px) com contagem; detail pane ganha edição inline de título (✎) + dropdown de tema; PATCH `/api/admin/articles/[id]` valida com zod. Script `npm run articles:reclassify` re-classifica todos os artigos via `articles.raw_md` (sem re-upload). Backfill de 21 artigos rodou com 0 fallbacks; distribuição 9/11 temas. `golden.json` realinhado com novos títulos canônicos pós-backfill (recall@5=0.97, 28/29 hits). |
| 14 | `feedback-review-loop-complete` | Página `/admin/feedback` lê `message_feedback` (sub-projeto 9) via service-role e lista 👍/👎 com filtros (rating, resolvido, has-comment, date range). Migration 0011 adiciona `resolved_at timestamptz` + index parcial + SQL function `admin_top_queries`. Detail pane extrai pergunta+resposta+chunks de `sessions.messages` JSONB via match `annotations[].traceId === feedback.trace_id` (fallback: último assistant message da sessão). Painel `<TopQueries>` mostra top 10 user queries dos últimos 30 dias. PATCH endpoint `/api/admin/feedback/[id]/resolve` flipa `resolved_at`. Sem ML — constrói o dataset humano-curado pra Tier 2/3 futuro de aprendizado. |
| 15 | `prompt-senior-expertise-complete` | `lib/rag/prompt-builder.ts` reescrito pra exigir profundidade de expert sênior em vez de "B-grade textbook answer". Regras explícitas: (a) autoria+ano na resposta direta para frameworks canônicos (Kraljic+HBR 1983, Porter 1979, Ellram 1993, Cox 1996, Williamson 1985), (b) cobertura completa quando o framework tem N elementos (todos os 4 quadrantes Kraljic, todas as 5 forças Porter, 7 etapas Monczka), (c) "aplicação prática" exige threshold + ferramenta + cadência + armadilha (mata "mapeie suas categorias"), (d) 4ª seção opcional "Limitações ou evolução" (Gelderman & Van Weele 2003 extensão Kraljic, crítica do Cox), (e) markdown estruturado para frameworks 2D (tabela/bullets com **bold**), nunca enumerações enterradas em prosa. Reference block reescrito com autoria explícita inline + estratégias canônicas dos 4 quadrantes Kraljic. SYSTEM_PROMPT mantém byte-stability (PT/EN, empty/non-empty chunks) — OpenAI prefix cache intacto. +7 vitest novos garantem regras de regressão. |
| 16 | `open-taxonomy-complete` | Taxonomia aberta com curadoria admin. Migration 0012 dropa o CHECK constraint dos 11 temas fixos e adiciona `articles.theme_status text` (`'canonical' | 'candidate'`, default `canonical`) + length CHECK 1–50. `lib/ingest/taxonomy.ts`: `CANONICAL_THEMES` (renomeado de `TAXONOMY`, alias mantido), `isCanonicalTheme`, `normalizeCandidateTheme` (trim/collapse/strip-quotes; SEM truncate). `lib/ingest/classify-content.ts`: prompt instrui o LLM a propor novo tema (1-4 palavras, Title Case PT) quando nenhuma canônica encaixa — `Outros` vira último recurso. Retorna `{ theme, themeStatus }` para o pipeline. `PATCH /api/admin/articles/[id]` aceita qualquer string ≤50 chars e deriva `theme_status` server-side (admin não pode forjar canonicidade). Novo endpoint `POST /api/admin/themes/promote` faz bulk-promote de candidato → canônico em todos os artigos com aquele tema. UI: `ThemeSidebar` separa canônicos da seção "Candidatos · IA propôs" (amber); `ArticleDetail` mostra badge "candidato" + botão "Promover a canônico"; dropdown de tema expõe canônicas + o tema atual mesmo se candidato. CANONICAL_THEMES constant não muda na promoção (DB-only flip) — admin promove ao constant via PR quando tema estabilizar. |
| 17 | `themes-admin-complete` | Tela dedicada `/admin/themes` para curadoria completa da taxonomia: lista todos os temas com contagem + status (canônico/candidato), badge "no constant" pros temas que vivem em `CANONICAL_THEMES`. Três ações: **Renomear/Mesclar** (modal único — se o target já existe é merge, senão é rename criando novo tema), **Promover** (candidato → canônico, só visível em candidatos), **Demover** (canônico → candidato, só visível em canônicos não-constant; refusa themes do constant pra evitar split-brain com o classifier). 3 endpoints novos: `GET /api/admin/themes` agrega+ordena (constant-canonical alfabético, depois canonical extra-constant por count, depois candidatos por count, e inclui temas-canônicos-zerados como targets válidos pra merge), `POST /api/admin/themes/rename` (deriva `theme_status` server-side via `isCanonicalTheme(to)`; refusa `from===to` com 400 `noop`; normaliza whitespace/quotes em ambos), `POST /api/admin/themes/demote` (espelho do promote do sub-projeto 16, refusa themes do CANONICAL_THEMES constant com 409 `protected_canonical`). Entrada "Temas" no `AdminSidebar` entre Artigos e Ingestão. +24 vitest novos. |
| 18 | `library-overview-intent-complete` | Resposta à dor "que temas você cobre?" (👎 em 2026-05-12 14:12 com a refusal genérica do bot). Novo intent `library_overview` no classifier (`lib/rag/classifier.ts`) com triggers PT+EN ("que temas", "lista de tópicos", "what topics do you cover"). Quando detectado, runRag pula retrieval e chama `getLibrarySnapshot()` (`lib/rag/library-snapshot.ts`) que agrega artigos por tema via service-role; `buildLibraryOverviewPrompt` injeta o snapshot como ground truth na user-message com instrução explícita "NÃO invente / NÃO recuse". LLM formata com a persona sênior padrão (SYSTEM_PROMPT mantém byte-stability — prefix cache intacto). Caps em 12 temas top, omite count=0, força status='canonical' para themes em CANONICAL_THEMES (defesa contra DB drift). UI: nova card "Descobrir" no `EmptyState` (cor primary, separada das 4 task-cards) com query "Sobre o que você pode me ensinar?". Trace ganha tag `intent:library_overview` + span `library-snapshot`. +18 vitest novos. |
| 19 | `api-costs-dashboard-complete` | Dashboard de custos das APIs em `/admin/costs`. Migration 0013 adiciona `api_usage_events` (provider/operation/model/tokens_in/tokens_out/tokens_cached/call_count/cost_usd_cents/metadata/created_at) + SQL function `admin_api_usage_daily(p_days)` que agrupa por dia × provider × operation. `lib/observability/api-usage.ts` expõe `recordApiUsage()` fire-and-forget (catch interno garante que falha de tracking nunca quebra pipeline) + `computeCostUsdCents()` pure-function com rate cards (gpt-4o-mini $0.15/$0.075 cached/$0.60 por 1M tok; voyage-3-large $0.18/1M; cohere $2/1k calls). Cost gravado no momento da chamada (rate frozen at write time — histórico não muda quando preços mudam). Instrumentação em 8 call sites: `chat-generate` no `onFinish` do `streamText`, `classify`/`condense`/`followups`/`classify-content` em `chat.completions.create`, `multimodal-parse` em `responses.create` (campos `input_tokens`/`output_tokens`/`input_tokens_details.cached_tokens`), `voyage.embed` (usage.total_tokens), `cohere.rerank` (per-call). `GET /api/admin/costs?range=1\|7\|30\|90` retorna `{ rangeDays, daily, totals }`. UI: range selector (Hoje/7/30/90), 3 cards de KPI (custo total, chamadas, tokens in/out + cached), tabelas por provedor e por operação, gráfico de barras horizontal CSS-only por dia. Entrada "Custos" no `AdminSidebar`. +14 vitest (cost math, recordApiUsage swallow-on-error, endpoint contract, range validation). |
| 20 | `assistants-rfp-complete` | Nova capacidade: assistentes que **executam tarefas** (vs chat que só explica). v1 = Assistente de RFP. Migration 0014 adiciona `templates` (admin-curated markdown templates per `assistant_type`) e `assistant_runs` (per-user history com `output_md`). UI admin em `/admin/templates` (CRUD + markdown editor com placeholders `{{escopo}}`/`{{categoria}}`). UI usuário em `/assistants` (hub com cards) → `/assistants/rfp` (form upfront com escopo/categoria/prazo/orçamento/critérios + streaming do markdown + botão "Baixar .docx"). Endpoint `POST /api/assistants/rfp` reusa `retrieve()` + `rerank()` direto (pula classifier), monta prompt via `buildRfpPrompt()` (system prompt dedicado, não compartilha SYSTEM_PROMPT do chat — RFP precisa de prompting diferente, sem prefix cache compartilhado por trade-off aceito), streama via Vercel AI SDK, persiste `output_md` no `onFinish`, instrumenta `recordApiUsage('assistant-rfp-generate')`, abre trace Langfuse `assistant.rfp` com spans `load-template`/`retrieve`/`rerank`/`generate`. `GET /api/assistants/runs/[id]/docx` renderiza on-demand via `lib/assistants/docx.ts` (`mdToDocxBuffer` usando lib `docx` ~150 KB server-bundle, tolerante a markdown imperfeito — flatten tabelas, ignora stray `**` runs, sem throw). Owner-gated via `getRunForOwner()` (defesa em profundidade: service-role + filtro user_id explícito). Tipos `AssistantType = 'rfp'` único, expandir via CHECK constraint + union + nova rota dedicada `/api/assistants/<type>` (NÃO multiplex no path — evita "client forja tipo"). Templates em DB (markdown ~5-50 KB, sem Storage). Rate limit compartilha bucket do `/api/chat`. +24 vitest. |
| 25 | `b2c-auth-hardening-complete` | Pre-B2C: signup self-service público hardened com Cloudflare Turnstile + IP rate-limit anônimo + endpoint de account deletion (LGPD). Migration 0025 adiciona `rate_limit_events_anon (ip_hash, endpoint, created_at)` + RPC `check_rate_limit_anon` espelhando o existente — IP nunca é gravado cru (sha256+APP_SECRET, 32 chars). `lib/captcha.ts` (`verifyTurnstileToken` POST pra Cloudflare siteverify com timeout 5s; `getClientIp` lê x-forwarded-for/x-real-ip; `hashIp` sha256+salt). `lib/rate-limit.ts` ganha `checkAnonRateLimit(endpoint, ipHash)` (3/min, 10/hour por IP). 3 endpoints novos (Node runtime): `POST /api/auth/signup` (captcha → rate-limit → `auth.signUp` server-side com `options.captchaToken` defesa-em-profundidade), `POST /api/auth/reset-request` (captcha → rate-limit → fire-and-forget `resetPasswordForEmail` → **sempre 200** anti-enumeration), `POST /api/account/delete` (requireUser + confirmation === 'EXCLUIR' + `auth.admin.deleteUser` cascateia via FK + `signOut`). UI: `TurnstileWidget` (`@marsidev/react-turnstile`, tema sincronizado com next-themes) wirado em `SignupForm` + `ForgotPasswordForm`; SignupForm agora chama `/api/auth/signup` em vez de `supabaseBrowser.auth.signUp`. `UserRow` ganha link "Excluir minha conta"; `/account/delete` mostra contagens reais (sessions/assistant_runs/feedback via `getAccountFootprint`) + input "digite EXCLUIR". Em `APP_ENV=local\|ci`: captcha skip + test site key fallback (`1x00000000000000000000AA` sempre passa). Env novas: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `APP_SECRET`. +35 vitest novos. |
| 26 | `security-hardening-complete` | Cleanup do Supabase Security Advisor pós-PR #77. Migration 0026 faz 4 grupos de fix: **(A) Errors**: `REVOKE SELECT ON profiles_with_email FROM authenticated, anon` — view era SECURITY DEFINER (default) + grant a authenticated, permitia enumeração de emails via JS client. Service-role mantém acesso; os 2 call sites (admin/users page + route) já usam `getServerSupabase()`. **(B) Function search_path**: `ALTER FUNCTION ... SET search_path = public, pg_temp` em `admin_top_queries`, `admin_api_usage_by_user`, `admin_api_usage_daily`. **(C) SECURITY DEFINER EXECUTE grants**: revogar de PUBLIC + grant explícito por role pras 7 funções (service_role-only: `admin_user_session_counts`/`check_rate_limit_anon`/`handle_new_user`; authenticated+service_role: `check_rate_limit`/`is_admin`/`match_chunks`/`search_chunks_fts`). **(D) Cleanup**: DROP tables mortas `conversations` + `messages` (criadas na migration 0000, nunca usadas — projeto pivotou pra `sessions.messages` JSONB no sub-projeto 6b). **Não fixado**: Extension in Public (`vector`/`pg_trgm`, mover quebra retrieval — aceito); Leaked Password Protection (toggle no dashboard, não migration). |
| 27 | `billing-asaas-complete` | Sub-projeto 2 do roadmap go-live B2C: monetização via Asaas hosted checkout. **Modelo**: Free (chat ilimitado + 1 execução lifetime por assistente, 7 totais) vs Pro R$ 99/mês (chat + assistentes ilimitados). Cartão recorrente + Pix Garantido. Cycle: monthly. Cancellation end-of-period. Spec em [docs/superpowers/specs/2026-05-27-billing-asaas-design.md](docs/superpowers/specs/2026-05-27-billing-asaas-design.md). **Camada de dados** (migration 0027): `subscriptions (user_id unique, asaas_customer_id, asaas_subscription_id, status, plan, payment_method, current_period_start/end, cancel_at_period_end, cancelled_at)` + `billing_webhook_events (asaas_event_id unique, event_type, payload, processed_at, error)` pra idempotência+audit. RLS: user lê só própria sub; webhook table sem policies (service-role). **Libs**: `lib/billing/asaas.ts` (REST client com `createCustomer`/`createSubscription`/`cancelSubscription`/`getSubscription`, AbortSignal 15s, retorna `invoiceUrl` hosted checkout); `lib/billing/subscription.ts` (`getActiveSubscription` considera `past_due` ativo até `current_period_end`); `lib/billing/quota.ts` (`canUseAssistant` = isPro OR count(assistant_runs) === 0; fail-closed em DB error); `lib/billing/handle-paywall.ts` (toast helper com action "Ver planos"); `lib/validators/cpf.ts` (checksum módulo 11). **Endpoints**: `POST /api/billing/checkout` (auth → CPF valid → race protection → createCustomer/Subscription Asaas com `billingType: 'UNDEFINED'` pra cobrir cartão+Pix com 1 fluxo → upsert subscriptions → retorna invoiceUrl), `POST /api/billing/webhook/asaas` (sem auth, valida header `asaas-access-token` vs `ASAAS_WEBHOOK_TOKEN`, idempotency via insert with on conflict do nothing, switch nos events: `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED` → active+set period; `PAYMENT_OVERDUE` → past_due; `PAYMENT_REFUNDED`/`PAYMENT_DELETED`/`SUBSCRIPTION_DELETED` → cancelled), `POST /api/billing/cancel` (auth → Asaas cancel → marca cancel_at_period_end=true, mantém Pro até fim do ciclo). **Paywall enforcement**: hook em `lib/assistants/handler.ts` antes de `createRun` chamando `canUseAssistant(user.id, config.type)` — retorna 402 `{ error: 'paywall', plan: 'free', assistant_type }`. Mesmo check no `/api/assistants/negotiation/strategy` (não usa o handler shared). Client trata via `handlePaywallResponse(res, type)` em todos os 7 XAssistant.tsx — toast.error com action "Ver planos" + reseta state machine. **UI**: `/pricing` (public; `<PricingTable>` com 2 colunas Free/Pro; CTA Pro abre modal `<CheckoutForm>` exigindo Nome+CPF — CPF descartado após o post, não persiste no nosso DB pra reduzir LGPD surface); `/account/billing` (server component, `requireUser`, lê subscription, `<SubscriptionPanel>` com badge status, datas, payment method, botão cancelar/reativar); `<PaywallModal>` (rich modal alternativo, não wirado em v1 — toast cobre). UserRow ganha link "Assinatura". Env novas: `ASAAS_API_KEY`, `ASAAS_API_URL` (sandbox→prod switch), `ASAAS_WEBHOOK_TOKEN`, `NEXT_PUBLIC_PRO_PRICE_BRL`. +46 vitest novos (cpf, asaas, subscription, quota, checkout, webhook, cancel). |

**Milestone 1 closed.**

## Milestone 2 — Beta Readiness (em planejamento, 2026-05-03)
Objetivo: abrir beta fechado (3–5 gestores convidados) para coletar traces reais no Langfuse e escopar Milestone 3 (B2B) com dados, não com palpite. Single-tenant deliberadamente.

- **8 — beta-hardening** ✅ completo (`beta-hardening-complete`)
- **9 — feedback-loop** ✅ completo (`feedback-loop-complete`)

Milestone 2 entregue. Critério de saída para Milestone 3 (≥100 traces `env:beta` com ≥30 ratings em ≥2 semanas) começa a contar a partir do primeiro convite de beta.

Roadmap completo em `docs/product/beta-readiness.md`. Roadmap B2B (Milestone 3+) em `docs/product/b2b-roadmap.md`.

**Test count atual:** 454 vitest, 23 pytest, typecheck zero erros. CI gate: `recall@5 ≥ 0.85` em PR + push main.

## Estrutura de pastas
```
/app
  page.tsx                              (landing pública: nome do produto + botão Entrar)
  layout.tsx                            (root layout, theme provider)
  globals.css                           (HSL CSS variables, --primary = brand color)
  /api
    /chat/route.ts                      (streaming SSE, Edge, AI SDK)
    /health/route.ts                    (smoke check, Edge)
  /chat/page.tsx                        (UI principal, mounts <ChatRoot/>, gated by middleware)
  /login/page.tsx                       (LoginForm: email/senha + Google OAuth + esqueci senha)
  /forgot-password/page.tsx             (reset link request)
  /reset-password/page.tsx              (set new password)
  /auth/callback/route.ts               (PKCE code exchange)
  /admin
    layout.tsx                          (requireAdmin → 404; sidebar shell)
    page.tsx                            (redirect to /admin/users)
    /users/page.tsx                     (server: profiles_with_email + admin_user_session_counts → <UsersTable/>)
    /articles/page.tsx                  (mounts <ArticlesSplitView/>)
    /themes/page.tsx                    (mounts <ThemesAdmin/>, sub-projeto 17)
    /ingest/page.tsx                    (mounts <IngestRoot/>)
    /feedback/page.tsx                  (mounts <FeedbackRoot/>)
    /costs/page.tsx                     (mounts <CostsDashboard/>, sub-projeto 19)
  /api/admin
    /users/route.ts                     (Node: GET list, POST invite, PATCH role)
    /articles/[id]/route.ts             (Node: DELETE + PATCH; uses getServerSupabase service-role since 2026-05-12 — articles has no admin UPDATE RLS)
    /articles/bulk-delete/route.ts      (Node: POST {ids[]} bulk DELETE)
    /ingest/upload/route.ts             (Node: multipart → Storage + job row)
    /ingest/run/[jobId]/route.ts        (Node, maxDuration=300: runs runPipeline)
    /ingest/jobs/route.ts               (Node: GET list, inline cleanup + stale sweep)
    /ingest/retry/[jobId]/route.ts      (Node, maxDuration=300: reset error → re-run)
    /feedback/route.ts                  (Node: GET paginated + filtered list)
    /feedback/[id]/resolve/route.ts     (Node: POST toggle resolved_at)
    /feedback/top-queries/route.ts      (Node: GET admin_top_queries aggregation)
    /sessions/[id]/messages/route.ts    (Node: admin-gated GET de sessions.messages JSONB)
    /themes/route.ts                    (Node: GET aggregated theme list, sub-projeto 17)
    /themes/promote/route.ts            (Node: POST bulk candidate→canonical flip, sub-projeto 16)
    /themes/rename/route.ts             (Node: POST {from,to} bulk rename/merge, sub-projeto 17)
    /themes/demote/route.ts             (Node: POST canonical→candidate, refuses CANONICAL_THEMES constant, sub-projeto 17)
    /costs/route.ts                     (Node: GET ?range=1|7|30|90, sub-projeto 19)
/lib
  /rag
    types.ts                            (Classification + Intent union (6 values, library_overview added sub-projeto 18), RetrievedChunk, SourceRef, ChatMessage, RagResult)
    classifier.ts                       (OpenAI gpt-4o-mini: theory, intent, language, needsRetrieval; library_overview triggers PT+EN since sub-projeto 18)
    retriever.ts                        (vetorial + FTS via RPC, RRF)
    reranker.ts                         (Cohere wrapper, fallback para RRF, MIN_RELEVANCE 0.10)
    prompt-builder.ts                   (SYSTEM_PROMPT byte-stable + buildPrompt + buildLibraryOverviewPrompt; senior-expertise rules + library snapshot path)
    condenser.ts                        (multi-turn → standalone query)
    library-snapshot.ts                 (getLibrarySnapshot for library_overview intent, sub-projeto 18)
    followups.ts                        (suggestFollowups: gpt-4o-mini, deepen vs redirect modes)
    index.ts                            (runRag orquestrador; library_overview short-circuits retrieval)
  /db
    supabase.ts                         (service-role + anon clients)
    supabase-browser.ts                 (cookie-aware client client; LITERAL process.env.NEXT_PUBLIC_*)
    supabase-server.ts                  (cookie-aware server client via next/headers)
  /llm
    openai.ts                           (getOpenAI singleton + getOpenAIModel + pingOpenAI; the only LLM wrapper since 2026-05-08)
    voyage.ts                           (embed com inputType opcional)
    cohere.ts                           (rerank wrapper)
  /observability
    types.ts                            (Trace, Span, TraceLevel)
    langfuse.ts                         (startTrace + flushAsync, no-op fallback quando keys absent)
    api-usage.ts                        (recordApiUsage fire-and-forget + computeCostUsdCents pure fn, sub-projeto 19)
  env.ts                                (requireEnv — server-side only; client modules use literal process.env)
  auth.ts                               (getCurrentUser, requireUser, getProfile, NotAuthenticated, requireAdmin, NotAdmin)
  chat-storage.ts                       (@deprecated; deriveTitle ainda usado)
  /db
    storage.ts                          (upload/download/delete wrappers para bucket ingest-uploads)
  /ingest                               (TS port da pipeline; scripts/ingest.py mantido como legacy)
    types.ts                            (JobStatus, JobStage, IngestJob, Block, ParsedSource, ChunkKind, ChunkRow)
    hash.ts                             (sha256 helper)
    parser.ts                           (parsePdfTextOnly + parseDocxTextOnly + parseTxt; parseFile @deprecated mime-dispatch wrapper)
    multimodal-parse.ts                 (parsePdfMultimodal: OpenAI Responses API com input_file PDF base64; >20 MB usa Files API via ai.files.create, zod retry, abort 120s)
    docx-parse.ts                       (parseDocxWithTables: mammoth.convertToHtml + table extraction)
    html-table.ts                       (htmlTableToMarkdown utility)
    parse-source.ts                     (parseSource dispatcher: PDF→multimodal-with-fallback, DOCX→tables-aware, TXT→trivial)
    chunker.ts                          (chunkText + chunkBlocks; paragraph-aware splitter shared internally)
    metadata.ts                         (author/language/date heurísticas; title campo ignorado pós-sub-projeto 13)
    taxonomy.ts                         (CANONICAL_THEMES 11 canônicos + isCanonicalTheme + normalizeCandidateTheme + MAX_THEME_LENGTH; TAXONOMY/isValidTheme back-compat aliases, sub-projeto 16)
    classify-content.ts                 (classifyContent: gpt-4o-mini, retorna { title, theme, themeStatus, summary }; permite candidate themes desde sub-projeto 16)
    pipeline.ts                         (runPipeline: dedup → classify → insert, grava theme + theme_status)
/middleware.ts                          (gates /chat + /admin via Supabase session check)
/components
  /chat (ChatRoot, ChatSession, Sidebar, Header, EmptyState (+ "Descobrir" card, sub-projeto 18), MessageList, Message, Composer, FollowupChips, ChatErrorBoundary, MessageActions)
  /auth (LoginForm, ForgotPasswordForm, ResetPasswordForm, UserRow — admin link visível só para admins)
  /admin (AdminSidebar (+ Temas + Custos entries), UsersTable, InviteUserDialog, ArticlesSplitView (+ sort/refresh/source filename + ingested_at sub-projeto 12), ArticleDetail (+ candidate badge sub-projeto 16), ConfirmDelete, IngestRoot, Dropzone (100 MB), JobCard, JobsLive, JobsRecent, FeedbackRoot, FeedbackList, FeedbackDetail, TopQueries, ThemeSidebar (canonical + Candidatos section sub-projeto 16), ThemesAdmin (sub-projeto 17), CostsDashboard (sub-projeto 19))
  /ui (shadcn base-nova: button, textarea, scroll-area, sheet, tooltip, dialog, input, dropdown-menu, table)
  theme-provider.tsx
/hooks
  useChatSessions.ts                    (@deprecated — localStorage; mantido para testes)
  useChatSessionsRemote.ts              (DB-backed via supabaseBrowser, drop-in para useChatSessions)
/scripts
  ingest.py                             (pipeline Python, sub-projeto 2)
  rag-query.ts                          (CLI de debug, sub-projeto 3)
  reclassify.ts                         (re-classifica todos os artigos via classifyContent)
  reclassify-outros.ts                  (re-classifica só artigos em "Outros", preserva title/summary, sub-projeto 16)
  apply_migrations.py                   (aplica todas as migrations em ordem, idempotente)
  apply_migration_0012.py               (one-shot open taxonomy migration, sub-projeto 16)
  apply_migration_0013.py               (one-shot api_usage_events migration, sub-projeto 19)
  bootstrap_storage.py                  (cria bucket ingest-uploads + path-scoped admin policies)
  bootstrap_admin.py                    (Auth Admin API user create + profiles.role='admin' promote)
  check_recent_ingest.py                (diagnostic: lista 10 ingestion_jobs recentes + 5 newest articles)
  check_dedup_target.py                 (diagnostic: lookup do artigo que um dedup job matched)
  inspect_negative_feedback.py          (diagnostic: 👎 hoje com question + assistant message + chunks)
  /eval
    golden.json                         (31 Q&A pairs, realinhados em 2026-05-09 com 27-article corpus)
    run.ts                              (recall@5, MRR, latência; gate 0.85)
/supabase/migrations
  00000000000000_init.sql               (pgvector, FTS, articles, chunks)
  00000000000001_articles_hash_unique.sql (idempotência da ingestão)
  00000000000002_rag_rpc.sql            (match_chunks, search_chunks_fts)
  00000000000003_profiles_and_rls.sql   (profiles + is_admin() + trigger + RLS para articles/chunks)
  00000000000004_sessions.sql           (sessions table + 4 owner-only RLS policies)
  00000000000005_admin_ui.sql           (ingestion_jobs + 4 admin RLS, profiles_admin_update, articles_admin_delete, profiles_with_email view, admin_user_session_counts RPC)
  00000000000006_sessions_user_id_default.sql (forward-fix: ALTER sessions.user_id SET DEFAULT auth.uid())
  00000000000007_rate_limit.sql         (rate_limit_events + check_rate_limit RPC, sub-projeto 8)
  00000000000008_message_feedback.sql   (message_feedback + 4 RLS owner-only + unique(user_id, trace_id), sub-projeto 9)
  00000000000009_articles_source_chars.sql (source_chars int NOT NULL backfill, sub-projeto 10)
  00000000000010_articles_theme.sql     (theme text + summary + CHECK 11-themes — CHECK dropado em 0012, sub-projeto 13)
  00000000000011_feedback_resolved.sql  (resolved_at timestamptz + admin_top_queries fn, sub-projeto 14)
  00000000000012_open_taxonomy.sql      (drop theme CHECK + theme_status enum + length CHECK 1-50, sub-projeto 16)
  00000000000013_api_usage_events.sql   (api_usage_events + admin_api_usage_daily fn, sub-projeto 19)
/.github/workflows
  ci.yml                                (typecheck + vitest + pytest + rag:eval em PR + push main; artifact + PR comment)
/docs/superpowers
  /specs (1 design doc por sub-projeto)
  /plans (1 implementation plan por sub-projeto)
```

## Identidade visual
- **Branding TBD** — empresa proprietária ainda será criada. Não usar IAgentics, ProAICircle, ou qualquer marca específica. Produto se identifica como "ProcurementGPT".
- Cor de acento: `#0066ff` (electric blue) via CSS variable `--brand` — trocável quando a marca final for definida
- Tipografia: Inter
- Sem logo de empresa no header até decisão de branding; só nome do produto

## Comportamento do agente
Persona: "Especialista sênior em procurement com 20 anos de experiência, formação acadêmica
sólida (Kraljic, Porter, Monczka, Cox, Cousins, Dyer), didática mas direta, fundamentada na base
de conhecimento."

Estrutura padrão de resposta (sem citações visíveis):
1. Resposta direta (2-3 linhas)
2. Aprofundamento teórico baseado no contexto fornecido
3. Aplicação prática (exemplo ou caso)
(decisão 2026-05-04: dropado item antigo de "Sugestão de leituras complementares" — beta tester deve perguntar se quiser ir além, em vez de receber listas autopromocionais ao final de cada resposta.)

NÃO inventar teorias. Se não houver fonte na base, dizer explicitamente. NÃO mencionar IDs,
números entre colchetes, ou referências bibliográficas estilo `[1]` na resposta — é só
para o usuário ler como uma explicação fluente.

## Variáveis de ambiente
```
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini   # default em código se vazio
VOYAGE_API_KEY=
VOYAGE_MODEL=voyage-3-large
COHERE_API_KEY=
COHERE_RERANK_MODEL=rerank-multilingual-v3.0
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_DB_PASSWORD=          # para o ingest.py via psycopg
LANGFUSE_PUBLIC_KEY=           # ativo desde sub-projeto 7; quando vazio, wrapper retorna no-op trace
LANGFUSE_SECRET_KEY=
LANGFUSE_BASE_URL=https://cloud.langfuse.com
APP_ENV=local                  # sub-projeto 8 — drives env:<value> tag in Langfuse (local|beta|production|ci)
NEXT_PUBLIC_TURNSTILE_SITE_KEY= # sub-projeto 25 — Cloudflare Turnstile site key (client)
TURNSTILE_SECRET_KEY=          # sub-projeto 25 — siteverify secret (server)
APP_SECRET=                    # sub-projeto 25 — salt do hash IP em rate_limit_events_anon (gerar `openssl rand -hex 32`)
ASAAS_API_KEY=                 # sub-projeto 27 — Asaas REST API token (server)
ASAAS_API_URL=                 # sub-projeto 27 — sandbox: https://sandbox.asaas.com/api/v3 · prod: https://www.asaas.com/api/v3
ASAAS_WEBHOOK_TOKEN=           # sub-projeto 27 — secret pra validar header `asaas-access-token` em /api/billing/webhook
NEXT_PUBLIC_PRO_PRICE_BRL=99.00 # sub-projeto 27 — preço Pro mensal, fonte única da verdade pra UI
```

## Comandos
- `npm run dev` — desenvolvimento Next.js
- `npm test` — vitest (TypeScript)
- `npm run typecheck` — `tsc --noEmit`
- `npm run db:migrate` — aplicar migrations Supabase via CLI (ou aplicar manualmente via psycopg/dashboard)
- `npm run rag:query "<pergunta>"` — CLI ad-hoc de retrieval
- `npm run rag:eval` — eval offline 25 pares (recall@5, MRR, latência); exit 1 se recall@5 < 0.85; escreve `scripts/eval/results.json`
- `python scripts/ingest.py --path ./artigos/` — ingerir artigos
- `python scripts/ingest.py --file <arquivo>` — ingerir 1 arquivo
- `python scripts/ingest.py --dry-run --path ./artigos/` — preview sem DB
- `scripts/.venv/Scripts/pytest.exe scripts/tests/` — testes Python

## O que evitar
- Chunking fixo por N tokens (use semantic chunking — sub-projeto 2 já entrega híbrido)
- Apenas busca vetorial (sempre híbrida + reranker)
- Mostrar `[1]`, `[2]`, IDs, ou referências bibliográficas para o usuário (decisão 2026-05-02)
- Bibliotecas pesadas no Edge Runtime
- Hardcoded prompts no componente — sempre em `/lib/rag/prompt-builder.ts`
- Reintroduzir IAgentics ou outra marca antes de o usuário decidir o nome da empresa
- Conectar a Supabase com `psycopg` sem `autocommit=True` (transações silenciosamente fazem rollback — ver memory `psycopg3_autocommit.md`)
- Em código `'use client'`, usar `requireEnv(name)` (dinâmico) para `NEXT_PUBLIC_*` — Next.js só inlina referências literais `process.env.NEXT_PUBLIC_FOO`. Use literal access em browser modules (ver `lib/db/supabase-browser.ts`)
- Usar `useChatSessions` (localStorage, deprecated) para usuários autenticados — usar `useChatSessionsRemote` (DB-backed)
- `Button asChild` do shadcn base-nova não existe — para link estilizado como botão, usar `<Link>` com classes Tailwind
- `DropdownMenuTrigger asChild` do shadcn base-nova também não existe (wraps `@base-ui/react/menu` MenuTrigger) — estilizar o trigger direto via `className`
- Restaurar localStorage de conversas após login — sub-projeto 6b decidiu **discard** (DB é a única fonte de verdade quando logado)
- `pdf-parse@2.x` tem API incompatível (class-based, depende de pdfjs-dist com workers) — fixado em `1.1.1` (default-export simples). Importar **inner path** `pdf-parse/lib/pdf-parse.js` (NÃO `pdf-parse`) — o `index.js` do pacote roda um self-test no module load que tenta ler `test/data/05-versions-space.pdf` e dispara `ENOENT`. Dinâmico ou top-level, qualquer import de `'pdf-parse'` direto vai quebrar
- Não awaitar `fetch('/api/admin/ingest/run/[jobId]')` no cliente — o ponto do padrão fire-and-forget é deixar o handler rodar até o fim mesmo após a request original retornar. Em Railway isso é trivial (processo long-lived); o padrão veio da Vercel onde só a request keep-alive segurava a função viva.
- Em `/admin/*` API routes ou server components, usar `requireAdmin()` + retornar **404** (não 403) para non-admins — não revelar a existência do endpoint
- A view `profiles_with_email` foi criada com `security_invoker = true` (queries rodam como o caller). Authed users **não** têm SELECT em `auth.users`, então qualquer query do view via cookie-aware client falha com `permission denied for table users`. Usar `getServerSupabase()` (service-role) em routes admin-gated que precisam ler dela
- Bucket `ingest-uploads` é privado, com policy admin-only que restringe inserts ao próprio `auth.uid()` folder — não tentar fazer upload para outro user_id
- Chamar `runRag` em código cliente diretamente — sempre via `/api/chat` para garantir trace + auth
- Importar `langfuse` top-level em rotas Edge — usar `await import('langfuse')` dentro de `startTrace` (a wrapper já faz isso). Top-level pode quebrar Edge cold-start
- Esquecer `await flushAsync()` no `onFinish`/catch do `streamText` — Edge runtime mata a função quando a response termina, perdendo traces silenciosamente
- Pular o batching de embeds no eval — 25 chamadas seriais à Voyage seriam ~9 min (3 RPM throttle); batched é <30s
- Mudar `RECALL_THRESHOLD` em `scripts/eval/run.ts` sem atualizar a spec + CLAUDE.md (o número precisa ser auditável depois)
- Mudar `MIN_RELEVANCE` em `lib/rag/reranker.ts` sem rodar `npm run rag:eval` — o threshold é gateado por `recall@5 ≥ 0.85` e qualquer mudança precisa ser auditável
- Acessar `rate_limit_events` direto do cliente — a tabela tem RLS sem policies por design; sempre via RPC `check_rate_limit` (security definer)
- Esquecer de adicionar mocks de `@/lib/auth` + `@/lib/rate-limit` em testes novos de `/api/chat` — sem eles a route hoje retorna 401 antes de qualquer outro código rodar
- Mudar a versão de `sonner` sem confirmar que o `Toaster` continua honrando o tema do `next-themes` — o tema é resolvido em runtime via `useTheme()` no wrapper
- Persistir IDs de mensagem do `useChat` no JSONB de `sessions.messages` — sub-projeto 9 deliberadamente NÃO faz isso. O anchor de feedback é o `trace_id` Langfuse propagado via `appendMessageAnnotation`. Se um sub-projeto futuro precisar de message-level feedback (não trace-level), aí sim fazer schema change.
- Esquecer `id: 'mock-trace-id'` ao criar mocks de `Trace` em testes novos — o tipo agora exige `id: string` (sub-projeto 9). Sem isso, typecheck quebra.
- Mexer no Header sem manter o link "Feedback geral" — é o canal de fallback para reports que não cabem em 👎. O destino `mailto:rgoalves@gmail.com` é TBD-temporary; trocar quando branding definir.
- Bloquear o response do `/api/feedback` em falha do Langfuse `score()` — `recordFeedback` chama `scoreTrace` fire-and-forget de propósito; UI não deve esperar por Langfuse.
- Calcular % absorvido sem o prefix `≈` na UI — o valor é overcount intencional pelo overlap (400 chars) e pode passar de 100% em artigos pequenos. O prefix é a comunicação visual de aproximação.
- Mover `raw_md` do row do `articles` sem antes garantir que `source_chars` continua sendo populado — sub-projeto 10 deliberadamente denormaliza para que essa migração futura não quebre a UI admin.
- Persistir `followups` em `sessions.messages` JSONB — sub-projeto 11 deliberadamente NÃO persiste. Vivem só na annotation SSE do turno atual e desaparecem quando o próximo turno renderiza. Se um sub-projeto futuro precisar de chips em mensagens passadas, fazer schema change explícito.
- Esquecer de incluir `chunks` no mock de `runRag` em testes novos do `/api/chat` — sub-projeto 11 adicionou `chunks: RetrievedChunk[]` ao `RagResult`. Padrão: passar `chunks: []` quando o retrieval foi pulado, ou um array de `RetrievedChunk` com `content` quando o teste exercita o caminho `deepen` do `suggestFollowups`.
- Bloquear o response do `/api/chat` em falha do `suggestFollowups` — o helper é fail-soft por design, retorna `[]` em qualquer erro (Gemini, JSON, zod, abort 3s) e o `onFinish` segue normalmente. Não envolver a chamada em handler que rejeite.
- Chamar `parseFile` em código novo — o export é `@deprecated` desde sub-projeto 12. Use `parseSource` (`lib/ingest/parse-source.ts`) que dispatcha multimodal-with-fallback. `parseFile` só fica para retrocompat interna.
- Esquecer de incluir `metadata.kind` no mock de chunk em testes novos do `/admin/articles` ou pipeline — sub-projeto 12 adicionou kind/page/caption/figureKind no JSONB. Padrão para text: `{ kind: 'text' }`. Tests legacy usam metadata vazia; UI defaultiza para `text`.
- Tentar split em chunks de tabela ou figure — `chunkBlocks` deliberadamente não split tabela/figure mesmo se passar de 3200 chars. Tabela quebrada perde semântica; aceita-se chunk grande.
- Awaitar response do `/api/admin/ingest/run/[jobId]` no cliente quando o pipeline está usando multimodal — a chamada multimodal pode levar 30-90s. Padrão fire-and-forget existente já cobre, mas qualquer mudança que introduza await vai bloquear UI.
- Confiar em `keep_source` na tabela `ingestion_jobs` — não existe. Sub-projeto 12 deliberadamente NÃO adicionou. Se reprocessamento massivo virar dor, sub-projeto futuro adiciona migration + flag.
- Em retries do multimodal parser: o retry só dispara em `z.ZodError` ou `SyntaxError`. Erros de rede / 5xx vão direto pro fallback texto-only no `parseSource` — não ficam looping.
- Esquecer que o `parser` field em `articles.metadata` é o sinal de auditoria — quando todo PDF está caindo em `text-only-fallback`, o multimodal está com problema; investigar antes de assumir que o gain de tabelas/figuras está chegando.
- Reintroduzir `@google/genai` ou `getGemini()` em código novo — toda a stack é OpenAI desde 2026-05-08. Multimodal PDF passa por `openai.responses.create` com `{ type: 'input_file', file_data: 'data:application/pdf;base64,...' }` (>20 MB usa Files API com `purpose: 'user_data'`).
- Esquecer `OPENAI_API_KEY` no Railway env quando deployar — todo o `/api/chat` quebra (sem fallback).
- Esquecer `OPENAI_API_KEY` nos GitHub Actions secrets — CI vai falhar no `RAG eval`.
- Atualizar `@ai-sdk/openai` pra `^2.x` ou `^3.x` sem subir `ai` pra `^5.x` — a major contém troca do contrato `LanguageModelV1` → `LanguageModelV3` e quebra typecheck no `streamText`. Se for atualizar, faça os dois juntos.
- Adicionar tema canônico editando só `lib/ingest/taxonomy.ts` sem migration — desde sub-projeto 16, a CHECK constraint do tema fixo NÃO existe mais (DB aceita qualquer string ≤50 chars). Mas o classificador só sugere os temas em `CANONICAL_THEMES`; pra novo tema virar uma opção da IA, é preciso editar a constante.
- Considerar `theme_status='candidate'` como erro — é o sinal de "IA propôs novo tema, admin precisa revisar", não um defeito. UI mostra esses na seção "Candidatos · IA propôs". Use `POST /api/admin/themes/promote` para bulk-promote depois de aprovar.
- Forjar `theme_status` via PATCH — o body do `/api/admin/articles/[id]` ignora `theme_status` enviado pelo cliente. Status é sempre derivado server-side via `isCanonicalTheme(theme)`. Mudança de canonicidade em massa só via endpoint dedicado de promote.
- Chamar `classifyContent` ANTES do dedup check no `pipeline.ts` — o ordering correto é dedup → classify → insert (sub-projeto 13 deliberadamente reordenou pra economizar OpenAI em re-uploads do mesmo PDF).
- Confiar no `extractMetadata.title` em código novo — sub-projeto 13 ignora esse campo (`articles.title` agora vem do `classifyContent`). `extractMetadata` segue válido pra `author`/`language`/`date`.
- Persistir tema em `chunks.metadata` — o tema é puramente administrativo (organização da biblioteca), NÃO é usado pelo retrieval. Adicionar no chunk seria duplicação inútil.
- Editar `golden.json` `expected_titles` sem rodar `npm run articles:reclassify` antes — você não sabe quais títulos canônicos o LLM produziu até rodar o backfill.
- Usar `articles.title` como ID estável em qualquer integração externa — o admin pode editar via PATCH a qualquer momento. Use `articles.id` (UUID).
- Ler `message_feedback` via cookie-aware client (`supabaseBrowser`) em código admin — RLS é owner-only e admin não consegue ver feedback de outros users. Use `getServerSupabase()` (service-role) em route handler admin-gated. Pattern já estabelecido em `/api/admin/articles`.
- Ler `sessions.messages` via `supabaseBrowser` em UI admin — RLS owner-only bloqueia sessões de outros users. Use `GET /api/admin/sessions/[id]/messages` (sub-projeto 14) que usa service-role.
- Esquecer de criar a SQL function `admin_top_queries` ao reaplicar migration 0011 — sem ela, `topQueries()` retorna array vazio sem erro óbvio. A função é parte da migration 0011; verifique com `select count(*) from pg_proc where proname='admin_top_queries'` se suspeitar.
- Confiar no `last user message` do `sessions.messages` JSONB pra preview de feedback — pode não bater com o turno do trace. v1 do sub-projeto 14 NÃO mostra preview na lista por isso. Se um sub-projeto futuro quiser preview, persistir trace_id por turno em `sessions.messages` JSONB.
- Considerar `resolved_at` como audit log — não há `resolved_by` nem timeline. Single-tenant atual = single admin OK; em B2B precisa schema change.
- Usar `supabaseServer()` (cookie-aware) em qualquer endpoint admin que faz UPDATE/INSERT em `articles`, `message_feedback`, `sessions`, `profiles`, `api_usage_events`, etc. — articles tem RLS só de SELECT e DELETE pra admin; UPDATE silenciosamente afeta 0 rows. Use `getServerSupabase()` (service-role, em `lib/db/supabase.ts`). Bug histórico: PR #11 (2026-05-12) corrigiu PATCH article + promote/rename/demote themes endpoints que silenciosamente no-opavam. Pattern: `requireAdmin()` + `getServerSupabase()`, NÃO `supabaseServer()`.
- Esquecer de instrumentar `recordApiUsage()` em call site novo de LLM/embed/rerank — `/admin/costs` (sub-projeto 19) só vê o que está gravado em `api_usage_events`. Para adicionar tracking: importe `recordApiUsage` de `@/lib/observability/api-usage` e chame `void recordApiUsage({ provider, operation, model, tokensIn, tokensOut, tokensCached, callCount, metadata })` dentro do try block, ANTES do parse/return. Fire-and-forget — falha de tracking NUNCA quebra pipeline (`void` + try/catch interno).
- Rebumear rate cards em `lib/observability/api-usage.ts` sem documentar a data — `cost_usd_cents` é gravado at write time, então linhas históricas mantêm o cost antigo. Se você muda a constant, novos rows usam a nova rate mas o histórico permanece — bom para auditoria. Se PRECISAR re-cost histórico (raro), faça via SQL UPDATE explícito documentando o motivo.
- Considerar `intent='library_overview'` como smalltalk — sub-projeto 18 deliberadamente separou. Library_overview gera span `library-snapshot`, lê tabela articles, formata resposta com a persona sênior. Smalltalk pula tudo isso e cai no caminho refusal/no-context do prompt-builder. Confundir os dois faz meta-queries ("que temas você cobre") voltarem a refusal genérica.
- Esquecer que `SYSTEM_PROMPT` em `lib/rag/prompt-builder.ts` é byte-stable (invariant do prefix cache OpenAI) — mudanças no prompt geram cache miss até o cache rebuild. `buildLibraryOverviewPrompt` deliberadamente reusa o mesmo `SYSTEM_PROMPT` e injeta o snapshot só no user message pra preservar o cache. Não bifurque o system prompt por intent.
- Tentar promover/demover via mudança direta na `CANONICAL_THEMES` constant sem migration — a constant é source-of-truth do classificador (prompt), não do DB. Promover candidato → canônico flipa só `theme_status` (DB-only). Pra um tema candidato virar opção *ativa* na classificação de NOVOS uploads, é necessário editar `lib/ingest/taxonomy.ts` via PR. Decisão deliberada — admin promove ao constant após validar que o tema estabilizou.
- Atualizar a tabela do CLAUDE.md (sub-projetos completos) na ordem errada — entradas DEVEM estar em ordem crescente (1, 2, ..., 14, 15, 16, 17, 18, 19). Inserir nova linha NO LUGAR CERTO; já vi 3 vezes nesse projeto eu trocar a ordem por engano. Sempre cole o INSERT abaixo da última linha existente.

## Fluxo de chat end-to-end (sub-projetos 1-7)
```
usuário não logado → / (landing) → /login → middleware passa → /chat
                                                                 ↓
                              ChatRoot (mounted gate) → useChatSessionsRemote
                                                                 ↓
                                           supabaseBrowser ↔ Postgres sessions (RLS owner-only)
                                                                 ↓
                                              ChatSession (key=currentId) → useChat (AI SDK)
                                                                 ↓
                                          POST /api/chat (Edge) { messages, sessionId }
                                                                 ↓
                  startTrace({ name:'chat.turn', userId, sessionId, tags:['env:production'] })
                                                                 ↓
                              condense span → condenseQuery → runRag (parentTrace=trace)
                                                                 ↓
                              4 spans nested: classify → retrieve → rerank → build-prompt
                                                                 ↓
                              generate span → streamText (gpt-4o-mini via @ai-sdk/openai)
                                                                 ↓
                                                       SSE de volta ao cliente
                                                                 ↓
              onFinish → end generate span
                                                                 ↓
              if finishReason==='stop' && text.length>=20 → suggestFollowups span
                                                                 ↓
              data.appendMessageAnnotation({ followups }) (SSE)
                                                                 ↓
              trace.end + await flushAsync (NÃO esquecer!)
                                                                 ↓
                                             useChatSessionsRemote.updateMessages → DB
```

## Bootstrap admin
- Único admin atual: `rgoalves@gmail.com` (auth.users id `16fab8f7-a960-48b4-903d-b590e476b51b`), role='admin' em profiles.
- Para promover outro usuário: pode usar `/admin/users` (sub-projeto 6c) — clicar no menu ⋯ da row → "Promover a admin". Ou via SQL: `update profiles set role='admin' where id=(select id from auth.users where email='<email>')`.

## Fluxo de ingestão via UI (sub-projeto 6c)
```
admin → /admin/ingest → drop PDF/DOCX/TXT no Dropzone (validação client: MIME, ≤10 MB)
                                ↓
   POST /api/admin/ingest/upload (multipart, Node) → Storage upload + ingestion_jobs row (status=queued)
                                ↓
   POST /api/admin/ingest/run/[jobId] (Node, fire-and-forget, sem await do cliente; Railway mantém o handler vivo no processo long-lived)
                                ↓
   runPipeline: parsing → chunking → embedding (Voyage, batch 16) → inserting → done
                                ↓
   GET /api/admin/ingest/jobs (polling 2s) → IngestRoot atualiza JobsLive/JobsRecent
                                ↓
   Dedup hit (sha256 == metadata->>'content_hash' existente): stage='deduplicated', chunks_count=0
   Erro: status='error', error_message preservada, storage file mantido (B2 retry)
```
