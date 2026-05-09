# Sub-projeto 14 — Feedback Review Loop

**Status:** spec
**Data:** 2026-05-08
**Milestone:** pós-Milestone 2 (admin-ergonomics; pré-requisito pra qualquer Tier 2/3 de aprendizado)
**Tag de saída prevista:** `feedback-review-loop-complete`

## Objetivo

Fechar o loop entre o sinal capturado (👍/👎 + comentário em `message_feedback`) e a ação humana que melhora o sistema. Hoje o feedback é gravado em `message_feedback` (sub-projeto 9) e mirrored pra Langfuse, mas **ninguém em código consome essa tabela** — apenas a UI hidrata o estado dos botões. Sem visibilidade do admin, o feedback fica parado e o sistema não aprende do que falha.

Esse sub-projeto adiciona uma página `/admin/feedback` onde o admin vê:
1. **Lista de feedback recente** (👍 e 👎) com filtros — rating, data, resolvido/não, contém comentário
2. **Detail pane** por item — pergunta original, resposta gerada, chunks recuperados (com badges de tema), comentário do usuário, e ação **"marcar como resolvido"** que flagga o item
3. **Painel "Top Queries"** dos últimos 30 dias — agregação das perguntas mais frequentes, computada das `sessions.messages` JSONB

A mudança de schema é mínima: uma coluna `resolved_at timestamptz null` em `message_feedback` (migration 0011). "Resolvido" significa "admin viu, agiu (subiu artigo, editou tema, ajustou prompt) ou decidiu skip". Não há ação automática — esse loop é deliberadamente humano.

Este sub-projeto não introduz ML. Mas constrói o **dataset humano-curado** que viabiliza Tier 2/3 (hard-negatives mining, eval-driven threshold sweep, fine-tune de reranker) quando o volume justificar.

## Princípios

1. **Loop humano-no-meio** — admin lê, decide, age. Sem automação opaca.
2. **Mínima mudança de schema** — `resolved_at` flag em `message_feedback`. Sem nova tabela. Se o sub-projeto futuro precisar de notas / categorização de gaps, faz schema change então.
3. **Service-role pra admin** — `message_feedback` tem RLS owner-only (`auth.uid() = user_id`). Admin lê via `getServerSupabase()` (service-role bypass) — pattern já estabelecido em `/api/admin/articles`.
4. **Reuso máximo** — `lib/feedback.ts` ganha `listFeedback`/`resolveFeedback`. UI reaproveita componentes existentes (`Table`, `Input`, `Button`, badges de tema do sub-projeto 12/13).
5. **YAGNI** — sem export CSV, sem bulk-resolve, sem categorização de gap, sem notas no resolve, sem alertas/email, sem dashboard analytics pesado. UI minimalista que entrega o sinal.
6. **Privacy-conscious** — admin único é o owner do projeto (single-tenant); comentários podem ter PII; documentado mas não sanitizado em código (LGPD nota em CLAUDE.md gotchas).

## Arquitetura

```
admin → /admin/feedback (gated por requireAdmin)
  ↓
<FeedbackRoot> (client) — owns state: filters, selectedId
  ├─ <FeedbackList> (left)
  │     ↓ GET /api/admin/feedback?rating=&resolved=&from=&to=&hasComment=
  │       service-role query → message_feedback joined com sessions
  │     ← list of { id, traceId, rating, comment, created_at, resolved_at, sessionId, question_preview }
  │
  ├─ <FeedbackDetail> (right) — quando selectedId set
  │     ↓ derived from list (no extra fetch needed for v1):
  │       extracted from sessions.messages JSONB by trace_id matching
  │     ↑ POST /api/admin/feedback/[id]/resolve
  │       service-role update set resolved_at = now()
  │
  └─ <TopQueries> (top bar)
        ↓ GET /api/admin/feedback/top-queries?days=30
          aggregation query: jsonb_array_elements(sessions.messages)
        ← list of { content, count }[]
```

Na lista, cada row mostra: rating (👍/👎), preview da pergunta (40 chars), data, badge "resolved" se aplicável. Click no row preenche o detail pane à direita. Detail mostra:

- Pergunta completa (do user message no JSONB)
- Resposta completa (do assistant message no JSONB)
- Chunks usados (`annotations.sources` no assistant message; renderizados como cards com badge de kind/theme)
- Comentário do usuário (se 👎 + comentário)
- Botão "Marcar como resolvido" (ou "Desmarcar" se já resolvido)

`<TopQueries>` é um pequeno painel acima da lista mostrando as 10 perguntas mais frequentes nos últimos 30 dias com contagem. Útil pra admin perceber padrões: "ah, todo mundo pergunta sobre TCO mas só temos 2 artigos sobre".

## Componentes

### Backend — novos

| Arquivo | Responsabilidade |
|---|---|
| `app/api/admin/feedback/route.ts` | `GET` lista paginada com filtros (`rating`, `resolved`, `from`, `to`, `has_comment`, `cursor`, `limit`). Gate `requireAdmin()` → 404. Service-role query. JSONB extração da pergunta inline na select pra evitar overfetch. |
| `app/api/admin/feedback/[id]/resolve/route.ts` | `POST` flip `resolved_at` (atomic toggle ou explicit `{ resolved: boolean }` body). Gate `requireAdmin()` → 404. Service-role update. Returns `{ ok: true, resolved_at }`. |
| `app/api/admin/feedback/top-queries/route.ts` | `GET ?days=30&limit=10` retorna agregação. Gate `requireAdmin()` → 404. Query: `jsonb_array_elements(messages)` filtrando `role='user'`, group by `content`, order by count desc. |
| `lib/feedback.ts` (estender) | Adiciona `listFeedback(filters)`, `resolveFeedback(id, resolved)`, `topQueries(days, limit)` — server-side helpers que usam `getServerSupabase()` (service-role). |

### Frontend — novos

| Arquivo | Responsabilidade |
|---|---|
| `app/admin/feedback/page.tsx` | Server component: gate `requireAdmin()` → 404; renderiza `<FeedbackRoot>`. |
| `components/admin/FeedbackRoot.tsx` | `'use client'`. Owns: filter state (`rating`, `resolved`, `dateFrom`, `dateTo`, `hasComment`), `selectedId`, `topQueries` data. Initial fetch via `useEffect`. Re-fetches on filter change. |
| `components/admin/FeedbackList.tsx` | Tabela de feedback rows. Filter bar acima (toggle 👍/👎/all, toggle resolvido, date range, has-comment). Renderiza `<FeedbackRow>` por item. Click seleciona id no parent. |
| `components/admin/FeedbackDetail.tsx` | Detail pane (right column ou modal). Mostra pergunta+resposta+chunks+comentário do item selecionado. Botão "Marcar como resolvido" (toggle). Layout escala com `<details>` per chunk (mesmo pattern do `ArticleDetail`). |
| `components/admin/TopQueries.tsx` | Lista compacta top-10 user queries last 30d com contagem à direita. Loading state simples. |

### Frontend — modificados

| Arquivo | Mudança |
|---|---|
| `components/admin/AdminSidebar.tsx` | Adicionar `{ href: '/admin/feedback', label: 'Feedback', Icon: MessageSquare }` no array `ITEMS`. Lucide `MessageSquare` import. |

### Sem alteração

- `lib/feedback.ts:recordFeedback` — entrada pública do feedback (sub-projeto 9), inalterado.
- RLS policies em `message_feedback` — owner-only continua válido pra usuário final. Admin sempre via service-role.
- `lib/observability/langfuse.ts:scoreTrace` — mirror Langfuse continua igual.

## Data flow

### Schema (migration `00000000000011_feedback_resolved.sql`)

```sql
-- Sub-projeto 14 — feedback review loop
alter table message_feedback
  add column resolved_at timestamptz;

-- Index para listagem rápida de não-resolvidos (caminho comum no admin)
create index message_feedback_unresolved_idx
  on message_feedback (created_at desc)
  where resolved_at is null;
```

Default null garante que rows existentes (qualquer feedback dado antes do sub-projeto 14) ficam como "não-resolvido" — comportamento esperado.

Não há mudança em RLS policies. Admin lê/escreve via service-role (`getServerSupabase()`).

### Listagem (`GET /api/admin/feedback`)

```ts
type ListItem = {
  id: string;
  trace_id: string;
  session_id: string;
  user_id: string;
  rating: 'up' | 'down';
  comment: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  user_email: string | null;        // joined from profiles_with_email
};
```

Implementação via `getServerSupabase()` chained query builder (sem JSONB extraction custosa por row):

```ts
let q = sb
  .from('message_feedback')
  .select('id, trace_id, session_id, user_id, rating, comment, created_at, updated_at, resolved_at, profiles_with_email!inner(email)')
  .order('created_at', { ascending: false });

if (filters.rating) q = q.eq('rating', filters.rating);
if (filters.resolved === false) q = q.is('resolved_at', null);
if (filters.resolved === true) q = q.not('resolved_at', 'is', null);
if (filters.from) q = q.gte('created_at', filters.from);
if (filters.to) q = q.lte('created_at', filters.to);
if (filters.hasComment === true) q = q.not('comment', 'is', null);

q = q.range(offset, offset + limit - 1);
const { data, error } = await q;
```

**Decisão de UX:** o preview da pergunta NÃO entra na listagem (evita JSONB subquery por row). Lista mostra: rating · email · primeiros 60 chars do `comment` (ou `(sem comentário)`) · data · badge `resolvido` se aplicável. **Pergunta + resposta + chunks aparecem só no detail pane** quando admin clica numa row. Em 👎 sem comentário, admin clica pra investigar; em 👍 com comentário, admin clica pra ler. Isso funciona porque comentário é o sinal denso (admin prioriza rows com comentário).

### Detail (derivado da lista, sem fetch extra v1)

Quando `selectedId` é set, `<FeedbackDetail>` busca a session completa (`select messages from sessions where id = ?`) e extrai pergunta + resposta + chunks varrendo o JSONB:
- User message: o user message anterior à assistant message do trace
- Assistant message: aquele cuja `annotations[].traceId === selectedItem.trace_id` (sub-projeto 9 já anota traceId em annotations)
- Chunks: `assistant.annotations[].sources` (sub-projeto 7+ formato)

```ts
type AssistantAnnotation = { traceId?: string; sources?: SourceRef[]; ... };
type SourceRef = { articleId: string; articleTitle: string; theme?: string; content?: string; ... };
```

Component renderiza:
- `<h3>Pergunta</h3><p>{question}</p>`
- `<h3>Resposta</h3><Markdown>{answer}</Markdown>`
- `<h3>Chunks usados ({sources.length})</h3>` lista de `<details>` (igual ArticleDetail) com badge de tema/kind
- `{comment && <h3>Comentário</h3><blockquote>{comment}</blockquote>}`
- Botão "✓ Marcar como resolvido" (ou "↶ Desmarcar" se já)

### Resolve (`POST /api/admin/feedback/[id]/resolve`)

```ts
// Body: { resolved: boolean }
// Returns: { ok: true, resolved_at: string | null }
// 404 se não-admin (NotAdmin), 500 em supabase error
```

Implementação trivial: `update message_feedback set resolved_at = $1 where id = $2`. Service-role.

### Top Queries (`GET /api/admin/feedback/top-queries?days=30&limit=10`)

```ts
type TopQueryItem = {
  content: string;
  count: number;
};
```

Query:
```sql
select
  m->>'content' as content,
  count(*)::int as count
from sessions s, jsonb_array_elements(s.messages) as m
where m->>'role' = 'user'
  and s.updated_at > now() - ($1 || ' days')::interval
group by content
order by count desc
limit $2;
```

`days` default 30, `limit` default 10. Service-role (admin pode ver queries de todos os users).

**Privacy nota:** o output do top-queries pode revelar perguntas individuais de usuários. Em single-tenant atual o admin = owner já tem acesso pleno. Se virar B2B, top-queries precisa ser per-tenant.

## Erro e edge cases

| Caso | Comportamento |
|---|---|
| Non-admin acessa `/admin/feedback` | `requireAdmin()` lança `NotAdmin` → 404 (pattern padrão) |
| Non-admin chama `GET /api/admin/feedback` | 404 |
| Body inválido em `POST .../resolve` | zod fail → 400 |
| Feedback id não existe | update afeta 0 rows → ok response (idempotent); UI re-fetch confirma |
| Session deletada (FK cascade já cuida) | `message_feedback` removida via cascade; row some da listagem |
| `sessions.messages` JSONB vazio | `question_preview` retorna null; UI mostra "(sem preview)" |
| `assistant.annotations[].traceId` não bate com `feedback.trace_id` | UI fallback: tenta usar último assistant message da session; se isso falhar, mostra "(detalhes não disponíveis)" |
| `top-queries` zero rows (corpus novo) | UI mostra "Sem queries nos últimos 30 dias" |
| Comentário com 1000 chars | já validado em `recordFeedback` (sub-projeto 9); admin vê o texto inteiro |
| Comentário com PII (email, CPF) | exibido em texto puro pro admin; documentado como caveat LGPD |

## Observabilidade

Sub-projeto 14 não estende Langfuse. Logs novos:
- `console.info` no GET feedback list: `[admin/feedback] listed N rows filters={...}` (sem expor user emails ou content full)
- `console.info` no resolve: `[admin/feedback] resolve id=${id.slice(0,8)} resolved=${bool}`
- `console.warn` em erro de query supabase

## Custo e latência

Zero custo OpenAI/Voyage/Cohere — tudo é DB query.

Latência:
- Lista paginada (50 itens default): ~50-150ms via JSONB extraction inline. Aceitável; se virar problema com 10K+ feedback rows, refatorar pra pré-extrair `question_preview` em coluna.
- Detail: 1 select de `sessions` por click (~20-50ms).
- Top queries: ~100-300ms com JSONB unnesting; aceitável até ~50K sessions. Adicionar materialized view em sub-projeto futuro se passar disso.

## Testing

### Vitest novos (~25 testes)

`tests/lib/feedback.admin.test.ts` (~5)
- `listFeedback({})` retorna todas; respeita pagination.
- `listFeedback({ rating: 'down' })` filtra.
- `listFeedback({ resolved: false })` retorna só não-resolvidos.
- `resolveFeedback(id, true)` seta `resolved_at`; segundo call com `false` zera.
- `topQueries(30, 10)` agrega corretamente; ordem desc por count.

`tests/api/admin/feedback.test.ts` (~5)
- non-admin → 404.
- admin GET retorna lista com shape esperado (zod schema da resposta).
- filtros via query string viram options pro `listFeedback`.
- pagination cursor funciona (cursor em formato date+id).
- supabase error → 500.

`tests/api/admin/feedback-resolve.test.ts` (~4)
- non-admin → 404.
- POST `{ resolved: true }` → resolved_at set.
- POST `{ resolved: false }` → resolved_at null.
- body inválido → 400.

`tests/api/admin/feedback-top-queries.test.ts` (~3)
- non-admin → 404.
- retorna array ordenado.
- aceita custom `days` e `limit` query params.

`tests/components/admin/FeedbackList.test.tsx` (~3)
- renderiza rows; rating mostra ícone correto.
- filter toggle dispara re-fetch.
- click no row chama `onSelect(id)`.

`tests/components/admin/FeedbackDetail.test.tsx` (~3)
- mostra pergunta, resposta, chunks quando session messages provida.
- botão resolve chama callback.
- comentário renderiza só se presente.

`tests/components/admin/TopQueries.test.tsx` (~2)
- renderiza top items com contagem.
- estado vazio mostra texto fallback.

### Pytest

Sem mudança.

### Eval

Sem mudança em `npm run rag:eval`. Sub-projeto 14 não toca pipeline RAG.

### Smoke manual (atualizar `docs/product/beta-smoke-test.md`)

- Beta user dá 👎 com comentário → aparece em `/admin/feedback` em ≤30s, com a pergunta e o comentário visíveis.
- Filtro "rating=down" remove os 👍 da lista.
- Filtro "resolved=false" remove rows resolvidos.
- Click num row mostra pergunta+resposta+chunks (com badges de tema do sub-projeto 12/13).
- Botão "Marcar como resolvido" persiste após F5; row some da view default.
- Top queries panel mostra as N perguntas mais frequentes; números fazem sentido vs uso real.

### Cobertura total estimada

- Vitest: ~287 → ~312 (+25)
- Pytest: 23 (sem mudança)
- Typecheck: zero erros mantido

## Variáveis de ambiente

Sem novas.

## Migrations

`supabase/migrations/00000000000011_feedback_resolved.sql` — adiciona `resolved_at timestamptz null` + index parcial.

## Critério de saída (tag `feedback-review-loop-complete`)

1. Migration `0011` aplicada via psycopg; coluna `resolved_at` existe; index `message_feedback_unresolved_idx` criado.
2. `lib/feedback.ts` ganha `listFeedback`/`resolveFeedback`/`topQueries` testados.
3. 3 endpoints `/api/admin/feedback/*` implementados, gated por `requireAdmin()`, validados com zod.
4. Página `/admin/feedback` renderiza 3 componentes funcionais; filtros funcionam; click em row abre detail; resolve persiste.
5. AdminSidebar tem entry "Feedback" linkando pra `/admin/feedback`.
6. ~25 vitest novos passam; CI verde (typecheck + vitest + pytest + rag:eval).
7. Smoke manual em `docs/product/beta-smoke-test.md` passa nos 6 itens.
8. CLAUDE.md atualizado com sub-projeto 14 row + gotchas (LGPD comentários, service-role pra admin, question_preview limitação).

## Riscos e mitigação

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Detail pane mostra pergunta errada (último user msg ≠ turno do feedback) | média | `<FeedbackDetail>` busca o assistant message com `annotations[].traceId === feedback.trace_id` e retorna o user message ANTERIOR (no array). Se o sub-projeto 9 anota traceId em annotations (ele faz), o mapping é exato. Fallback: último turno da session. |
| JSONB unnesting fica lento com 10K+ sessions | baixa | Aceitável até alguns milhares; se virar problema, materialized view ou coluna `last_user_query` em sessions. |
| Admin vê PII em comentário 👎 | média | Single-tenant atual = owner; LGPD coberto. Em B2B, isolation por tenant + masking opcional. Documentado em CLAUDE.md gotchas. |
| Cascading delete de session apaga feedback histórico | média | FK existente `on delete cascade` foi decisão sub-projeto 6b (LGPD erasure mecânica). Aceito. Se admin quiser preservar feedback após user deletion, schema change em sub-projeto futuro (e.g., snapshot de pergunta+resposta no row do feedback). |
| RLS owner-only impede admin de ver feedback de outros users via cookie-aware client | resolvido | `/api/admin/*` rotas usam `getServerSupabase()` (service-role) — pattern já estabelecido. Documentado em CLAUDE.md. |
| Top queries revela conteúdo de queries individuais (privacy) | baixa | Single-tenant. Doc'd. Em B2B, per-tenant isolation. |
| `resolved_at` toggle atrapalha auditoria | baixa | Não há audit log v1. Se admin quiser saber "quando isso foi marcado como resolvido", `resolved_at` próprio responde. Não saber QUEM marcou é OK porque single-admin. Em B2B, adicionar `resolved_by uuid`. |
| Beta user dá feedback baseado em answer com prompt cache stale | baixa | Não impacta sub-projeto 14; é problema do RAG. Admin lendo feedback consegue distinguir (resposta + chunks são preservados no JSONB). |

## Fora de escopo (futuro)

- Bulk resolve (multi-select + "marcar todos como resolvidos")
- Categorização de gap (theme do gap, severity, gap_description)
- Audit trail (quem resolveu, quando, com qual nota)
- Export CSV de feedback / queries
- Email semanal pro admin com top gaps
- Auto-flag baseado em padrão (queries que têm 3+ 👎 viram "high-priority gap")
- Dashboard analytics pesado (charts, trends, conversion funnels)
- Persist trace_id por turno em `sessions.messages` JSONB pra question_preview exato
- B2B isolation: per-tenant feedback scope
- Hard-negatives mining (Tier 2 do plano de aprendizado)
- Eval-driven threshold sweep (Tier 2)
- Reranker fine-tune (Tier 3)
- Personalização (per-user feedback patterns afetam retrieval)
