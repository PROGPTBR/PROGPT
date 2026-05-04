# Sub-projeto 8 — Beta Hardening (design)

**Milestone**: 2 — Beta Readiness
**Tag-alvo**: `beta-hardening-complete`
**Data**: 2026-05-03
**Roadmap**: `docs/product/beta-readiness.md`

## Contexto

ProcurementGPT está single-tenant, invite-only, com Milestone 1 fechado (sub-projetos 1–7). O próximo passo é abrir um beta fechado com 3–5 gestores convidados, coletando traces no Langfuse para escopar Milestone 3 (B2B) com dados reais. Antes de mandar o primeiro convite, precisamos:

1. Proteger orçamento de Gemini/Voyage/Cohere contra loops ou abuso.
2. Mostrar mensagens amigáveis quando algo falha (hoje o usuário vê erro cru no stream).
3. Garantir que `recall=0` ou recall com confiança baixa **não** faz o modelo alucinar.
4. Separar tráfego de beta dos meus testes locais nos dashboards do Langfuse.
5. Ter um checklist de fumaça antes de cada release de beta.

Este sub-projeto entrega exatamente esses 5 itens. Nada mais.

## Princípios

- **Não introduzir vendor novo se Postgres já resolve** — minimiza custo e superfície de auth/secret.
- **Manter prompt-builder simples** — toda decisão de "tem ou não tem fonte" continua expressa como `chunks.length === 0`. Threshold de confiança aplicado upstream (no reranker).
- **Defaults seguros** — `APP_ENV` ausente vira `production`, `LANGFUSE_*` ausentes mantêm no-op trace, biblioteca de toast falha graciosamente.

## Escopo

### 1. Rate limit em `/api/chat`

#### Storage: Postgres counter (não Upstash Redis)

**Tradeoffs considerados:**
- Upstash Redis: padrão da indústria, sliding window nativa, ~5–15ms overhead, mas adiciona vendor + secret.
- Postgres counter: ~10–30ms via PgBouncer, sem vendor novo, RLS-aware, dá para visualizar no `/admin/users` futuro.
- In-memory: descartado (serverless Vercel cria instâncias paralelas, contagem fica errada).

**Escolhido: Postgres.** Latência absorvida pela latência do RAG (>1s típico), custo zero adicional, mantém infra mínima durante beta.

#### Migration `00000000000007_rate_limits.sql`

```sql
create table rate_limit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  created_at timestamptz not null default now()
);
create index rate_limit_events_lookup on rate_limit_events(user_id, endpoint, created_at desc);

alter table rate_limit_events enable row level security;
-- Sem policies de SELECT/INSERT para clientes; só a function abaixo (security definer) acessa.

create or replace function check_rate_limit(p_endpoint text, p_per_min int, p_per_hour int)
returns table(allowed boolean, retry_after_secs int)
language plpgsql
security definer
as $$
declare
  v_user uuid := auth.uid();
  v_min_count int;
  v_hour_count int;
begin
  if v_user is null then
    return query select false, 60;
    return;
  end if;
  select count(*) into v_min_count from rate_limit_events
    where user_id = v_user and endpoint = p_endpoint and created_at > now() - interval '1 minute';
  select count(*) into v_hour_count from rate_limit_events
    where user_id = v_user and endpoint = p_endpoint and created_at > now() - interval '1 hour';
  if v_min_count >= p_per_min then
    return query select false, 60;
    return;
  end if;
  if v_hour_count >= p_per_hour then
    return query select false, 3600;
    return;
  end if;
  insert into rate_limit_events(user_id, endpoint) values (v_user, p_endpoint);
  -- Cleanup probabilístico: ~1% das chamadas remove eventos antigos.
  if random() < 0.01 then
    delete from rate_limit_events where created_at < now() - interval '2 hour';
  end if;
  return query select true, 0;
end$$;

revoke all on function check_rate_limit(text, int, int) from public;
grant execute on function check_rate_limit(text, int, int) to authenticated;
```

#### Limites beta

- **10 mensagens por minuto, 60 mensagens por hora, por `user_id`, no endpoint `chat`.**
- Constantes em `lib/rate-limit.ts`: `RATE_LIMIT_PER_MIN = 10`, `RATE_LIMIT_PER_HOUR = 60`.
- Se sub-projeto futuro precisar tier diferente por org, vira parâmetro de função; hoje ficam hardcoded.

#### Wrapper TS `lib/rate-limit.ts`

```ts
import { getServerSupabase } from '@/lib/db/supabase-server';

export const RATE_LIMIT_PER_MIN = 10;
export const RATE_LIMIT_PER_HOUR = 60;

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSecs: number };

export async function checkChatRateLimit(): Promise<RateLimitResult> {
  const sb = await getServerSupabase();
  const { data, error } = await sb.rpc('check_rate_limit', {
    p_endpoint: 'chat',
    p_per_min: RATE_LIMIT_PER_MIN,
    p_per_hour: RATE_LIMIT_PER_HOUR,
  });
  if (error || !data || data.length === 0) {
    // Fail-open: se RPC falha por algum motivo, deixa passar (logado), evita
    // shutdown total do produto por causa de uma mudança quebrada na RPC.
    console.warn('[rate-limit] RPC failed, fail-open:', error?.message);
    return { allowed: true };
  }
  const row = data[0]!;
  if (row.allowed) return { allowed: true };
  return { allowed: false, retryAfterSecs: row.retry_after_secs };
}
```

#### Integração em `app/api/chat/route.ts`

Antes de `startTrace`:

```ts
const user = await getCurrentUser();
if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });

const rl = await checkChatRateLimit();
if (!rl.allowed) {
  return Response.json(
    { error: 'rate_limited', retry_after_secs: rl.retryAfterSecs },
    { status: 429, headers: { 'Retry-After': String(rl.retryAfterSecs) } },
  );
}
```

Mudança importante: `/api/chat` passa a **exigir** auth (hoje aceita anônimo silenciosamente — middleware já gateia `/chat` então é improvável, mas explicitar não-mais-anônimo previne curl direto sem token).

### 2. Error boundary + toast amigável no `ChatSession`

#### Biblioteca: `sonner`

- Instalar `sonner` (~3KB).
- `<Toaster />` em `app/layout.tsx`, dentro do `ThemeProvider` para herdar dark/light.
- Componente shadcn-style em `components/ui/sonner.tsx` que importa de `sonner` e aplica classes Tailwind.

#### Detecção de erro no `useChat`

`useChat` (Vercel AI SDK) expõe:
- `onResponse(response: Response)` — chamado antes do parse, dá acesso a `status`.
- `onError(error: Error)` — chamado em qualquer falha (4xx, 5xx, abort).

Plano:

```tsx
const { messages, ..., error } = useChat({
  api: '/api/chat',
  // ...
  onResponse: async (res) => {
    if (res.status === 429) {
      const body = await res.clone().json().catch(() => ({}));
      const secs: number = typeof body.retry_after_secs === 'number' ? body.retry_after_secs : 60;
      const minutes = Math.max(1, Math.ceil(secs / 60));
      toast.error(`Limite de mensagens atingido. Tente novamente em ~${minutes} min.`);
    }
  },
  onError: (err) => {
    // 429 já foi tratado no onResponse; aqui é genérico.
    if (err.message.includes('rate_limited')) return;
    toast.error('Tivemos um problema. Tente enviar de novo.');
  },
});
```

#### React error boundary

Para erros de render fora do `useChat` (raros — typeof markdown bug etc.), envolver `<ChatSession/>` com um boundary inline manual de ~30 linhas em `components/chat/ChatRoot.tsx`. Sem nova dep `react-error-boundary` — é simples o suficiente para escrever direto.

```tsx
class ChatErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean}> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: Error) { console.error('[chat] render error:', err); }
  render() {
    if (this.state.hasError) {
      return <div className="p-8 text-center text-muted-foreground">Algo quebrou. <button onClick={() => this.setState({hasError: false})} className="underline">Tentar de novo</button></div>;
    }
    return this.props.children;
  }
}
```

### 3. Threshold de confiança no reranker

#### Mudança em `lib/rag/reranker.ts`

```ts
const MIN_RELEVANCE = 0.10;

export async function rerank(query: string, chunks: RetrievedChunk[], topN: number): Promise<RetrievedChunk[]> {
  if (chunks.length === 0) return [];
  try {
    const hits = await cohereRerank(query, chunks.map((c) => c.content), topN);
    const results: RetrievedChunk[] = [];
    for (const h of hits) {
      if (h.relevanceScore < MIN_RELEVANCE) continue;
      const src = chunks[h.index];
      if (src) results.push({ ...src, rerankScore: h.relevanceScore });
    }
    return results;
  } catch (err) {
    console.warn('[rag/reranker] Cohere failed, falling back to RRF order:', err);
    return chunks.slice(0, topN);
  }
}
```

Quando todos os chunks ficam abaixo do threshold, o reranker retorna `[]`, prompt-builder cai no `REFUSAL_INSTRUCTION` que já existe (`prompt-builder.ts:31`). Sem mudança no prompt-builder.

#### Span instrumentation

Em `lib/rag/index.ts` (orquestrador), passar `top1Score` para a span `rerank`:

```ts
const rerankSpan = trace.span('rerank', { count: candidates.length });
const reranked = await rerank(query, candidates, RERANK_TOP_N);
const top1 = reranked[0]?.rerankScore ?? null;
rerankSpan.end({ count: reranked.length, top1Score: top1 });
if (reranked.length === 0) trace.setTag('low-confidence');
```

#### Threshold validation

- Default `MIN_RELEVANCE = 0.10` (Cohere v3 produz scores 0–1; <0.1 é tipicamente noise empírico).
- **Gate de release**: `npm run rag:eval` precisa manter `recall@5 ≥ 0.85`. Se cair, baixar para 0.08 e re-rodar.
- Sem ajuste por classificação ainda (smalltalk/comparison/teoria) — adicionar se virar dor depois.

### 4. Tag dinâmica `env:<env>` nos traces

#### Variável de ambiente

- `APP_ENV` (server-side, **não** `NEXT_PUBLIC_*`).
- Valores aceitos: `local | beta | production | ci`.
- Default `production` se ausente, para segurança.

#### Mudança em `app/api/chat/route.ts`

```ts
const env = process.env.APP_ENV ?? 'production';
const trace = await startTrace({
  name: 'chat.turn',
  userId,
  sessionId: parsed.sessionId,
  input: { messages },
  tags: [`env:${env}`],
});
```

`scripts/eval/run.ts` continua passando `tags: ['env:ci']` explicitamente (já hoje), sem mudança.

#### Adições

- `.env.local.example` ganha `APP_ENV=local`.
- `CLAUDE.md` documenta os 4 valores e onde configurar.
- Vercel deploy de beta: configurar `APP_ENV=beta` manualmente (lembrete no checklist).

### 5. Smoke test pré-beta

Markdown checklist em `docs/product/beta-smoke-test.md`. Roda manualmente antes de cada release de beta. Cobertura mínima:

- Login email/senha
- Login Google OAuth
- Magic link de invite (criar e clicar)
- `/forgot-password` → reset → login
- `/chat` desktop dark/light/system
- `/chat` mobile (drawer abre/fecha)
- Sessão expirada (deletar cookie no DevTools mid-session, mandar mensagem, ver redirect para `/login`)
- Refresh durante streaming (ver mensagem incompleta marcada como erro ou removida)
- Stop button mid-streaming
- `recall=0`: pergunta fora do escopo ("o que você sabe sobre origami?") deve receber recusa explícita
- Rate limit: mandar 11 mensagens em 1 min, ver toast "Limite atingido"
- `/admin` para admin: tabelas users/articles/ingest carregam
- `/admin` para non-admin: 404

Não-automatizado por escolha — automação Playwright só vale a pena se o checklist virar dor após Milestone 3.

## Não-objetivos

Para deixar explícito o que **não** entra neste sub-projeto:

- Tier de rate limit por org/plan — Milestone 3.
- Quotas de tokens/custo (só msgs por janela) — Milestone 3.
- Status page pública — Milestone 3+.
- Truncamento de conversa longa — observar via Langfuse, decidir depois.
- Vídeo de onboarding ou banner "estamos em beta" — Milestone 3+ ou nunca.
- Testes E2E com Playwright — checklist humano resolve no beta.

## Mudanças de arquivos (lista completa)

**Novos:**
- `supabase/migrations/00000000000007_rate_limits.sql`
- `lib/rate-limit.ts`
- `components/ui/sonner.tsx`
- `docs/product/beta-smoke-test.md`

**Modificados:**
- `app/api/chat/route.ts` — auth obrigatório, rate limit, tag dinâmica
- `lib/rag/reranker.ts` — threshold `MIN_RELEVANCE`
- `lib/rag/index.ts` — instrumentação `top1Score` na span rerank, tag `low-confidence`
- `app/layout.tsx` — montar `<Toaster />`
- `components/chat/ChatSession.tsx` — `onResponse`/`onError` + toast
- `components/chat/ChatRoot.tsx` — `ChatErrorBoundary` envolvendo `<ChatSession/>`
- `package.json` — `+sonner`
- `.env.local.example` — `+APP_ENV=local`
- `CLAUDE.md` — gotchas (rate-limit RPC, threshold reranker, APP_ENV, sonner)

## Testes

**vitest:**
- `lib/rate-limit.test.ts` — mock supabase RPC, cobre allowed/blocked/RPC-failure (fail-open).
- `lib/rag/reranker.test.ts` — chunks vazios após threshold, score abaixo de threshold filtrados, fallback se Cohere quebra.
- `components/chat/ChatSession.test.tsx` — render base, toast em 429 (mock fetch), toast em 500.

**rag:eval:**
- Rodar localmente após mudança no reranker. Aceitar se `recall@5 ≥ 0.85`. Se cair, ajustar threshold para 0.08 e re-rodar; se cair ainda, voltar para 0.0 (sem threshold) e abrir tarefa para Milestone 3 com tuning empírico.

**pytest:**
- Sem mudanças (não toca em Python).

## Critério de "sub-projeto pronto"

- [ ] Migration 0007 aplicada no Supabase de prod (manual via dashboard ou `db push`)
- [ ] Auth obrigatório em `/api/chat` (curl sem cookie retorna 401)
- [ ] Rate limit funciona end-to-end (mandar 11 msgs/min via UI, ver 429 + toast)
- [ ] `APP_ENV=beta` configurado no Vercel beta deployment
- [ ] Span `rerank` mostra `top1Score` e `count` em traces no Langfuse
- [ ] Pergunta fora do escopo ("o que você sabe sobre origami?") retorna recusa explícita
- [ ] `npm run rag:eval` passa com `recall@5 ≥ 0.85`
- [ ] `npm test` passa
- [ ] `npm run typecheck` passa
- [ ] `docs/product/beta-smoke-test.md` checklist segue marcável
- [ ] CLAUDE.md atualizado com novos gotchas
- [ ] Tag `beta-hardening-complete` aplicada no commit final

## Riscos / decisões deferidas

- **Threshold 0.10 é chute empírico** — confirmar via eval antes de release; se cair muito, ajustar.
- **`security definer` na RPC** — necessário porque RLS bloqueia inserts diretos do user; função explicitamente checa `auth.uid()` e só insere para o próprio user.
- **Cleanup probabilístico** — pode crescer se tracking ficar pesado; com 5 users beta a 60/h, ~36k rows/dia × 2h cleanup window = aceitável. Em Milestone 3 virar pg_cron job.
- **Vercel `APP_ENV=beta`** — config manual do user no dashboard é parte do checklist; sem isso, beta usa tag `production` por default.
- **`useChat` `onResponse` API stability** — Vercel AI SDK v4 documenta esse callback; se mudar em v5, ajustar.

## Próximo passo

Após aprovação do spec, invocar `superpowers:writing-plans` para gerar plan executável (TDD + subagent-driven).
