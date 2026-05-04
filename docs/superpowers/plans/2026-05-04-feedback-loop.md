# Feedback Loop Implementation Plan (Sub-projeto 9)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 👍/👎 feedback (with optional comment) to every assistant message, persist it RLS-protected in Postgres, mirror it to Langfuse via `score()`, and expose a generic feedback mailto link in the header — so beta traces gain quantitative quality signal.

**Architecture:** The Langfuse trace ID (one per `chat.turn`) is the canonical anchor — the `/api/chat` route exposes it via the existing `appendMessageAnnotation` channel; the client passes it back to `/api/feedback`, which UPSERTs into `message_feedback` (UNIQUE on `(user_id, trace_id)`) and fires a Langfuse `score()` call fire-and-forget. UI lives in a new `MessageActions` component rendered by `Message.tsx` only when the message has both `traceId` and `sessionId`. Reload restores ratings via a separate fetch in `useChatSessionsRemote`.

**Tech Stack:** Next.js 14 App Router (Node runtime on `/api/feedback`), Supabase (Postgres + Auth + RLS), Vercel AI SDK v4 annotations, `langfuse@3.38.20` `score()` API, `sonner` for toasts (mounted in sub-projeto 8), `lucide-react` `ThumbsUp`/`ThumbsDown`/`MessageSquareText`, vitest, TypeScript strict.

**Spec:** `docs/superpowers/specs/2026-05-04-feedback-loop-design.md`

---

## File Structure

**New files:**
- `supabase/migrations/00000000000008_message_feedback.sql` — table + RLS + index
- `lib/feedback.ts` — server-side helper `recordFeedback()` (UPSERT + fire-and-forget score)
- `tests/lib/feedback.test.ts` — vitest unit tests for the helper
- `app/api/feedback/route.ts` — POST handler, Node runtime
- `tests/api/feedback.test.ts` — route-level tests (auth, validation, RLS, score wiring)
- `components/chat/MessageActions.tsx` — 👍/👎 + optional comment textarea
- `tests/components/chat/MessageActions.test.tsx` — render + click flows + error rollback
- `tests/lib/observability/langfuse.test.ts` — covers `Trace.id` + `scoreTrace`

**Modified files:**
- `lib/observability/types.ts` — add `id: string` to `Trace`
- `lib/observability/langfuse.ts` — populate `id` (real or `crypto.randomUUID()` no-op fallback) + add `scoreTrace()`
- `app/api/chat/route.ts` — annotation gains `traceId: trace.id`
- `components/chat/Message.tsx` — render `<MessageActions/>` when assistant + !isStreaming + traceId + sessionId
- `components/chat/MessageList.tsx` — extract `traceId` from annotations, pass `sessionId` and `initialRatings` down
- `components/chat/ChatSession.tsx` — preserve `annotations` when mapping messages, forward `sessionId` + `initialRatings`
- `components/chat/Header.tsx` — feedback mailto link before the theme button
- `hooks/useChatSessions.ts` — extend `UseChatSessions` type with optional `ratings?: Map<string, 'up'|'down'>`
- `hooks/useChatSessionsRemote.ts` — fetch ratings for current session, expose via `ratings` field
- `CLAUDE.md` — sub-projeto 9 row + Milestone 2 progress + new gotchas

---

## Conventions

- **Test runner:** `npm test` (vitest run, all suites). Single file: `npm test -- tests/lib/feedback.test.ts`. Use `vi.doMock` + `vi.resetModules()` for module-level mocks (canonical pattern in `tests/api/chat.test.ts` and `tests/lib/cohere.test.ts`).
- **Component tests:** require `// @vitest-environment jsdom` directive on line 1 (config defaults to `node`); use `expect(...).toBeDefined()` instead of jest-dom matchers (project doesn't register the setup file). See `tests/components/chat/Composer.test.tsx`.
- **DB client (server):** `supabaseServer()` from `@/lib/db/supabase-server` (NOT `getServerSupabase`).
- **DB client (browser):** `supabaseBrowser()` from `@/lib/db/supabase-browser`.
- **Auth:** `getCurrentUser()` returns `User | null`; `requireUser()` throws `NotAuthenticated`.
- **Migrations:** sequential 14-digit prefix; next number is `00000000000008`.
- **Commits:** atomic per task. Format `<type>(<scope>): <subject>` with `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` footer.
- **Branch:** `main` (project pattern — sub-projeto 8 also went direct to main).
- **Tag at end:** after Task 11 passes locally + CI, apply `feedback-loop-complete`.

---

## Task 1: Migration 0008 — `message_feedback` table

**Files:**
- Create: `supabase/migrations/00000000000008_message_feedback.sql`

- [ ] **Step 1: Write the migration file**

Write to `supabase/migrations/00000000000008_message_feedback.sql`:

```sql
-- Sub-projeto 9: per-trace user feedback (👍/👎 + optional comment).
-- Anchored on the Langfuse trace_id (one per chat.turn) rather than message_id
-- because /api/chat does not persist message ids in the JSONB messages column.

create table message_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references sessions(id) on delete cascade,
  trace_id text not null,
  rating text not null check (rating in ('up','down')),
  comment text check (length(comment) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, trace_id)
);

create index message_feedback_lookup
  on message_feedback(user_id, session_id, created_at desc);

alter table message_feedback enable row level security;

create policy mf_select_own on message_feedback
  for select using (auth.uid() = user_id);
create policy mf_insert_own on message_feedback
  for insert with check (auth.uid() = user_id);
create policy mf_update_own on message_feedback
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy mf_delete_own on message_feedback
  for delete using (auth.uid() = user_id);
```

- [ ] **Step 2: Skip applying — manual via dashboard later**

Do NOT run `npm run db:migrate`. The user applies it as part of Task 11 prereqs (same as sub-projeto 8 Task 1). Just create the file and commit.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00000000000008_message_feedback.sql
git commit -m "$(cat <<'EOF'
feat(db): add message_feedback table + owner-only RLS (sub-projeto 9)

UNIQUE(user_id, trace_id) supports UPSERT semantics so 👍→👎 flips a
single row. FK cascades to auth.users + sessions for LGPD erasure.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Expose `Trace.id` + add `scoreTrace()` (TDD)

**Files:**
- Modify: `lib/observability/types.ts`
- Modify: `lib/observability/langfuse.ts`
- Create: `tests/lib/observability/langfuse.test.ts`

- [ ] **Step 1: Write the failing test**

Write to `tests/lib/observability/langfuse.test.ts`:

```ts
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

const ORIGINAL_KEYS = {
  pub: process.env.LANGFUSE_PUBLIC_KEY,
  sec: process.env.LANGFUSE_SECRET_KEY,
};

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  process.env.LANGFUSE_PUBLIC_KEY = ORIGINAL_KEYS.pub;
  process.env.LANGFUSE_SECRET_KEY = ORIGINAL_KEYS.sec;
});

describe('startTrace', () => {
  it('returns a no-op trace with a UUID id when keys are missing', async () => {
    delete process.env.LANGFUSE_PUBLIC_KEY;
    delete process.env.LANGFUSE_SECRET_KEY;
    const { startTrace } = await import('@/lib/observability/langfuse');
    const t = await startTrace({ name: 'test' });
    expect(t.id).toMatch(/^[0-9a-f-]{36}$/i);
    // span/end/setTag/setMetadata should all be no-ops without throwing
    t.span('s').end({});
    t.setTag('x');
    t.setMetadata('k', 'v');
    t.end();
  });

  it('exposes the Langfuse trace id when keys are present', async () => {
    process.env.LANGFUSE_PUBLIC_KEY = 'pub';
    process.env.LANGFUSE_SECRET_KEY = 'sec';
    vi.doMock('langfuse', () => ({
      Langfuse: vi.fn().mockImplementation(() => ({
        trace: vi.fn(() => ({
          id: 'lf-trace-abc',
          update: vi.fn(),
          span: vi.fn(() => ({ end: vi.fn() })),
        })),
        flushAsync: vi.fn().mockResolvedValue(undefined),
      })),
    }));
    const { startTrace } = await import('@/lib/observability/langfuse');
    const t = await startTrace({ name: 'test' });
    expect(t.id).toBe('lf-trace-abc');
  });
});

describe('scoreTrace', () => {
  it('is a no-op when keys are missing', async () => {
    delete process.env.LANGFUSE_PUBLIC_KEY;
    delete process.env.LANGFUSE_SECRET_KEY;
    const { scoreTrace } = await import('@/lib/observability/langfuse');
    await expect(
      scoreTrace({ traceId: 't1', name: 'user-feedback', value: 1 }),
    ).resolves.toBeUndefined();
  });

  it('calls Langfuse.score with the right body and flushes', async () => {
    process.env.LANGFUSE_PUBLIC_KEY = 'pub';
    process.env.LANGFUSE_SECRET_KEY = 'sec';
    const score = vi.fn();
    const flushAsync = vi.fn().mockResolvedValue(undefined);
    vi.doMock('langfuse', () => ({
      Langfuse: vi.fn().mockImplementation(() => ({
        trace: vi.fn(() => ({
          id: 'tx',
          update: vi.fn(),
          span: vi.fn(() => ({ end: vi.fn() })),
        })),
        score,
        flushAsync,
      })),
    }));
    const { startTrace, scoreTrace } = await import('@/lib/observability/langfuse');
    // Warm the cached client via startTrace (same path the route uses).
    await startTrace({ name: 'warm' });
    await scoreTrace({ traceId: 't1', name: 'user-feedback', value: -1, comment: 'meh' });
    expect(score).toHaveBeenCalledWith({
      traceId: 't1',
      name: 'user-feedback',
      value: -1,
      comment: 'meh',
    });
    expect(flushAsync).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/lib/observability/langfuse.test.ts`
Expected: FAIL — `t.id` is undefined; `scoreTrace` is not exported.

- [ ] **Step 3: Update `lib/observability/types.ts`**

Replace the file with:

```ts
export type TraceLevel = 'DEFAULT' | 'WARNING' | 'ERROR';

export interface Span {
  end(output?: unknown, level?: TraceLevel): void;
}

export interface Trace {
  id: string;
  span(name: string, input?: unknown): Span;
  end(output?: unknown, level?: TraceLevel): void;
  setMetadata(key: string, value: unknown): void;
  setTag(tag: string): void;
}
```

- [ ] **Step 4: Update `lib/observability/langfuse.ts`**

Replace the file with:

```ts
import type { Trace, Span, TraceLevel } from './types';

const NOOP_SPAN: Span = { end() {} };

let cachedClient: {
  trace: (opts: unknown) => unknown;
  score: (body: unknown) => unknown;
  flushAsync: () => Promise<void>;
} | null = null;

async function getClient(): Promise<NonNullable<typeof cachedClient> | null> {
  const secret = process.env.LANGFUSE_SECRET_KEY;
  const pub = process.env.LANGFUSE_PUBLIC_KEY;
  if (!secret || !pub) return null;
  if (!cachedClient) {
    const { Langfuse } = await import('langfuse');
    cachedClient = new Langfuse({
      secretKey: secret,
      publicKey: pub,
      baseUrl: process.env.LANGFUSE_BASE_URL ?? 'https://cloud.langfuse.com',
    }) as unknown as typeof cachedClient;
  }
  return cachedClient;
}

export async function startTrace(opts: {
  name: string;
  userId?: string;
  sessionId?: string;
  input?: unknown;
  tags?: string[];
  metadata?: Record<string, unknown>;
}): Promise<Trace> {
  const client = await getClient();
  if (!client) {
    const localId = (globalThis.crypto?.randomUUID ?? (() => 'noop-' + Math.random()))();
    return {
      id: localId,
      span: () => NOOP_SPAN,
      end: () => {},
      setMetadata: () => {},
      setTag: () => {},
    };
  }

  const lfTrace = client.trace({
    name: opts.name,
    userId: opts.userId,
    sessionId: opts.sessionId,
    input: opts.input,
    tags: opts.tags,
    metadata: opts.metadata,
  }) as {
    id: string;
    update: (p: unknown) => void;
    span: (p: unknown) => { end: (p: unknown) => void };
  };

  return {
    id: lfTrace.id,
    span(name, input) {
      const lfSpan = lfTrace.span({ name, input });
      return {
        end(output, level) {
          lfSpan.end({ output, level });
        },
      };
    },
    end(output, level) {
      lfTrace.update({ output, level });
    },
    setMetadata(key, value) {
      lfTrace.update({ metadata: { [key]: value } });
    },
    setTag(tag) {
      lfTrace.update({ tags: [tag] });
    },
  };
}

export async function scoreTrace(opts: {
  traceId: string;
  name: string;
  value: number;
  comment?: string;
}): Promise<void> {
  const client = await getClient();
  if (!client) return;
  client.score({
    traceId: opts.traceId,
    name: opts.name,
    value: opts.value,
    comment: opts.comment,
  });
  await client.flushAsync();
}

export async function flushAsync(): Promise<void> {
  if (!cachedClient) return;
  await cachedClient.flushAsync();
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- tests/lib/observability/langfuse.test.ts`
Expected: 4 passing.

- [ ] **Step 6: Run full vitest + typecheck**

Run: `npm test && npm run typecheck`
Expected: zero failures, zero type errors. The `Trace.id` addition is a structural change — any existing mock of `Trace` in other tests (e.g., `tests/api/chat.test.ts` `NOOP_TRACE`) needs an `id`. Update those mocks if typecheck or tests fail by adding `id: 'mock-trace'` to the mock object.

- [ ] **Step 7: Update existing trace mocks if needed**

Search for objects that mock the `Trace` interface:

Run: `grep -rln "NOOP_TRACE\b\|setMetadata: vi.fn" tests/`

For each match (likely `tests/api/chat.test.ts`), add `id: 'mock-trace-id',` as the first property of the mock object. Re-run `npm test` and confirm green.

- [ ] **Step 8: Commit**

```bash
git add lib/observability/types.ts lib/observability/langfuse.ts tests/lib/observability/langfuse.test.ts tests/api/chat.test.ts
git commit -m "$(cat <<'EOF'
feat(observability): expose Trace.id + add scoreTrace (sub-projeto 9)

Trace.id surfaces the Langfuse trace identifier (or a local UUID when keys
are absent) so /api/chat can ship it to the client via stream annotation.
scoreTrace is a fire-and-forget wrapper around langfuse.score, used by
/api/feedback to mirror 👍/👎 into Langfuse dashboards. Existing trace mocks
extended with the new id field.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `/api/chat` annotation includes `traceId`

**Files:**
- Modify: `app/api/chat/route.ts`
- Modify: `tests/api/chat.test.ts`

- [ ] **Step 1: Add a failing test**

Open `tests/api/chat.test.ts`. Find the existing happy-path test ("orchestrates condenser..." or similar that exercises `streamText` and calls `appendMessageAnnotation`). Modify the assertion that checks the annotation payload (or add a new `expect`) to verify the annotation includes `traceId: 'mock-trace-id'`. Specifically, locate the captured `appendMessageAnnotation` mock and add:

```ts
expect(appendMessageAnnotation).toHaveBeenCalledWith(
  expect.objectContaining({
    traceId: 'mock-trace-id',
  }),
);
```

If the test does not currently capture `appendMessageAnnotation`, refactor the local `StreamData` mock to expose it:

```ts
const appendMessageAnnotation = vi.fn();
vi.doMock('ai', () => ({
  streamText: vi.fn(/* existing impl */),
  StreamData: class {
    appendMessageAnnotation = appendMessageAnnotation;
    close = vi.fn();
  },
}));
```

Make sure the `NOOP_TRACE` (or trace mock) used by this test has `id: 'mock-trace-id'`.

- [ ] **Step 2: Run the test**

Run: `npm test -- tests/api/chat.test.ts`
Expected: the new assertion FAILS — annotation currently lacks `traceId`.

- [ ] **Step 3: Update `app/api/chat/route.ts`**

Find the block that builds the `StreamData` annotation (around lines 79–84 of the post-Task-3-of-sub-projeto-8 file) and replace it with:

```ts
    const data = new StreamData();
    data.appendMessageAnnotation({
      sources: rag.sources,
      classification: rag.classification,
      debug: rag.debug,
      traceId: trace.id,
    });
```

Single-line addition: `traceId: trace.id,`. Leave everything else in the route untouched.

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/api/chat.test.ts`
Expected: all chat tests pass.

- [ ] **Step 5: Run full suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: zero failures, zero type errors.

- [ ] **Step 6: Commit**

```bash
git add app/api/chat/route.ts tests/api/chat.test.ts
git commit -m "$(cat <<'EOF'
feat(api/chat): publish traceId in stream annotation (sub-projeto 9)

Lets the client read the Langfuse trace id from the AI SDK message
annotation and use it as the anchor for the upcoming feedback POST.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `lib/feedback.ts` server helper (TDD)

**Files:**
- Create: `lib/feedback.ts`
- Create: `tests/lib/feedback.test.ts`

- [ ] **Step 1: Write the failing test**

Write to `tests/lib/feedback.test.ts`:

```ts
import { describe, expect, it, beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

function mockSupabase(opts: { selectResult?: unknown; upsertError?: unknown } = {}) {
  const select = vi.fn().mockResolvedValue({
    data: opts.selectResult ?? { id: 'sess-1' },
    error: null,
  });
  const single = vi.fn().mockResolvedValue({
    data: opts.selectResult ?? { id: 'sess-1' },
    error: null,
  });
  const upsert = vi.fn().mockResolvedValue({ error: opts.upsertError ?? null });

  const from = vi.fn((table: string) => {
    if (table === 'sessions') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: single,
            })),
          })),
        })),
      };
    }
    if (table === 'message_feedback') {
      return { upsert };
    }
    throw new Error(`unexpected table ${table}`);
  });

  vi.doMock('@/lib/db/supabase-server', () => ({
    supabaseServer: () => ({ from }),
  }));
  return { upsert, single };
}

describe('recordFeedback', () => {
  it('returns { ok: false, status: 404 } when the session does not belong to the user', async () => {
    mockSupabase({ selectResult: null });
    vi.doMock('@/lib/observability/langfuse', () => ({
      scoreTrace: vi.fn(),
    }));
    const { recordFeedback } = await import('@/lib/feedback');
    const r = await recordFeedback({
      userId: 'u1',
      sessionId: '11111111-1111-1111-1111-111111111111',
      traceId: 'tr-1',
      rating: 'up',
    });
    expect(r).toEqual({ ok: false, status: 404 });
  });

  it('UPSERTs the row and fires scoreTrace with value=1 on 👍', async () => {
    const { upsert } = mockSupabase();
    const scoreTrace = vi.fn().mockResolvedValue(undefined);
    vi.doMock('@/lib/observability/langfuse', () => ({ scoreTrace }));
    const { recordFeedback } = await import('@/lib/feedback');
    const r = await recordFeedback({
      userId: 'u1',
      sessionId: 'sess-1',
      traceId: 'tr-1',
      rating: 'up',
    });
    expect(r).toEqual({ ok: true });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'u1',
        session_id: 'sess-1',
        trace_id: 'tr-1',
        rating: 'up',
      }),
      expect.objectContaining({ onConflict: 'user_id,trace_id' }),
    );
    expect(scoreTrace).toHaveBeenCalledWith(
      expect.objectContaining({ traceId: 'tr-1', name: 'user-feedback', value: 1 }),
    );
  });

  it('fires scoreTrace with value=-1 and comment on 👎+comment', async () => {
    mockSupabase();
    const scoreTrace = vi.fn().mockResolvedValue(undefined);
    vi.doMock('@/lib/observability/langfuse', () => ({ scoreTrace }));
    const { recordFeedback } = await import('@/lib/feedback');
    await recordFeedback({
      userId: 'u1',
      sessionId: 'sess-1',
      traceId: 'tr-1',
      rating: 'down',
      comment: 'irrelevante',
    });
    expect(scoreTrace).toHaveBeenCalledWith({
      traceId: 'tr-1',
      name: 'user-feedback',
      value: -1,
      comment: 'irrelevante',
    });
  });

  it('still returns ok when scoreTrace throws (Langfuse failure does not block DB save)', async () => {
    mockSupabase();
    vi.doMock('@/lib/observability/langfuse', () => ({
      scoreTrace: vi.fn().mockRejectedValue(new Error('langfuse down')),
    }));
    const { recordFeedback } = await import('@/lib/feedback');
    const r = await recordFeedback({
      userId: 'u1',
      sessionId: 'sess-1',
      traceId: 'tr-1',
      rating: 'up',
    });
    expect(r).toEqual({ ok: true });
  });

  it('returns { ok: false, status: 500 } when the UPSERT fails', async () => {
    mockSupabase({ upsertError: { message: 'db boom' } });
    vi.doMock('@/lib/observability/langfuse', () => ({ scoreTrace: vi.fn() }));
    const { recordFeedback } = await import('@/lib/feedback');
    const r = await recordFeedback({
      userId: 'u1',
      sessionId: 'sess-1',
      traceId: 'tr-1',
      rating: 'up',
    });
    expect(r).toEqual({ ok: false, status: 500 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/lib/feedback.test.ts`
Expected: FAIL — `recordFeedback` not found.

- [ ] **Step 3: Write `lib/feedback.ts`**

```ts
import { supabaseServer } from '@/lib/db/supabase-server';
import { scoreTrace } from '@/lib/observability/langfuse';

export type FeedbackInput = {
  userId: string;
  sessionId: string;
  traceId: string;
  rating: 'up' | 'down';
  comment?: string;
};

export type FeedbackResult =
  | { ok: true }
  | { ok: false; status: 404 | 500 };

export async function recordFeedback(input: FeedbackInput): Promise<FeedbackResult> {
  const sb = supabaseServer();

  // Defense-in-depth on top of RLS: confirm the session belongs to this user
  // before writing a feedback row that references it. RLS would also block the
  // upsert via the foreign key chain, but a clean 404 beats an opaque 500.
  const { data: session } = await sb
    .from('sessions')
    .select('id')
    .eq('id', input.sessionId)
    .eq('user_id', input.userId)
    .maybeSingle();
  if (!session) {
    return { ok: false, status: 404 };
  }

  const { error } = await sb
    .from('message_feedback')
    .upsert(
      {
        user_id: input.userId,
        session_id: input.sessionId,
        trace_id: input.traceId,
        rating: input.rating,
        comment: input.comment ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,trace_id' },
    );
  if (error) {
    console.error('[feedback] upsert failed:', error.message);
    return { ok: false, status: 500 };
  }

  // Mirror to Langfuse fire-and-forget; failures are logged, not propagated.
  void scoreTrace({
    traceId: input.traceId,
    name: 'user-feedback',
    value: input.rating === 'up' ? 1 : -1,
    comment: input.comment,
  }).catch((err) => {
    console.warn('[feedback] scoreTrace failed:', err);
  });

  return { ok: true };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/lib/feedback.test.ts`
Expected: 5 passing.

- [ ] **Step 5: Run full suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: zero failures, zero type errors.

- [ ] **Step 6: Commit**

```bash
git add lib/feedback.ts tests/lib/feedback.test.ts
git commit -m "$(cat <<'EOF'
feat(feedback): add recordFeedback server helper (sub-projeto 9)

UPSERTs into message_feedback (ON CONFLICT user_id,trace_id) and fires
scoreTrace fire-and-forget so Langfuse failures never block the DB save.
Pre-checks session ownership for clean 404 instead of opaque 500.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `/api/feedback` POST route (TDD)

**Files:**
- Create: `app/api/feedback/route.ts`
- Create: `tests/api/feedback.test.ts`

- [ ] **Step 1: Write the failing test**

Write to `tests/api/feedback.test.ts`:

```ts
import { describe, expect, it, beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

function makeReq(body: unknown): Request {
  return new Request('http://localhost/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const VALID = {
  sessionId: '11111111-1111-1111-1111-111111111111',
  traceId: 'tr-abc',
  rating: 'up' as const,
};

describe('POST /api/feedback', () => {
  it('returns 401 when no authenticated user', async () => {
    vi.doMock('@/lib/auth', () => ({ getCurrentUser: vi.fn().mockResolvedValue(null) }));
    vi.doMock('@/lib/feedback', () => ({ recordFeedback: vi.fn() }));
    const { POST } = await import('@/app/api/feedback/route');
    const res = await POST(makeReq(VALID));
    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid body (rating outside enum)', async () => {
    vi.doMock('@/lib/auth', () => ({
      getCurrentUser: vi.fn().mockResolvedValue({ id: 'u1' }),
    }));
    vi.doMock('@/lib/feedback', () => ({ recordFeedback: vi.fn() }));
    const { POST } = await import('@/app/api/feedback/route');
    const res = await POST(makeReq({ ...VALID, rating: 'meh' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when comment > 1000 chars', async () => {
    vi.doMock('@/lib/auth', () => ({
      getCurrentUser: vi.fn().mockResolvedValue({ id: 'u1' }),
    }));
    vi.doMock('@/lib/feedback', () => ({ recordFeedback: vi.fn() }));
    const { POST } = await import('@/app/api/feedback/route');
    const res = await POST(makeReq({ ...VALID, comment: 'x'.repeat(1001) }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when recordFeedback reports session not owned', async () => {
    vi.doMock('@/lib/auth', () => ({
      getCurrentUser: vi.fn().mockResolvedValue({ id: 'u1' }),
    }));
    vi.doMock('@/lib/feedback', () => ({
      recordFeedback: vi.fn().mockResolvedValue({ ok: false, status: 404 }),
    }));
    const { POST } = await import('@/app/api/feedback/route');
    const res = await POST(makeReq(VALID));
    expect(res.status).toBe(404);
  });

  it('returns 204 on success and forwards the input to recordFeedback', async () => {
    const recordFeedback = vi.fn().mockResolvedValue({ ok: true });
    vi.doMock('@/lib/auth', () => ({
      getCurrentUser: vi.fn().mockResolvedValue({ id: 'u1' }),
    }));
    vi.doMock('@/lib/feedback', () => ({ recordFeedback }));
    const { POST } = await import('@/app/api/feedback/route');
    const res = await POST(makeReq({ ...VALID, rating: 'down', comment: 'meh' }));
    expect(res.status).toBe(204);
    expect(recordFeedback).toHaveBeenCalledWith({
      userId: 'u1',
      sessionId: VALID.sessionId,
      traceId: VALID.traceId,
      rating: 'down',
      comment: 'meh',
    });
  });

  it('returns 500 when recordFeedback reports DB failure', async () => {
    vi.doMock('@/lib/auth', () => ({
      getCurrentUser: vi.fn().mockResolvedValue({ id: 'u1' }),
    }));
    vi.doMock('@/lib/feedback', () => ({
      recordFeedback: vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    }));
    const { POST } = await import('@/app/api/feedback/route');
    const res = await POST(makeReq(VALID));
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/api/feedback.test.ts`
Expected: FAIL — route file does not exist.

- [ ] **Step 3: Write `app/api/feedback/route.ts`**

```ts
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { recordFeedback } from '@/lib/feedback';

export const runtime = 'nodejs';

const Body = z.object({
  sessionId: z.string().uuid(),
  traceId: z.string().min(1).max(200),
  rating: z.enum(['up', 'down']),
  comment: z.string().max(1000).optional(),
});

export async function POST(req: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  let parsed;
  try {
    const json = await req.json();
    parsed = Body.parse(json);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'invalid body' },
      { status: 400 },
    );
  }

  const result = await recordFeedback({
    userId: user.id,
    sessionId: parsed.sessionId,
    traceId: parsed.traceId,
    rating: parsed.rating,
    comment: parsed.comment,
  });

  if (!result.ok) {
    return Response.json({ error: 'feedback failed' }, { status: result.status });
  }

  return new Response(null, { status: 204 });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/api/feedback.test.ts`
Expected: 6 passing.

- [ ] **Step 5: Run full suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: zero failures, zero type errors.

- [ ] **Step 6: Commit**

```bash
git add app/api/feedback/route.ts tests/api/feedback.test.ts
git commit -m "$(cat <<'EOF'
feat(api/feedback): POST /api/feedback (sub-projeto 9)

Auth-gated, zod-validated, delegates persistence + Langfuse mirror to
recordFeedback. Returns 204 on success, 4xx for client errors, 500 on DB
failure. Comment capped at 1000 chars at the API boundary (also enforced
by DB CHECK constraint).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `MessageActions` component (TDD)

**Files:**
- Create: `components/chat/MessageActions.tsx`
- Create: `tests/components/chat/MessageActions.test.tsx`

- [ ] **Step 1: Write the failing test**

Write to `tests/components/chat/MessageActions.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageActions } from '@/components/chat/MessageActions';

const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (...args: unknown[]) => toastError(...args) } }));

const ORIGINAL_FETCH = globalThis.fetch;

beforeEach(() => {
  toastError.mockReset();
});

afterEach(() => {
  cleanup();
  globalThis.fetch = ORIGINAL_FETCH;
});

const PROPS = {
  traceId: 'tr-1',
  sessionId: '11111111-1111-1111-1111-111111111111',
};

describe('<MessageActions/>', () => {
  it('renders a thumbs-up and thumbs-down button', () => {
    render(<MessageActions {...PROPS} />);
    expect(screen.getByRole('button', { name: /útil|👍|gostei/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /não.*útil|👎|não gostei/i })).toBeDefined();
  });

  it('renders the up button as active when initialRating is "up"', () => {
    render(<MessageActions {...PROPS} initialRating="up" />);
    const up = screen.getByRole('button', { name: /útil|👍|gostei/i });
    expect(up.getAttribute('aria-pressed')).toBe('true');
  });

  it('POSTs rating up on thumbs-up click', async () => {
    const fetchSpy = vi.fn(async () => new Response(null, { status: 204 })) as typeof fetch;
    globalThis.fetch = fetchSpy;
    render(<MessageActions {...PROPS} />);
    await userEvent.click(screen.getByRole('button', { name: /útil|👍|gostei/i }));

    expect(fetchSpy).toHaveBeenCalled();
    const [url, init] = (fetchSpy as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe('/api/feedback');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({
      sessionId: PROPS.sessionId,
      traceId: PROPS.traceId,
      rating: 'up',
    });
  });

  it('opens a comment textarea on thumbs-down click and submits update with comment', async () => {
    const fetchSpy = vi.fn(async () => new Response(null, { status: 204 })) as typeof fetch;
    globalThis.fetch = fetchSpy;
    render(<MessageActions {...PROPS} />);
    await userEvent.click(screen.getByRole('button', { name: /não.*útil|👎|não gostei/i }));

    // First call: rating=down without comment.
    const firstBody = JSON.parse(
      ((fetchSpy as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![1] as RequestInit).body as string,
    );
    expect(firstBody.rating).toBe('down');
    expect(firstBody.comment).toBeUndefined();

    // Textarea appears.
    const textarea = await screen.findByRole('textbox');
    await userEvent.type(textarea, 'fora do tema');
    await userEvent.click(screen.getByRole('button', { name: /enviar/i }));

    // Second call: rating=down WITH comment.
    const secondBody = JSON.parse(
      ((fetchSpy as unknown as ReturnType<typeof vi.fn>).mock.calls[1]![1] as RequestInit).body as string,
    );
    expect(secondBody.rating).toBe('down');
    expect(secondBody.comment).toBe('fora do tema');
  });

  it('reverts and toasts on a non-2xx response', async () => {
    globalThis.fetch = vi.fn(async () => new Response(null, { status: 500 })) as typeof fetch;
    render(<MessageActions {...PROPS} />);
    const up = screen.getByRole('button', { name: /útil|👍|gostei/i });
    await userEvent.click(up);
    await new Promise((r) => setTimeout(r, 50));

    expect(toastError).toHaveBeenCalled();
    expect(up.getAttribute('aria-pressed')).toBe('false');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/components/chat/MessageActions.test.tsx`
Expected: FAIL — component does not exist.

- [ ] **Step 3: Write `components/chat/MessageActions.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { toast } from 'sonner';

type Rating = 'up' | 'down';

type Props = {
  traceId: string;
  sessionId: string;
  initialRating?: Rating;
};

const COMMENT_MAX = 1000;

async function postFeedback(input: {
  sessionId: string;
  traceId: string;
  rating: Rating;
  comment?: string;
}): Promise<boolean> {
  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function MessageActions({ traceId, sessionId, initialRating }: Props) {
  const [rating, setRating] = useState<Rating | null>(initialRating ?? null);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const click = async (next: Rating) => {
    const previous = rating;
    setRating(next);
    if (next === 'down') setShowComment(true);
    else setShowComment(false);

    const ok = await postFeedback({ sessionId, traceId, rating: next });
    if (!ok) {
      setRating(previous);
      setShowComment(previous === 'down');
      toast.error('Não foi possível registrar o feedback. Tente novamente.');
    }
  };

  const submitComment = async () => {
    if (!comment.trim()) {
      setShowComment(false);
      return;
    }
    setSubmitting(true);
    const ok = await postFeedback({
      sessionId,
      traceId,
      rating: 'down',
      comment: comment.slice(0, COMMENT_MAX),
    });
    setSubmitting(false);
    if (!ok) {
      toast.error('Não foi possível registrar o comentário. Tente novamente.');
      return;
    }
    setShowComment(false);
    setComment('');
  };

  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => click('up')}
          aria-pressed={rating === 'up'}
          aria-label="Resposta útil"
          title="Resposta útil"
          className={
            rating === 'up'
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }
        >
          <ThumbsUp className="h-4 w-4" fill={rating === 'up' ? 'currentColor' : 'none'} />
        </button>
        <button
          type="button"
          onClick={() => click('down')}
          aria-pressed={rating === 'down'}
          aria-label="Resposta não útil"
          title="Resposta não útil"
          className={
            rating === 'down'
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }
        >
          <ThumbsDown className="h-4 w-4" fill={rating === 'down' ? 'currentColor' : 'none'} />
        </button>
      </div>
      {showComment ? (
        <div className="flex flex-col gap-2 max-w-md">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, COMMENT_MAX))}
            placeholder="O que faltou? (opcional, até 1000 caracteres)"
            className="rounded-md border border-border bg-background p-2 text-sm"
            rows={3}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={submitComment}
              disabled={submitting}
              className="rounded-md bg-primary text-primary-foreground px-3 py-1 text-xs disabled:opacity-50"
            >
              Enviar
            </button>
            <button
              type="button"
              onClick={() => {
                setShowComment(false);
                setComment('');
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/components/chat/MessageActions.test.tsx`
Expected: 5 passing.

- [ ] **Step 5: Run full suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: zero failures, zero type errors.

- [ ] **Step 6: Commit**

```bash
git add components/chat/MessageActions.tsx tests/components/chat/MessageActions.test.tsx
git commit -m "$(cat <<'EOF'
feat(chat): MessageActions 👍/👎 with optional comment (sub-projeto 9)

Optimistic state, reverts + toasts on a non-2xx response. 👎 expands an
inline textarea capped at 1000 chars; first POST sets the rating, second
POST attaches the comment as an UPSERT.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Wire `MessageActions` into the chat surface

**Files:**
- Modify: `components/chat/Message.tsx`
- Modify: `components/chat/MessageList.tsx`
- Modify: `components/chat/ChatSession.tsx`

- [ ] **Step 1: Update `components/chat/Message.tsx`**

Replace the file with:

```tsx
'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MessageActions } from './MessageActions';

type Props = {
  role: 'user' | 'assistant';
  content: string;
  isStreaming: boolean;
  traceId?: string;
  sessionId?: string;
  initialRating?: 'up' | 'down';
};

export function Message({ role, content, isStreaming, traceId, sessionId, initialRating }: Props) {
  if (role === 'user') {
    return (
      <li className="flex justify-end">
        <div className="bg-primary text-primary-foreground max-w-[75%] rounded-2xl px-4 py-2 whitespace-pre-wrap break-words">
          {content}
        </div>
      </li>
    );
  }
  return (
    <li className="flex justify-start">
      <div className="bg-card border border-border max-w-[85%] rounded-2xl px-4 py-3">
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
        {isStreaming ? (
          <span
            data-streaming-dot
            className="inline-block ml-1 h-2 w-2 rounded-full bg-primary animate-pulse"
            aria-label="Gerando"
          />
        ) : null}
        {!isStreaming && traceId && sessionId ? (
          <MessageActions traceId={traceId} sessionId={sessionId} initialRating={initialRating} />
        ) : null}
      </div>
    </li>
  );
}
```

- [ ] **Step 2: Update `components/chat/MessageList.tsx`**

Replace the file with:

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { Message } from './Message';
import type { ChatMessage } from '@/lib/rag/types';

type Annotation = { traceId?: string };

type UIMessage = ChatMessage & {
  id?: string;
  annotations?: unknown[];
};

type Props = {
  messages: UIMessage[];
  isLoading: boolean;
  sessionId?: string;
  initialRatings?: Map<string, 'up' | 'down'>;
};

const STICK_THRESHOLD_PX = 80;

function pickTraceId(m: UIMessage): string | undefined {
  const ann = m.annotations as Annotation[] | undefined;
  const found = ann?.find((a) => typeof a?.traceId === 'string');
  return found?.traceId;
}

export function MessageList({ messages, isLoading, sessionId, initialRatings }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distance < STICK_THRESHOLD_PX) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, isLoading]);

  const lastIdx = messages.length - 1;

  return (
    <div ref={ref} className="flex-1 overflow-y-auto">
      <ol className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {messages.map((m, i) => {
          const traceId = pickTraceId(m);
          const initialRating = traceId ? initialRatings?.get(traceId) : undefined;
          return (
            <Message
              key={m.id ?? i}
              role={m.role === 'assistant' ? 'assistant' : 'user'}
              content={m.content}
              isStreaming={isLoading && i === lastIdx && m.role === 'assistant'}
              traceId={traceId}
              sessionId={sessionId}
              initialRating={initialRating}
            />
          );
        })}
      </ol>
    </div>
  );
}
```

- [ ] **Step 3: Update `components/chat/ChatSession.tsx`**

Replace the file with:

```tsx
'use client';

import { useChat, type Message as AIMessage } from 'ai/react';
import { toast } from 'sonner';
import type { ChatMessage } from '@/lib/rag/types';
import type { StoredSession } from '@/lib/chat-storage';
import { EmptyState } from './EmptyState';
import { MessageList } from './MessageList';
import { Composer } from './Composer';

type Props = {
  session: StoredSession;
  initialRatings?: Map<string, 'up' | 'down'>;
  onMessagesChange: (messages: ChatMessage[]) => void;
};

function toChatMessages(messages: AIMessage[]): ChatMessage[] {
  return messages
    .filter((m): m is AIMessage & { role: 'user' | 'assistant' } => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: m.content }));
}

export function ChatSession({ session, initialRatings, onMessagesChange }: Props) {
  const { messages, input, setInput, handleSubmit, isLoading, stop } = useChat({
    api: '/api/chat',
    id: session.id,
    body: { sessionId: session.id },
    initialMessages: session.messages.map((m, i) => ({
      id: `${session.id}-${i}`,
      role: m.role,
      content: m.content,
    })),
    onResponse: async (res) => {
      if (res.status === 429) {
        const body = await res.clone().json().catch(() => ({}));
        const secs: number = typeof body?.retry_after_secs === 'number' ? body.retry_after_secs : 60;
        const minutes = Math.max(1, Math.ceil(secs / 60));
        toast.error(`Limite de mensagens atingido. Tente novamente em ~${minutes} min.`);
      }
    },
    onError: (err) => {
      if (err.message.includes('rate_limited') || err.message.includes('429')) return;
      toast.error('Tivemos um problema. Tente enviar novamente.');
    },
    onFinish: (assistant) => {
      const next = toChatMessages([...messages, assistant]);
      onMessagesChange(next);
    },
  });

  return (
    <>
      {messages.length === 0 ? (
        <EmptyState onPick={(text) => setInput(text)} />
      ) : (
        <MessageList
          messages={messages.map((m) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            annotations: m.annotations,
          }))}
          isLoading={isLoading}
          sessionId={session.id}
          initialRatings={initialRatings}
        />
      )}
      <Composer
        input={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        onStop={stop}
      />
    </>
  );
}
```

- [ ] **Step 4: Run full vitest + typecheck**

Run: `npm test && npm run typecheck`
Expected: zero failures, zero type errors. The existing `tests/components/chat/ChatSession.test.tsx` still constructs `<ChatSession session={...} onMessagesChange={...}/>` without `initialRatings`. Because `initialRatings` is optional, the existing tests should keep passing.

- [ ] **Step 5: Commit**

```bash
git add components/chat/Message.tsx components/chat/MessageList.tsx components/chat/ChatSession.tsx
git commit -m "$(cat <<'EOF'
feat(chat): wire MessageActions into Message/MessageList/ChatSession (sub-projeto 9)

MessageList extracts traceId from the AI SDK annotation array, pairs it
with the optional initialRatings map, and forwards both to Message.
Message gates rendering of the buttons on (assistant && !isStreaming &&
traceId && sessionId).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: `useChatSessionsRemote` hydrates ratings

**Files:**
- Modify: `hooks/useChatSessions.ts`
- Modify: `hooks/useChatSessionsRemote.ts`
- Modify: `components/chat/ChatRoot.tsx`

- [ ] **Step 1: Update `hooks/useChatSessions.ts` type**

Open the file. Find the `export type UseChatSessions = { ... }` block. Replace it with:

```ts
export type UseChatSessions = {
  sessions: StoredSession[];
  currentId: string;
  current: StoredSession;
  ratings?: Map<string, 'up' | 'down'>;
  switchTo: (id: string) => void;
  createNew: () => void;
  deleteSession: (id: string) => void;
  updateMessages: (messages: ChatMessage[]) => void;
};
```

The legacy `useChatSessions` (localStorage) does not implement `ratings` — that's fine, it's optional.

- [ ] **Step 2: Update `hooks/useChatSessionsRemote.ts` to hydrate ratings**

Open the file. Locate the `useChatSessionsRemote` function. Add a new state:

```ts
const [ratings, setRatings] = useState<Map<string, 'up' | 'down'>>(new Map());
```

Add a new effect that fires whenever `currentId` changes:

```ts
useEffect(() => {
  if (!currentId) return;
  let cancelled = false;
  (async () => {
    const sb = supabaseBrowser();
    const { data, error } = await sb
      .from('message_feedback')
      .select('trace_id, rating')
      .eq('session_id', currentId);
    if (cancelled) return;
    if (error) {
      console.warn('[useChatSessionsRemote] feedback load failed:', error);
      return;
    }
    const next = new Map<string, 'up' | 'down'>();
    for (const r of (data ?? []) as Array<{ trace_id: string; rating: 'up' | 'down' }>) {
      next.set(r.trace_id, r.rating);
    }
    setRatings(next);
  })();
  return () => {
    cancelled = true;
  };
}, [currentId]);
```

Place this effect right after the existing `useEffect` that hydrates sessions.

Then thread `ratings` through both the unhydrated short-circuit return and the hydrated return at the bottom of the hook so the shape stays consistent:

In the unhydrated branch (the `if (!hydrated)` block) return:
```ts
return {
  sessions: [],
  currentId: '',
  current: EMPTY_STUB,
  ratings: new Map(),
  switchTo,
  createNew: createNew as unknown as () => void,
  deleteSession: deleteSession as unknown as (id: string) => void,
  updateMessages: updateMessages as unknown as (messages: ChatMessage[]) => void,
};
```

In the hydrated final return add the same `ratings,` key:
```ts
return {
  sessions,
  currentId,
  current,
  ratings,
  switchTo,
  createNew: createNew as unknown as () => void,
  deleteSession: deleteSession as unknown as (id: string) => void,
  updateMessages: updateMessages as unknown as (messages: ChatMessage[]) => void,
};
```

- [ ] **Step 3: Update `components/chat/ChatRoot.tsx` to forward ratings**

Open the file. Find the JSX where `<ChatSession ...>` is wrapped by `<ChatErrorBoundary>`. Add the `initialRatings` prop:

```tsx
<ChatErrorBoundary>
  <ChatSession
    key={sessionsApi.currentId}
    session={sessionsApi.current}
    initialRatings={sessionsApi.ratings}
    onMessagesChange={sessionsApi.updateMessages}
  />
</ChatErrorBoundary>
```

- [ ] **Step 4: Run full vitest + typecheck**

Run: `npm test && npm run typecheck`
Expected: zero failures, zero type errors.

If `tests/hooks/useChatSessionsRemote.test.tsx` exists and asserts an exact object shape from the hook's return, it may need updating to include `ratings`. Loosen any equality assertions to `toMatchObject(...)` or add the new field.

- [ ] **Step 5: Commit**

```bash
git add hooks/useChatSessions.ts hooks/useChatSessionsRemote.ts components/chat/ChatRoot.tsx tests/hooks/useChatSessionsRemote.test.tsx
git commit -m "$(cat <<'EOF'
feat(hooks): hydrate feedback ratings per session (sub-projeto 9)

useChatSessionsRemote fetches existing 👍/👎 for the current session and
exposes a Map<trace_id, rating>. ChatRoot forwards the map to ChatSession
so MessageActions reflects prior votes after reload.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

If `tests/hooks/useChatSessionsRemote.test.tsx` did not need changes, drop it from the `git add`.

---

## Task 9: "Feedback geral" link in the Header

**Files:**
- Modify: `components/chat/Header.tsx`

- [ ] **Step 1: Update `components/chat/Header.tsx`**

Replace the file with:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Menu, Moon, Sun, Monitor, MessageSquareText } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';

// TODO: replace with company-owned address once branding is decided.
const FEEDBACK_MAILTO =
  'mailto:rgoalves@gmail.com?subject=ProcurementGPT%20feedback';

type Props = {
  onOpenSidebar?: () => void;
};

export function Header({ onOpenSidebar }: Props) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const cycle = () => {
    const next = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
    setTheme(next);
  };

  const Icon = !mounted ? Monitor : theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  const label = !mounted
    ? 'Tema'
    : theme === 'light'
      ? 'Tema: claro (clique para alternar)'
      : theme === 'dark'
        ? 'Tema: escuro (clique para alternar)'
        : 'Tema: sistema (clique para alternar)';

  return (
    <header className="h-14 border-b border-border bg-background flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-2">
        {onOpenSidebar ? (
          <Button
            size="icon"
            variant="ghost"
            className="md:hidden"
            onClick={onOpenSidebar}
            aria-label="Abrir conversas"
          >
            <Menu className="h-4 w-4" />
          </Button>
        ) : null}
        <span className="text-sm font-semibold md:hidden">ProcurementGPT</span>
      </div>
      <div className="flex items-center gap-1">
        <a
          href={FEEDBACK_MAILTO}
          aria-label="Enviar feedback"
          title="Enviar feedback geral"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
        >
          <MessageSquareText className="h-4 w-4" />
        </a>
        <Button size="icon" variant="ghost" onClick={cycle} aria-label={label} title={label}>
          <Icon className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Run typecheck + tests**

Run: `npm test && npm run typecheck`
Expected: zero failures, zero type errors.

- [ ] **Step 3: Commit**

```bash
git add components/chat/Header.tsx
git commit -m "$(cat <<'EOF'
feat(chat/header): add Feedback geral mailto link (sub-projeto 9)

Generic feedback channel for issues that don't fit a per-message thumbs
vote. Email destination is hardcoded until branding is decided.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: CLAUDE.md updates

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add the sub-projeto 9 row**

Find the row for sub-projeto 8 (`| 8 | \`beta-hardening-complete\` | ...`) in the `## Status — sub-projetos completos` table. Add IMMEDIATELY after it (and before the blank line that ends the table):

```markdown
| 9 | `feedback-loop-complete` | 👍/👎 inline em cada resposta do assistant via `<MessageActions/>` (lucide ThumbsUp/ThumbsDown), 👎 expande textarea inline para comentário (≤1000 chars). Migration 0008: `message_feedback` + 4 RLS owner-only policies + `unique(user_id, trace_id)` para upsert flip. `Trace.id` exposto pelo wrapper Langfuse (real ou `crypto.randomUUID()` em no-op). `/api/chat` adiciona `traceId` à message annotation; client passa de volta em `POST /api/feedback` (Node, zod-validated, 401/400/404/500/204). `lib/feedback.recordFeedback` UPSERTa + chama `scoreTrace` fire-and-forget (`name: user-feedback`, `value: 1` ou `-1`). `useChatSessionsRemote` hidrata `ratings: Map<traceId, rating>` ao trocar sessão. Header ganha link mailto "Feedback geral" (hardcoded até decidir branding). |
```

- [ ] **Step 2: Update Milestone 2 status**

Find `## Milestone 2 — Beta Readiness`. Replace the bullet list under it with:

```markdown
- **8 — beta-hardening** ✅ completo (`beta-hardening-complete`)
- **9 — feedback-loop** ✅ completo (`feedback-loop-complete`)

Milestone 2 entregue. Critério de saída para Milestone 3 (≥100 traces `env:beta` com ≥30 ratings em ≥2 semanas) começa a contar a partir do primeiro convite de beta.
```

- [ ] **Step 3: Add gotchas to "O que evitar"**

Append these bullets at the end of the existing `## O que evitar` list:

```
- Persistir IDs de mensagem do `useChat` no JSONB de `sessions.messages` — sub-projeto 9 deliberadamente NÃO faz isso. O anchor de feedback é o `trace_id` Langfuse propagado via `appendMessageAnnotation`. Se um sub-projeto futuro precisar de message-level feedback (não trace-level), aí sim fazer schema change.
- Esquecer `id: 'mock-trace-id'` ao criar mocks de `Trace` em testes novos — o tipo agora exige `id: string` (sub-projeto 9). Sem isso, typecheck quebra.
- Mexer no Header sem manter o link "Feedback geral" — é o canal de fallback para reports que não cabem em 👎. O destino `mailto:rgoalves@gmail.com` é TBD-temporary; trocar quando branding definir.
- Bloquear o response do `/api/feedback` em falha do Langfuse `score()` — `recordFeedback` chama `scoreTrace` fire-and-forget de propósito; UI não deve esperar por Langfuse.
```

- [ ] **Step 4: Run typecheck + tests as sanity**

Run: `npm test && npm run typecheck`
Expected: zero failures, zero type errors. CLAUDE.md doesn't affect build, but running anyway proves no other file was touched accidentally.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs(CLAUDE.md): record sub-projeto 9 + Milestone 2 closed (sub-projeto 9)

- Status row for feedback-loop-complete
- Milestone 2 marked done (8 + 9 shipped)
- 4 new gotchas: trace-id anchor design, Trace.id mocks, header link,
  fire-and-forget scoreTrace

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Final verification + push + tag

**Files:**
- None modified.

- [ ] **Step 1: Run the full test matrix locally**

Run: `npm test && npm run typecheck`
Expected: zero failures, zero type errors. Vitest count should be ~165 (was 157 after sub-projeto 8): +4 (langfuse) +5 (feedback helper) +6 (route) +5 (MessageActions) ≈ +20 net, with adjustments to existing chat tests.

- [ ] **Step 2: Run the eval gate**

Run: `npm run rag:eval`
Expected: `recall@5 ≥ 0.85` (CI gate). Sub-projeto 9 doesn't touch retrieval, so no movement expected.

- [ ] **Step 3: Apply migration 0008 to production Supabase (manual)**

Either run `npm run db:migrate` if linked, or paste the migration into the Supabase SQL editor for the linked project. Confirm the table exists:

```sql
select count(*) from message_feedback;
-- expected: 0 rows initially
```

- [ ] **Step 4: Push commits**

```bash
git push origin main
```

Expected: CI workflow runs typecheck + vitest + pytest + rag:eval. Wait for green.

- [ ] **Step 5: Apply the milestone tag**

```bash
git tag feedback-loop-complete
git push origin feedback-loop-complete
```

- [ ] **Step 6: Update `docs/product/beta-smoke-test.md` with feedback checks**

Append a new section so the next smoke run validates feedback end-to-end:

```markdown
## Feedback (sub-projeto 9)
- [ ] Click 👍 on an assistant message → `aria-pressed=true` and a row appears in `select * from message_feedback where rating='up'` (Supabase SQL editor)
- [ ] Click 👎 → textarea opens; submit a comment → row updated with `rating='down'` and `comment` populated
- [ ] Reload the page → previously-rated message shows the rating active
- [ ] Langfuse trace shows a `user-feedback` score with value `1` or `-1`
- [ ] Header "feedback geral" icon opens an email draft to the configured address
```

Stage + commit alongside any other minor tweaks under the same `feat(chat): MessageActions` style or as a follow-up:

```bash
git add docs/product/beta-smoke-test.md
git commit -m "$(cat <<'EOF'
docs(beta-smoke): add feedback section to manual checklist (sub-projeto 9)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Self-Review (post-write)

**Spec coverage:** every section of `docs/superpowers/specs/2026-05-04-feedback-loop-design.md` is mapped:
- §1 Modelo de dados → Task 1
- §2 Trace ID propagation → Task 2 (types + langfuse + scoreTrace) and Task 3 (route annotation)
- §3 UI 👍/👎 → Task 6 (component) + Task 7 (wiring)
- §4 Hidratação de ratings → Task 8
- §5 `/api/feedback` → Task 5 (route) + Task 4 (helper)
- §6 Wrapper score → Task 2
- §7 Link feedback geral → Task 9
- Não-objetivos → not implemented (deliberate)
- Critério de pronto → Task 11
- Mudanças de arquivos → entire plan
- Riscos / decisões deferidas → Task 10 gotchas

**Placeholder scan:** no TBDs (the email destination is documented as a deliberate TODO + gotcha, not a plan TBD). Every code block is complete and runnable.

**Type consistency:**
- `Rating = 'up' | 'down'` consistent in DB (CHECK), zod, helper, component, hook map.
- `Trace.id: string` consistent across types, wrapper, mocks.
- `recordFeedback` signature consistent in helper + route + tests.
- `FeedbackResult` discriminated union consistent.
- `traceId` (camelCase) consistent in TS; `trace_id` (snake) only at DB row level.
- `name: 'user-feedback'` consistent in `recordFeedback`, `scoreTrace`, smoke checklist.
- `MessageActions` props (`traceId`, `sessionId`, `initialRating`) consistent across consumer chain.

No fixes inline needed.

---

## Open Questions / Deferred

- If real-traffic logs show users abuse the feedback endpoint, add a soft rate limit (no UPSERT spam — UNIQUE constraint already idempotent at the DB; the concern would only be Langfuse score spam). Defer to Milestone 3.
- If the `crypto.randomUUID()` no-op trace ID ever lands in DB, the `unique(user_id, trace_id)` constraint still works but those rows can't be correlated with Langfuse. That's only a concern in production-without-Langfuse-keys, which is misconfiguration.
