# Feedback Review Loop Implementation Plan (Sub-projeto 14)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/admin/feedback` — a review queue for 👍/👎 feedback (sub-projeto 9 captures it but no one reads it) — so the admin can investigate failures, mark items as resolved, and see top queries from real usage. Add a single column `resolved_at` to `message_feedback` (migration 0011).

**Architecture:** New page `app/admin/feedback/page.tsx` gated by `requireAdmin()` renders 3 client components: `<FeedbackList>` (table + filters), `<FeedbackDetail>` (Q+A+chunks drill-down derived from `sessions.messages` JSONB by trace_id matching), `<TopQueries>` (last-30-days aggregation). Three new admin-only routes: `GET /api/admin/feedback` (paginated list), `POST /api/admin/feedback/[id]/resolve`, `GET /api/admin/feedback/top-queries`. All admin routes use `getServerSupabase()` (service-role) since `message_feedback` RLS is owner-only — bypassing RLS is the established pattern for `/api/admin/*`.

**Tech Stack:** Next.js 14 App Router (Node runtime on admin routes), Supabase Postgres + RLS bypass via service-role, zod, vitest, TypeScript strict, shadcn base-nova UI, sonner toasts.

**Spec:** `docs/superpowers/specs/2026-05-08-feedback-review-loop-design.md`

---

## File Structure

**New files:**
- `supabase/migrations/00000000000011_feedback_resolved.sql` — `resolved_at timestamptz null` + partial index
- `app/admin/feedback/page.tsx` — server component, gates with `requireAdmin()`
- `components/admin/FeedbackRoot.tsx` — client wrapper owning filter + selectedId state
- `components/admin/FeedbackList.tsx` — table of feedback rows + filter bar
- `components/admin/FeedbackDetail.tsx` — drill-down pane (extracts Q+A+chunks from sessions JSONB)
- `components/admin/TopQueries.tsx` — top user queries last 30d
- `app/api/admin/feedback/route.ts` — GET paginated/filtered list
- `app/api/admin/feedback/[id]/resolve/route.ts` — POST toggle resolved_at
- `app/api/admin/feedback/top-queries/route.ts` — GET aggregation
- `tests/lib/feedback.admin.test.ts`
- `tests/api/admin/feedback.test.ts`
- `tests/api/admin/feedback-resolve.test.ts`
- `tests/api/admin/feedback-top-queries.test.ts`
- `tests/components/admin/FeedbackList.test.tsx`
- `tests/components/admin/FeedbackDetail.test.tsx`
- `tests/components/admin/TopQueries.test.tsx`

**Modified files:**
- `lib/feedback.ts` — add `listFeedback`, `resolveFeedback`, `topQueries` server-side helpers (service-role)
- `components/admin/AdminSidebar.tsx` — add `{ href: '/admin/feedback', label: 'Feedback', Icon: MessageSquare }`
- `docs/product/beta-smoke-test.md` — add 6 manual smoke items
- `CLAUDE.md` — sub-projeto 14 row + structure additions + gotchas

---

## Conventions

- **Test runner:** `npm test` (vitest run, all suites). Single file: `npm test -- tests/api/admin/feedback.test.ts`. Use `vi.doMock` + `vi.resetModules()` (canonical: `tests/api/admin/articles-bulk-delete.test.ts`).
- **Service-role mocks:** `vi.doMock('@/lib/db/supabase', () => ({ getServerSupabase: () => ({ from: () => ({ /* chain */ }) }) }))`. Pattern from `tests/api/admin/ingest-jobs.test.ts`.
- **Component tests:** require `// @vitest-environment jsdom` directive on line 1. Use React Testing Library. Pattern from `tests/components/admin/ThemeSidebar.test.tsx`.
- **Typecheck:** `npm run typecheck`. Run after every task that touches types.
- **Branch:** `feat/feedback-review-loop` (NOT direct to main; user has switched to PR-based workflow as of 2026-05-08).
- **Commits:** atomic per task. Format `<type>(<scope>): <subject>` with `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` footer.
- **Final step:** create PR via `gh pr create` with body summarizing sub-projeto 14. Tag `feedback-review-loop-complete` applied AFTER merge.

---

## Task 1: Migration `0011`

Add `resolved_at timestamptz null` to `message_feedback` + a partial index for fast unresolved-listing.

**Files:**
- Create: `supabase/migrations/00000000000011_feedback_resolved.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Sub-projeto 14 — feedback review loop
alter table message_feedback
  add column resolved_at timestamptz;

-- Partial index — admin's default view is "show me what I haven't dealt with yet"
create index message_feedback_unresolved_idx
  on message_feedback (created_at desc)
  where resolved_at is null;
```

- [ ] **Step 2: Apply via psycopg**

```bash
scripts/.venv/Scripts/python.exe -c "
import os, psycopg
from pathlib import Path
env_path = Path('.env.local')
for line in env_path.read_text(encoding='utf-8').splitlines():
    line = line.strip()
    if not line or line.startswith('#') or '=' not in line: continue
    k, v = line.split('=', 1)
    os.environ.setdefault(k.strip(), v.strip().strip(chr(34)).strip(chr(39)))
url = os.environ['NEXT_PUBLIC_SUPABASE_URL']
host = url.replace('https://','').replace('.supabase.co','') + '.supabase.co'
sql = Path('supabase/migrations/00000000000011_feedback_resolved.sql').read_text(encoding='utf-8')
conn = psycopg.connect(f'postgresql://postgres:{os.environ[\"SUPABASE_DB_PASSWORD\"]}@db.{host}:5432/postgres', autocommit=True)
with conn.cursor() as cur:
    cur.execute(sql)
print('migration applied')
conn.close()
"
```

If error says `column resolved_at already exists`, the migration was previously applied — treat as success.

- [ ] **Step 3: Verify**

```bash
scripts/.venv/Scripts/python.exe -c "
import os, psycopg
from pathlib import Path
env_path = Path('.env.local')
for line in env_path.read_text(encoding='utf-8').splitlines():
    line = line.strip()
    if not line or line.startswith('#') or '=' not in line: continue
    k, v = line.split('=', 1)
    os.environ.setdefault(k.strip(), v.strip().strip(chr(34)).strip(chr(39)))
url = os.environ['NEXT_PUBLIC_SUPABASE_URL']
host = url.replace('https://','').replace('.supabase.co','') + '.supabase.co'
conn = psycopg.connect(f'postgresql://postgres:{os.environ[\"SUPABASE_DB_PASSWORD\"]}@db.{host}:5432/postgres', autocommit=True)
with conn.cursor() as cur:
    cur.execute(\"select column_name from information_schema.columns where table_name='message_feedback' and column_name='resolved_at'\")
    print('column:', cur.fetchall())
    cur.execute(\"select indexname from pg_indexes where tablename='message_feedback' and indexname='message_feedback_unresolved_idx'\")
    print('index:', cur.fetchall())
conn.close()
"
```

Expected: column row + index row both present.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00000000000011_feedback_resolved.sql
git commit -m "$(cat <<'EOF'
feat(db): migration 0011 adds message_feedback.resolved_at

Sub-projeto 14 schema. Default null = "not yet reviewed by admin".
Partial index on (created_at desc) where resolved_at is null because
the admin default view is "show me unresolved" and the query needs to
scan the freshest items first.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `lib/feedback.ts` admin helpers (TDD)

Three server-side helpers using `getServerSupabase()` (service-role bypass): `listFeedback`, `resolveFeedback`, `topQueries`.

**Files:**
- Modify: `lib/feedback.ts` (extend; do NOT touch existing `recordFeedback`)
- Create: `tests/lib/feedback.admin.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/lib/feedback.admin.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

function setupSupabase(opts: {
  listRows?: unknown[];
  resolveError?: { message: string } | null;
  topRows?: Array<{ content: string; count: number }>;
} = {}) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn().mockReturnValue(builder);
  builder.order = vi.fn().mockReturnValue(builder);
  builder.eq = vi.fn().mockReturnValue(builder);
  builder.is = vi.fn().mockReturnValue(builder);
  builder.not = vi.fn().mockReturnValue(builder);
  builder.gte = vi.fn().mockReturnValue(builder);
  builder.lte = vi.fn().mockReturnValue(builder);
  builder.range = vi.fn().mockResolvedValue({ data: opts.listRows ?? [], error: null });
  builder.update = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: opts.resolveError ?? null }),
  });
  const rpcMock = vi.fn().mockResolvedValue({ data: opts.topRows ?? [], error: null });
  vi.doMock('@/lib/db/supabase', () => ({
    getServerSupabase: () => ({
      from: () => builder,
      rpc: rpcMock,
    }),
  }));
  return { builder, rpc: rpcMock };
}

describe('listFeedback', () => {
  it('returns rows with no filters', async () => {
    const m = setupSupabase({
      listRows: [{ id: 'a', rating: 'down', comment: null, created_at: '2026-05-08T00:00:00Z' }],
    });
    const { listFeedback } = await import('@/lib/feedback');
    const out = await listFeedback({ limit: 50, offset: 0 });
    expect(out.rows).toHaveLength(1);
    expect(m.builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('filters by rating', async () => {
    const m = setupSupabase({});
    const { listFeedback } = await import('@/lib/feedback');
    await listFeedback({ rating: 'down', limit: 50, offset: 0 });
    expect(m.builder.eq).toHaveBeenCalledWith('rating', 'down');
  });

  it('filters by resolved=false (only unresolved)', async () => {
    const m = setupSupabase({});
    const { listFeedback } = await import('@/lib/feedback');
    await listFeedback({ resolved: false, limit: 50, offset: 0 });
    expect(m.builder.is).toHaveBeenCalledWith('resolved_at', null);
  });

  it('filters by resolved=true (only resolved)', async () => {
    const m = setupSupabase({});
    const { listFeedback } = await import('@/lib/feedback');
    await listFeedback({ resolved: true, limit: 50, offset: 0 });
    expect(m.builder.not).toHaveBeenCalledWith('resolved_at', 'is', null);
  });

  it('filters by date range', async () => {
    const m = setupSupabase({});
    const { listFeedback } = await import('@/lib/feedback');
    await listFeedback({
      from: '2026-05-01T00:00:00Z',
      to: '2026-05-08T00:00:00Z',
      limit: 50,
      offset: 0,
    });
    expect(m.builder.gte).toHaveBeenCalledWith('created_at', '2026-05-01T00:00:00Z');
    expect(m.builder.lte).toHaveBeenCalledWith('created_at', '2026-05-08T00:00:00Z');
  });
});

describe('resolveFeedback', () => {
  it('sets resolved_at when resolved=true', async () => {
    const m = setupSupabase({});
    const { resolveFeedback } = await import('@/lib/feedback');
    const out = await resolveFeedback('feedback-1', true);
    expect(out.ok).toBe(true);
    expect(m.builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ resolved_at: expect.any(String) }),
    );
  });

  it('clears resolved_at when resolved=false', async () => {
    const m = setupSupabase({});
    const { resolveFeedback } = await import('@/lib/feedback');
    const out = await resolveFeedback('feedback-1', false);
    expect(out.ok).toBe(true);
    expect(m.builder.update).toHaveBeenCalledWith({ resolved_at: null });
  });

  it('returns error on supabase failure', async () => {
    setupSupabase({ resolveError: { message: 'boom' } });
    const { resolveFeedback } = await import('@/lib/feedback');
    const out = await resolveFeedback('feedback-1', true);
    expect(out.ok).toBe(false);
  });
});

describe('topQueries', () => {
  it('returns aggregated rows from rpc', async () => {
    const m = setupSupabase({
      topRows: [
        { content: 'O que é Kraljic?', count: 8 },
        { content: 'Como reduzir custos?', count: 5 },
      ],
    });
    const { topQueries } = await import('@/lib/feedback');
    const out = await topQueries(30, 10);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ content: expect.any(String), count: expect.any(Number) });
    expect(m.rpc).toHaveBeenCalledWith('admin_top_queries', { p_days: 30, p_limit: 10 });
  });

  it('uses default days=30 limit=10 when not specified', async () => {
    const m = setupSupabase({});
    const { topQueries } = await import('@/lib/feedback');
    await topQueries();
    expect(m.rpc).toHaveBeenCalledWith('admin_top_queries', { p_days: 30, p_limit: 10 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/lib/feedback.admin.test.ts`
Expected: FAIL — `listFeedback`/`resolveFeedback`/`topQueries` not exported yet.

- [ ] **Step 3: Add an RPC function for `topQueries` (Postgres-side aggregation)**

Append to `supabase/migrations/00000000000011_feedback_resolved.sql`:

```sql
-- Top user queries from sessions.messages JSONB (admin-only via service-role)
create or replace function admin_top_queries(p_days int default 30, p_limit int default 10)
returns table (content text, count bigint)
language sql
stable
as $$
  select
    m->>'content' as content,
    count(*)::bigint as count
  from sessions s, jsonb_array_elements(s.messages) as m
  where m->>'role' = 'user'
    and s.updated_at > now() - (p_days::text || ' days')::interval
  group by m->>'content'
  order by count desc
  limit p_limit;
$$;
```

Re-apply the migration via psycopg (the alter table runs is idempotent; create-or-replace function works on re-run):

```bash
scripts/.venv/Scripts/python.exe -c "
import os, psycopg
from pathlib import Path
env_path = Path('.env.local')
for line in env_path.read_text(encoding='utf-8').splitlines():
    line = line.strip()
    if not line or line.startswith('#') or '=' not in line: continue
    k, v = line.split('=', 1)
    os.environ.setdefault(k.strip(), v.strip().strip(chr(34)).strip(chr(39)))
url = os.environ['NEXT_PUBLIC_SUPABASE_URL']
host = url.replace('https://','').replace('.supabase.co','') + '.supabase.co'
sql = Path('supabase/migrations/00000000000011_feedback_resolved.sql').read_text(encoding='utf-8')
conn = psycopg.connect(f'postgresql://postgres:{os.environ[\"SUPABASE_DB_PASSWORD\"]}@db.{host}:5432/postgres', autocommit=True)
# Strip the alter-table block (already applied); only run the create-or-replace function.
# Simplest: just run the whole file and ignore alter errors.
parts = sql.split(';')
for p in parts:
    p = p.strip()
    if not p: continue
    try:
        with conn.cursor() as cur:
            cur.execute(p)
    except Exception as e:
        print(f'skip ({p[:40]}...): {e}')
conn.close()
print('rpc applied')
"
```

- [ ] **Step 4: Implement helpers in `lib/feedback.ts`**

Append to existing file (do NOT touch `recordFeedback`):

```ts
import { getServerSupabase } from '@/lib/db/supabase';

export type FeedbackRow = {
  id: string;
  trace_id: string;
  session_id: string;
  user_id: string;
  rating: 'up' | 'down';
  comment: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

export type ListFilters = {
  rating?: 'up' | 'down';
  resolved?: boolean;
  from?: string;
  to?: string;
  hasComment?: boolean;
  limit: number;
  offset: number;
};

export async function listFeedback(filters: ListFilters): Promise<{ rows: FeedbackRow[] }> {
  const sb = getServerSupabase();
  let q = sb
    .from('message_feedback')
    .select('id, trace_id, session_id, user_id, rating, comment, created_at, updated_at, resolved_at')
    .order('created_at', { ascending: false });
  if (filters.rating) q = q.eq('rating', filters.rating);
  if (filters.resolved === false) q = q.is('resolved_at', null);
  if (filters.resolved === true) q = q.not('resolved_at', 'is', null);
  if (filters.from) q = q.gte('created_at', filters.from);
  if (filters.to) q = q.lte('created_at', filters.to);
  if (filters.hasComment === true) q = q.not('comment', 'is', null);
  q = q.range(filters.offset, filters.offset + filters.limit - 1);
  const { data, error } = await q;
  if (error) {
    console.warn('[feedback/admin] listFeedback failed:', error.message);
    return { rows: [] };
  }
  return { rows: (data ?? []) as FeedbackRow[] };
}

export async function resolveFeedback(
  id: string,
  resolved: boolean,
): Promise<{ ok: boolean; resolved_at: string | null }> {
  const sb = getServerSupabase();
  const resolved_at = resolved ? new Date().toISOString() : null;
  const { error } = await sb
    .from('message_feedback')
    .update({ resolved_at })
    .eq('id', id);
  if (error) {
    console.warn('[feedback/admin] resolveFeedback failed:', error.message);
    return { ok: false, resolved_at: null };
  }
  return { ok: true, resolved_at };
}

export type TopQuery = { content: string; count: number };

export async function topQueries(days = 30, limit = 10): Promise<TopQuery[]> {
  const sb = getServerSupabase();
  const { data, error } = await sb.rpc('admin_top_queries', { p_days: days, p_limit: limit });
  if (error) {
    console.warn('[feedback/admin] topQueries failed:', error.message);
    return [];
  }
  return ((data ?? []) as Array<{ content: string; count: number | bigint }>).map((r) => ({
    content: r.content,
    count: Number(r.count),
  }));
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/lib/feedback.admin.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/feedback.ts tests/lib/feedback.admin.test.ts supabase/migrations/00000000000011_feedback_resolved.sql
git commit -m "$(cat <<'EOF'
feat(feedback): admin helpers listFeedback / resolveFeedback / topQueries

Server-side helpers that bypass message_feedback's owner-only RLS via
getServerSupabase (service-role) — same pattern as /api/admin/articles.
listFeedback supports filters (rating, resolved, date range, has-comment).
resolveFeedback toggles resolved_at. topQueries calls a new SQL function
admin_top_queries that aggregates user messages from sessions.messages
JSONB over the last N days.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `GET /api/admin/feedback` route

Paginated, filtered list of feedback. Gates on `requireAdmin()` → 404.

**Files:**
- Create: `app/api/admin/feedback/route.ts`
- Create: `tests/api/admin/feedback.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/api/admin/feedback.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

function setupMocks(opts: { isAdmin: boolean; rows?: unknown[] }) {
  const listFeedback = vi.fn().mockResolvedValue({ rows: opts.rows ?? [] });
  vi.doMock('@/lib/auth', () => {
    class NotAdmin extends Error {
      constructor() { super('not admin'); this.name = 'NotAdmin'; }
    }
    return {
      requireAdmin: vi.fn().mockImplementation(() => {
        if (!opts.isAdmin) throw new NotAdmin();
      }),
      NotAdmin,
    };
  });
  vi.doMock('@/lib/feedback', () => ({ listFeedback }));
  return { listFeedback };
}

function buildReq(qs = ''): Request {
  return new Request(`http://x/api/admin/feedback${qs}`);
}

describe('GET /api/admin/feedback', () => {
  it('returns 404 for non-admin', async () => {
    setupMocks({ isAdmin: false });
    const { GET } = await import('@/app/api/admin/feedback/route');
    const res = await GET(buildReq());
    expect(res.status).toBe(404);
  });

  it('returns rows with no filters (default limit/offset)', async () => {
    const m = setupMocks({ isAdmin: true, rows: [{ id: 'a' }] });
    const { GET } = await import('@/app/api/admin/feedback/route');
    const res = await GET(buildReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows).toHaveLength(1);
    expect(m.listFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 50, offset: 0 }),
    );
  });

  it('passes rating filter from query string', async () => {
    const m = setupMocks({ isAdmin: true });
    const { GET } = await import('@/app/api/admin/feedback/route');
    await GET(buildReq('?rating=down'));
    expect(m.listFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ rating: 'down' }),
    );
  });

  it('passes resolved=false filter', async () => {
    const m = setupMocks({ isAdmin: true });
    const { GET } = await import('@/app/api/admin/feedback/route');
    await GET(buildReq('?resolved=false'));
    expect(m.listFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ resolved: false }),
    );
  });

  it('passes hasComment=true filter', async () => {
    const m = setupMocks({ isAdmin: true });
    const { GET } = await import('@/app/api/admin/feedback/route');
    await GET(buildReq('?has_comment=true'));
    expect(m.listFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ hasComment: true }),
    );
  });

  it('respects custom limit and offset', async () => {
    const m = setupMocks({ isAdmin: true });
    const { GET } = await import('@/app/api/admin/feedback/route');
    await GET(buildReq('?limit=20&offset=40'));
    expect(m.listFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20, offset: 40 }),
    );
  });

  it('rejects invalid rating value', async () => {
    setupMocks({ isAdmin: true });
    const { GET } = await import('@/app/api/admin/feedback/route');
    const res = await GET(buildReq('?rating=bogus'));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/api/admin/feedback.test.ts`
Expected: FAIL — route file does not exist.

- [ ] **Step 3: Implement `app/api/admin/feedback/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, NotAdmin } from '@/lib/auth';
import { listFeedback } from '@/lib/feedback';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  rating: z.enum(['up', 'down']).optional(),
  resolved: z.enum(['true', 'false']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  has_comment: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof NotAdmin) return new NextResponse('Not Found', { status: 404 });
    throw err;
  }

  const url = new URL(req.url);
  const raw = Object.fromEntries(url.searchParams.entries());
  let parsed: z.infer<typeof QuerySchema>;
  try {
    parsed = QuerySchema.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }

  const { rows } = await listFeedback({
    rating: parsed.rating,
    resolved: parsed.resolved === undefined ? undefined : parsed.resolved === 'true',
    from: parsed.from,
    to: parsed.to,
    hasComment: parsed.has_comment === undefined ? undefined : parsed.has_comment === 'true',
    limit: parsed.limit,
    offset: parsed.offset,
  });

  return NextResponse.json({ rows });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/api/admin/feedback.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/feedback/route.ts tests/api/admin/feedback.test.ts
git commit -m "$(cat <<'EOF'
feat(admin): GET /api/admin/feedback paginated + filtered list

Admin-only listing via getServerSupabase. zod-parsed query string
supports rating / resolved / date range / has_comment / limit / offset.
404 for non-admin, 400 for invalid query, 200 with { rows: [...] }.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `POST /api/admin/feedback/[id]/resolve` route

Toggle `resolved_at`. Body: `{ resolved: boolean }`.

**Files:**
- Create: `app/api/admin/feedback/[id]/resolve/route.ts`
- Create: `tests/api/admin/feedback-resolve.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/api/admin/feedback-resolve.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

function setupMocks(opts: { isAdmin: boolean; resolveResult?: { ok: boolean; resolved_at: string | null } }) {
  const resolveFeedback = vi.fn().mockResolvedValue(
    opts.resolveResult ?? { ok: true, resolved_at: '2026-05-08T00:00:00Z' },
  );
  vi.doMock('@/lib/auth', () => {
    class NotAdmin extends Error {
      constructor() { super('not admin'); this.name = 'NotAdmin'; }
    }
    return {
      requireAdmin: vi.fn().mockImplementation(() => {
        if (!opts.isAdmin) throw new NotAdmin();
      }),
      NotAdmin,
    };
  });
  vi.doMock('@/lib/feedback', () => ({ resolveFeedback }));
  return { resolveFeedback };
}

function buildReq(body: unknown): Request {
  return new Request('http://x/api/admin/feedback/abc/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/admin/feedback/[id]/resolve', () => {
  it('returns 404 for non-admin', async () => {
    setupMocks({ isAdmin: false });
    const { POST } = await import('@/app/api/admin/feedback/[id]/resolve/route');
    const res = await POST(buildReq({ resolved: true }), { params: { id: 'abc' } });
    expect(res.status).toBe(404);
  });

  it('marks feedback as resolved', async () => {
    const m = setupMocks({ isAdmin: true });
    const { POST } = await import('@/app/api/admin/feedback/[id]/resolve/route');
    const res = await POST(buildReq({ resolved: true }), { params: { id: 'abc' } });
    expect(res.status).toBe(200);
    expect(m.resolveFeedback).toHaveBeenCalledWith('abc', true);
  });

  it('clears resolved when resolved=false', async () => {
    const m = setupMocks({ isAdmin: true, resolveResult: { ok: true, resolved_at: null } });
    const { POST } = await import('@/app/api/admin/feedback/[id]/resolve/route');
    await POST(buildReq({ resolved: false }), { params: { id: 'abc' } });
    expect(m.resolveFeedback).toHaveBeenCalledWith('abc', false);
  });

  it('returns 400 for missing resolved field', async () => {
    setupMocks({ isAdmin: true });
    const { POST } = await import('@/app/api/admin/feedback/[id]/resolve/route');
    const res = await POST(buildReq({}), { params: { id: 'abc' } });
    expect(res.status).toBe(400);
  });

  it('returns 500 when supabase update fails', async () => {
    setupMocks({ isAdmin: true, resolveResult: { ok: false, resolved_at: null } });
    const { POST } = await import('@/app/api/admin/feedback/[id]/resolve/route');
    const res = await POST(buildReq({ resolved: true }), { params: { id: 'abc' } });
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/api/admin/feedback-resolve.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `app/api/admin/feedback/[id]/resolve/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, NotAdmin } from '@/lib/auth';
import { resolveFeedback } from '@/lib/feedback';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({ resolved: z.boolean() });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof NotAdmin) return new NextResponse('Not Found', { status: 404 });
    throw err;
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const result = await resolveFeedback(params.id, body.resolved);
  if (!result.ok) {
    return NextResponse.json({ error: 'resolve_failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, resolved_at: result.resolved_at });
}
```

- [ ] **Step 4: Run tests + typecheck + commit**

```bash
npm test -- tests/api/admin/feedback-resolve.test.ts
npm run typecheck
git add app/api/admin/feedback/\[id\]/resolve/route.ts tests/api/admin/feedback-resolve.test.ts
git commit -m "$(cat <<'EOF'
feat(admin): POST /api/admin/feedback/[id]/resolve toggle

Admin-only resolved_at flag on message_feedback. Body { resolved: boolean }
validated with zod. Delegates to lib/feedback.resolveFeedback.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `GET /api/admin/feedback/top-queries` route

**Files:**
- Create: `app/api/admin/feedback/top-queries/route.ts`
- Create: `tests/api/admin/feedback-top-queries.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

function setupMocks(opts: { isAdmin: boolean; rows?: Array<{ content: string; count: number }> }) {
  const topQueries = vi.fn().mockResolvedValue(opts.rows ?? []);
  vi.doMock('@/lib/auth', () => {
    class NotAdmin extends Error {
      constructor() { super('not admin'); this.name = 'NotAdmin'; }
    }
    return {
      requireAdmin: vi.fn().mockImplementation(() => {
        if (!opts.isAdmin) throw new NotAdmin();
      }),
      NotAdmin,
    };
  });
  vi.doMock('@/lib/feedback', () => ({ topQueries }));
  return { topQueries };
}

function buildReq(qs = ''): Request {
  return new Request(`http://x/api/admin/feedback/top-queries${qs}`);
}

describe('GET /api/admin/feedback/top-queries', () => {
  it('returns 404 for non-admin', async () => {
    setupMocks({ isAdmin: false });
    const { GET } = await import('@/app/api/admin/feedback/top-queries/route');
    const res = await GET(buildReq());
    expect(res.status).toBe(404);
  });

  it('returns rows', async () => {
    const m = setupMocks({
      isAdmin: true,
      rows: [{ content: 'q1', count: 10 }, { content: 'q2', count: 5 }],
    });
    const { GET } = await import('@/app/api/admin/feedback/top-queries/route');
    const res = await GET(buildReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows).toHaveLength(2);
    expect(m.topQueries).toHaveBeenCalledWith(30, 10);
  });

  it('respects custom days and limit', async () => {
    const m = setupMocks({ isAdmin: true });
    const { GET } = await import('@/app/api/admin/feedback/top-queries/route');
    await GET(buildReq('?days=7&limit=5'));
    expect(m.topQueries).toHaveBeenCalledWith(7, 5);
  });

  it('rejects invalid days', async () => {
    setupMocks({ isAdmin: true });
    const { GET } = await import('@/app/api/admin/feedback/top-queries/route');
    const res = await GET(buildReq('?days=-1'));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Implement `app/api/admin/feedback/top-queries/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, NotAdmin } from '@/lib/auth';
import { topQueries } from '@/lib/feedback';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Query = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof NotAdmin) return new NextResponse('Not Found', { status: 404 });
    throw err;
  }

  const url = new URL(req.url);
  let parsed: z.infer<typeof Query>;
  try {
    parsed = Query.parse(Object.fromEntries(url.searchParams.entries()));
  } catch {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }

  const rows = await topQueries(parsed.days, parsed.limit);
  return NextResponse.json({ rows });
}
```

- [ ] **Step 3: Test + typecheck + commit**

```bash
npm test -- tests/api/admin/feedback-top-queries.test.ts
npm run typecheck
git add app/api/admin/feedback/top-queries/route.ts tests/api/admin/feedback-top-queries.test.ts
git commit -m "$(cat <<'EOF'
feat(admin): GET /api/admin/feedback/top-queries aggregation

Admin-only top user queries from sessions.messages JSONB. zod query
params (days 1-365, limit 1-50). Delegates to lib/feedback.topQueries
which calls the SQL function admin_top_queries.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `<TopQueries>` component

**Files:**
- Create: `components/admin/TopQueries.tsx`
- Create: `tests/components/admin/TopQueries.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TopQueries } from '@/components/admin/TopQueries';

describe('TopQueries', () => {
  it('renders rows with content and count', () => {
    render(
      <TopQueries
        rows={[{ content: 'O que é Kraljic?', count: 8 }, { content: 'Como reduzir custos?', count: 5 }]}
        loading={false}
      />,
    );
    expect(screen.getByText('O que é Kraljic?')).toBeTruthy();
    expect(screen.getByText('8')).toBeTruthy();
  });

  it('shows fallback when rows is empty', () => {
    render(<TopQueries rows={[]} loading={false} />);
    expect(screen.getByText(/sem queries|nenhuma/i)).toBeTruthy();
  });

  it('shows loading state', () => {
    render(<TopQueries rows={[]} loading={true} />);
    expect(screen.getByText(/carregando/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Implement**

```tsx
'use client';

type Row = { content: string; count: number };

export function TopQueries({ rows, loading }: { rows: Row[]; loading: boolean }) {
  return (
    <section className="rounded-md border border-border bg-card p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        Top queries · últimos 30 dias
      </h3>
      {loading && <p className="text-xs text-muted-foreground">Carregando…</p>}
      {!loading && rows.length === 0 && (
        <p className="text-xs text-muted-foreground">Sem queries no período.</p>
      )}
      {!loading && rows.length > 0 && (
        <ul className="space-y-1 text-xs">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center justify-between gap-2">
              <span className="truncate flex-1">{r.content}</span>
              <span className="tabular-nums text-muted-foreground">{r.count}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Test + typecheck + commit**

```bash
npm test -- tests/components/admin/TopQueries.test.tsx
npm run typecheck
git add components/admin/TopQueries.tsx tests/components/admin/TopQueries.test.tsx
git commit -m "$(cat <<'EOF'
feat(admin): TopQueries component (top user questions last 30d)

Pure presentational. Parent fetches via /api/admin/feedback/top-queries
and passes rows + loading. Empty state and loading state handled.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `<FeedbackList>` component

Filter bar + table of feedback rows. Click selects.

**Files:**
- Create: `components/admin/FeedbackList.tsx`
- Create: `tests/components/admin/FeedbackList.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FeedbackList } from '@/components/admin/FeedbackList';
import type { FeedbackRow } from '@/lib/feedback';

const rows: FeedbackRow[] = [
  {
    id: 'f1',
    trace_id: 't1',
    session_id: 's1',
    user_id: 'u1',
    rating: 'down',
    comment: 'resposta confusa',
    created_at: '2026-05-08T12:00:00Z',
    updated_at: '2026-05-08T12:00:00Z',
    resolved_at: null,
  },
  {
    id: 'f2',
    trace_id: 't2',
    session_id: 's2',
    user_id: 'u2',
    rating: 'up',
    comment: null,
    created_at: '2026-05-08T11:00:00Z',
    updated_at: '2026-05-08T11:00:00Z',
    resolved_at: '2026-05-08T13:00:00Z',
  },
];

describe('FeedbackList', () => {
  it('renders rows with rating, comment preview, date, resolved badge', () => {
    render(
      <FeedbackList
        rows={rows}
        selectedId={null}
        filters={{ rating: undefined, resolved: false, hasComment: undefined }}
        onSelect={() => {}}
        onFilterChange={() => {}}
      />,
    );
    expect(screen.getByText(/resposta confusa/)).toBeTruthy();
    expect(screen.getByText(/resolvido/i)).toBeTruthy();
  });

  it('click on row calls onSelect with id', () => {
    const onSelect = vi.fn();
    render(
      <FeedbackList
        rows={rows}
        selectedId={null}
        filters={{ rating: undefined, resolved: false, hasComment: undefined }}
        onSelect={onSelect}
        onFilterChange={() => {}}
      />,
    );
    fireEvent.click(screen.getByText(/resposta confusa/).closest('tr')!);
    expect(onSelect).toHaveBeenCalledWith('f1');
  });

  it('rating toggle in filter bar fires onFilterChange', () => {
    const onFilterChange = vi.fn();
    render(
      <FeedbackList
        rows={rows}
        selectedId={null}
        filters={{ rating: undefined, resolved: false, hasComment: undefined }}
        onSelect={() => {}}
        onFilterChange={onFilterChange}
      />,
    );
    const downBtn = screen.getByRole('button', { name: /^👎/ });
    fireEvent.click(downBtn);
    expect(onFilterChange).toHaveBeenCalledWith(expect.objectContaining({ rating: 'down' }));
  });
});
```

- [ ] **Step 2: Implement**

```tsx
'use client';

import { Button } from '@/components/ui/button';
import type { FeedbackRow } from '@/lib/feedback';

export type Filters = {
  rating?: 'up' | 'down';
  resolved: boolean; // false = unresolved (default), true = resolved
  hasComment?: boolean;
};

type Props = {
  rows: FeedbackRow[];
  selectedId: string | null;
  filters: Filters;
  onSelect: (id: string) => void;
  onFilterChange: (next: Filters) => void;
};

export function FeedbackList({ rows, selectedId, filters, onSelect, onFilterChange }: Props) {
  return (
    <div className="border border-border rounded-md bg-card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border bg-muted/30 text-xs">
        <FilterButton
          label="👍 Positivos"
          active={filters.rating === 'up'}
          onClick={() => onFilterChange({ ...filters, rating: filters.rating === 'up' ? undefined : 'up' })}
        />
        <FilterButton
          label="👎 Negativos"
          active={filters.rating === 'down'}
          onClick={() => onFilterChange({ ...filters, rating: filters.rating === 'down' ? undefined : 'down' })}
        />
        <FilterButton
          label="Apenas com comentário"
          active={filters.hasComment === true}
          onClick={() => onFilterChange({ ...filters, hasComment: filters.hasComment ? undefined : true })}
        />
        <FilterButton
          label={filters.resolved ? 'Resolvidos' : 'Não-resolvidos'}
          active={true}
          onClick={() => onFilterChange({ ...filters, resolved: !filters.resolved })}
        />
      </div>
      <table className="w-full text-xs">
        <thead className="text-muted-foreground">
          <tr>
            <th className="text-left p-2 w-10">Rating</th>
            <th className="text-left p-2">Comentário</th>
            <th className="text-left p-2 w-32">Data</th>
            <th className="text-left p-2 w-24">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="p-4 text-center text-muted-foreground">
                Sem feedback no filtro atual.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr
              key={r.id}
              onClick={() => onSelect(r.id)}
              className={`cursor-pointer border-t border-border ${
                selectedId === r.id ? 'bg-primary/10' : 'hover:bg-accent'
              }`}
            >
              <td className="p-2 text-base">{r.rating === 'up' ? '👍' : '👎'}</td>
              <td className="p-2 truncate max-w-md">
                {r.comment ? r.comment.slice(0, 80) : <span className="text-muted-foreground italic">(sem comentário)</span>}
              </td>
              <td className="p-2 tabular-nums text-muted-foreground">
                {new Date(r.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
              </td>
              <td className="p-2">
                {r.resolved_at ? (
                  <span className="text-emerald-600 dark:text-emerald-400">resolvido</span>
                ) : (
                  <span className="text-muted-foreground">aberto</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FilterButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? 'default' : 'outline'}
      onClick={onClick}
      className="h-7 text-xs"
    >
      {label}
    </Button>
  );
}
```

- [ ] **Step 3: Test + typecheck + commit**

```bash
npm test -- tests/components/admin/FeedbackList.test.tsx
npm run typecheck
git add components/admin/FeedbackList.tsx tests/components/admin/FeedbackList.test.tsx
git commit -m "$(cat <<'EOF'
feat(admin): FeedbackList component (rows + filter bar)

Pure presentational. Filter bar exposes rating toggle (👍/👎),
has-comment toggle, resolved/unresolved toggle. Rows show rating
icon, comment preview, formatted date (pt-BR), and a resolved badge.
Click selects via callback.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: `<FeedbackDetail>` component

Drill-down: extract Q + A + chunks from `sessions.messages` JSONB by trace_id matching. Resolve button.

**Files:**
- Create: `components/admin/FeedbackDetail.tsx`
- Create: `tests/components/admin/FeedbackDetail.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FeedbackDetail } from '@/components/admin/FeedbackDetail';
import type { FeedbackRow } from '@/lib/feedback';

const item: FeedbackRow = {
  id: 'f1',
  trace_id: 't1',
  session_id: 's1',
  user_id: 'u1',
  rating: 'down',
  comment: 'resposta incompleta',
  created_at: '2026-05-08T12:00:00Z',
  updated_at: '2026-05-08T12:00:00Z',
  resolved_at: null,
};

const sessionMessages = [
  { role: 'user', content: 'Como aplicar Kraljic?' },
  {
    role: 'assistant',
    content: 'Aplica-se em 4 quadrantes...',
    annotations: [
      {
        traceId: 't1',
        sources: [
          { articleId: 'a1', articleTitle: 'Curva ABC', theme: 'Kraljic' },
        ],
      },
    ],
  },
];

describe('FeedbackDetail', () => {
  it('renders question, answer, sources, and comment', () => {
    render(
      <FeedbackDetail
        item={item}
        sessionMessages={sessionMessages}
        onResolve={() => {}}
      />,
    );
    expect(screen.getByText(/Como aplicar Kraljic/)).toBeTruthy();
    expect(screen.getByText(/Aplica-se em 4 quadrantes/)).toBeTruthy();
    expect(screen.getByText('Curva ABC')).toBeTruthy();
    expect(screen.getByText(/resposta incompleta/)).toBeTruthy();
  });

  it('resolve button calls onResolve(true) when item is unresolved', () => {
    const onResolve = vi.fn();
    render(
      <FeedbackDetail item={item} sessionMessages={sessionMessages} onResolve={onResolve} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /marcar como resolvido/i }));
    expect(onResolve).toHaveBeenCalledWith(true);
  });

  it('resolve button calls onResolve(false) when item is already resolved', () => {
    const onResolve = vi.fn();
    const resolved = { ...item, resolved_at: '2026-05-08T13:00:00Z' };
    render(
      <FeedbackDetail item={resolved} sessionMessages={sessionMessages} onResolve={onResolve} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /desmarcar/i }));
    expect(onResolve).toHaveBeenCalledWith(false);
  });

  it('falls back to last assistant message when traceId match fails', () => {
    const stale = [
      { role: 'user', content: 'q' },
      { role: 'assistant', content: 'a-without-trace', annotations: [] },
    ];
    render(
      <FeedbackDetail item={item} sessionMessages={stale} onResolve={() => {}} />,
    );
    expect(screen.getByText(/a-without-trace/)).toBeTruthy();
  });

  it('does not render comment block when item.comment is null', () => {
    const noComment = { ...item, comment: null };
    render(
      <FeedbackDetail item={noComment} sessionMessages={sessionMessages} onResolve={() => {}} />,
    );
    // Heading "Comentário" should not appear when comment is null
    expect(screen.queryByText(/comentário/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Implement**

```tsx
'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import type { FeedbackRow } from '@/lib/feedback';

type ChunkSource = {
  articleId?: string;
  articleTitle?: string;
  theme?: string;
  content?: string;
};

type Annotation = {
  traceId?: string;
  sources?: ChunkSource[];
};

type Message = {
  role: 'user' | 'assistant';
  content: string;
  annotations?: Annotation[];
};

type Props = {
  item: FeedbackRow;
  sessionMessages: Message[];
  onResolve: (resolved: boolean) => void;
};

function findContext(messages: Message[], traceId: string) {
  let assistantIdx = -1;
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]!;
    if (m.role !== 'assistant') continue;
    const hasMatch = m.annotations?.some((a) => a.traceId === traceId);
    if (hasMatch) {
      assistantIdx = i;
      break;
    }
  }
  if (assistantIdx === -1) {
    // Fallback: last assistant message in the session
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]!.role === 'assistant') {
        assistantIdx = i;
        break;
      }
    }
  }
  if (assistantIdx === -1) return { question: null, answer: null, sources: [] };
  // The user message immediately preceding the assistant
  let userIdx = -1;
  for (let i = assistantIdx - 1; i >= 0; i--) {
    if (messages[i]!.role === 'user') {
      userIdx = i;
      break;
    }
  }
  const assistant = messages[assistantIdx]!;
  const question = userIdx >= 0 ? messages[userIdx]!.content : null;
  const sources = assistant.annotations?.flatMap((a) => a.sources ?? []) ?? [];
  return { question, answer: assistant.content, sources };
}

export function FeedbackDetail({ item, sessionMessages, onResolve }: Props) {
  const { question, answer, sources } = useMemo(
    () => findContext(sessionMessages, item.trace_id),
    [sessionMessages, item.trace_id],
  );
  const resolved = item.resolved_at !== null;

  return (
    <div className="p-4 space-y-3 overflow-y-auto h-full text-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {item.rating === 'up' ? '👍' : '👎'} ·{' '}
          {new Date(item.created_at).toLocaleString('pt-BR')}
        </span>
        <Button
          size="sm"
          variant={resolved ? 'outline' : 'default'}
          onClick={() => onResolve(!resolved)}
        >
          {resolved ? '↶ Desmarcar' : '✓ Marcar como resolvido'}
        </Button>
      </div>

      {question !== null && (
        <div>
          <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Pergunta</h4>
          <p className="bg-muted/40 p-2 rounded border-l-2 border-border whitespace-pre-wrap">{question}</p>
        </div>
      )}

      {answer !== null && (
        <div>
          <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Resposta</h4>
          <p className="bg-muted/40 p-2 rounded border-l-2 border-border whitespace-pre-wrap">{answer}</p>
        </div>
      )}

      {sources.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">
            Chunks usados ({sources.length})
          </h4>
          <ul className="space-y-1 text-xs">
            {sources.map((s, i) => (
              <li key={i} className="flex items-center gap-2 bg-muted/30 px-2 py-1 rounded">
                {s.theme && (
                  <span className="text-[10px] uppercase rounded bg-primary/10 text-primary px-1.5 py-0.5">
                    {s.theme}
                  </span>
                )}
                <span className="truncate">{s.articleTitle ?? s.articleId ?? '(sem título)'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {item.comment && (
        <div>
          <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Comentário</h4>
          <blockquote className="bg-muted/40 p-2 rounded border-l-2 border-amber-500 italic whitespace-pre-wrap">
            {item.comment}
          </blockquote>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Test + typecheck + commit**

```bash
npm test -- tests/components/admin/FeedbackDetail.test.tsx
npm run typecheck
git add components/admin/FeedbackDetail.tsx tests/components/admin/FeedbackDetail.test.tsx
git commit -m "$(cat <<'EOF'
feat(admin): FeedbackDetail drill-down (Q + A + chunks + comment)

Pure presentational. findContext walks sessions.messages to find the
assistant message whose annotations[].traceId matches the feedback's
trace_id, then locates the immediately-preceding user message and
extracts annotations[].sources for the chunks list. Falls back to
last assistant message when traceId match fails. Resolve button
toggles via callback.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: `<FeedbackRoot>` + page wiring

Owns filter + selectedId state. Fetches feedback list + selected session messages + top queries. Wires resolve callback to PATCH the API.

**Files:**
- Create: `components/admin/FeedbackRoot.tsx`
- Create: `app/admin/feedback/page.tsx`

- [ ] **Step 1: Implement `<FeedbackRoot>`**

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabaseBrowser } from '@/lib/db/supabase-browser';
import { FeedbackList, type Filters } from '@/components/admin/FeedbackList';
import { FeedbackDetail } from '@/components/admin/FeedbackDetail';
import { TopQueries } from '@/components/admin/TopQueries';
import type { FeedbackRow } from '@/lib/feedback';

type Message = { role: 'user' | 'assistant'; content: string; annotations?: unknown[] };

export function FeedbackRoot() {
  const [filters, setFilters] = useState<Filters>({ rating: undefined, resolved: false, hasComment: undefined });
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sessionMessages, setSessionMessages] = useState<Message[]>([]);
  const [topRows, setTopRows] = useState<Array<{ content: string; count: number }>>([]);
  const [topLoading, setTopLoading] = useState(true);

  const refetchList = useCallback(async () => {
    const qs = new URLSearchParams();
    if (filters.rating) qs.set('rating', filters.rating);
    qs.set('resolved', filters.resolved ? 'true' : 'false');
    if (filters.hasComment === true) qs.set('has_comment', 'true');
    qs.set('limit', '50');
    qs.set('offset', '0');
    const res = await fetch(`/api/admin/feedback?${qs}`);
    if (!res.ok) {
      toast.error('Falha ao carregar feedback');
      return;
    }
    const body = (await res.json()) as { rows: FeedbackRow[] };
    setRows(body.rows);
  }, [filters]);

  useEffect(() => { refetchList(); }, [refetchList]);

  // Load session.messages when selection changes
  useEffect(() => {
    if (!selectedId) {
      setSessionMessages([]);
      return;
    }
    const item = rows.find((r) => r.id === selectedId);
    if (!item) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabaseBrowser()
        .from('sessions')
        .select('messages')
        .eq('id', item.session_id)
        .maybeSingle();
      if (cancelled) return;
      const msgs = (data?.messages ?? []) as Message[];
      setSessionMessages(msgs);
    })();
    return () => { cancelled = true; };
  }, [selectedId, rows]);

  // Initial top queries fetch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/feedback/top-queries?days=30&limit=10');
        if (!res.ok) return;
        const body = (await res.json()) as { rows: Array<{ content: string; count: number }> };
        if (!cancelled) setTopRows(body.rows);
      } finally {
        if (!cancelled) setTopLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleResolve(resolved: boolean) {
    if (!selectedId) return;
    const res = await fetch(`/api/admin/feedback/${selectedId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolved }),
    });
    if (!res.ok) {
      toast.error('Falha ao salvar');
      return;
    }
    toast.success(resolved ? 'Marcado como resolvido' : 'Reaberto');
    // Re-fetch list so the row updates / drops out (depending on filter)
    await refetchList();
    if (filters.resolved !== resolved) setSelectedId(null);
  }

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Feedback</h2>
        <p className="text-xs text-muted-foreground">
          Loop de revisão dos 👍/👎 dos usuários. Marque como resolvido depois de agir.
        </p>
      </div>
      <TopQueries rows={topRows} loading={topLoading} />
      <div className="grid grid-cols-[1.4fr_1fr] gap-4 min-h-[420px]">
        <FeedbackList
          rows={rows}
          selectedId={selectedId}
          filters={filters}
          onSelect={setSelectedId}
          onFilterChange={setFilters}
        />
        <div className="bg-card border border-border rounded-md">
          {selected ? (
            <FeedbackDetail
              item={selected}
              sessionMessages={sessionMessages}
              onResolve={handleResolve}
            />
          ) : (
            <div className="p-4 text-xs text-muted-foreground">Selecione um item à esquerda.</div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement `app/admin/feedback/page.tsx`**

```tsx
import { requireAdmin, NotAdmin } from '@/lib/auth';
import { notFound } from 'next/navigation';
import { FeedbackRoot } from '@/components/admin/FeedbackRoot';

export const dynamic = 'force-dynamic';

export default async function AdminFeedbackPage() {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof NotAdmin) notFound();
    throw err;
  }
  return <FeedbackRoot />;
}
```

- [ ] **Step 3: Typecheck + manual smoke**

```bash
npm run typecheck
```

Expected: PASS.

If running locally with `npm run dev`, navigate to `http://localhost:3000/admin/feedback` and confirm:
- Page renders without errors
- Filters interact (toggling rating/resolved updates URL/list)
- Click on row opens detail with question/answer (assuming there's data in the DB; if no `message_feedback` rows exist yet, list is empty — that's fine)
- TopQueries loads (or shows fallback)

- [ ] **Step 4: Commit**

```bash
git add components/admin/FeedbackRoot.tsx app/admin/feedback/page.tsx
git commit -m "$(cat <<'EOF'
feat(admin): /admin/feedback page integration

FeedbackRoot owns filter + selectedId + sessionMessages state. Fetches
list via /api/admin/feedback (re-fetches on filter change), pulls
session.messages directly from supabaseBrowser when selection changes
(client-only RLS-allowed query: admin owns own sessions, but the
session in question may belong to another user — falls back to nothing
visible if RLS blocks; admin can investigate via Supabase dashboard).
Top queries fetched once on mount.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

NOTE: the `supabaseBrowser` query for `sessions.messages` will be blocked by RLS for sessions belonging to OTHER users (the admin can only read their own sessions via the cookie-aware client). For v1 this means feedback drill-down only works for the admin's own sessions. For full drill-down on other users' sessions, Task 9.5 (below) is needed.

- [ ] **Step 5 (FOLLOWUP): Add a server-side route to fetch session messages by-id with admin gate**

Create `app/api/admin/sessions/[id]/messages/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { requireAdmin, NotAdmin } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof NotAdmin) return new NextResponse('Not Found', { status: 404 });
    throw err;
  }
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from('sessions')
    .select('messages')
    .eq('id', params.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'fetch_failed' }, { status: 500 });
  return NextResponse.json({ messages: data?.messages ?? [] });
}
```

Update `<FeedbackRoot>` Step 1's effect that loads `sessionMessages` — replace the `supabaseBrowser()` call with:

```ts
const res = await fetch(`/api/admin/sessions/${item.session_id}/messages`);
if (!res.ok) return;
const body = (await res.json()) as { messages: Message[] };
if (!cancelled) setSessionMessages(body.messages);
```

Add a basic test:

`tests/api/admin/sessions-messages.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => { vi.resetModules(); });

function setupMocks(opts: { isAdmin: boolean; messages?: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: { messages: opts.messages ?? [] }, error: null });
  vi.doMock('@/lib/auth', () => {
    class NotAdmin extends Error { constructor() { super('not admin'); this.name = 'NotAdmin'; } }
    return {
      requireAdmin: vi.fn().mockImplementation(() => { if (!opts.isAdmin) throw new NotAdmin(); }),
      NotAdmin,
    };
  });
  vi.doMock('@/lib/db/supabase', () => ({
    getServerSupabase: () => ({
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
    }),
  }));
}

describe('GET /api/admin/sessions/[id]/messages', () => {
  it('returns 404 for non-admin', async () => {
    setupMocks({ isAdmin: false });
    const { GET } = await import('@/app/api/admin/sessions/[id]/messages/route');
    const res = await GET(new Request('http://x'), { params: { id: 's1' } });
    expect(res.status).toBe(404);
  });

  it('returns messages for admin', async () => {
    setupMocks({ isAdmin: true, messages: [{ role: 'user', content: 'q' }] });
    const { GET } = await import('@/app/api/admin/sessions/[id]/messages/route');
    const res = await GET(new Request('http://x'), { params: { id: 's1' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.messages).toHaveLength(1);
  });
});
```

- [ ] **Step 6: Test + typecheck + commit**

```bash
npm test -- tests/api/admin/sessions-messages.test.ts
npm run typecheck
git add app/api/admin/sessions/\[id\]/messages/route.ts tests/api/admin/sessions-messages.test.ts components/admin/FeedbackRoot.tsx
git commit -m "$(cat <<'EOF'
feat(admin): GET /api/admin/sessions/[id]/messages for drill-down

FeedbackRoot was using supabaseBrowser to fetch sessions.messages
which fails on RLS for sessions belonging to other users. Adds an
admin-only server route using service-role; FeedbackRoot now calls
that route. Admin can now drill into any user's session messages.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: AdminSidebar entry

**Files:**
- Modify: `components/admin/AdminSidebar.tsx`

- [ ] **Step 1: Add the entry**

Edit `components/admin/AdminSidebar.tsx`:

```ts
import { Users, FileText, Upload, MessageSquare, ArrowLeft } from 'lucide-react';

const ITEMS = [
  { href: '/admin/users', label: 'Usuários', Icon: Users },
  { href: '/admin/articles', label: 'Artigos', Icon: FileText },
  { href: '/admin/ingest', label: 'Ingestão', Icon: Upload },
  { href: '/admin/feedback', label: 'Feedback', Icon: MessageSquare },
];
```

- [ ] **Step 2: Typecheck + commit**

```bash
npm run typecheck
git add components/admin/AdminSidebar.tsx
git commit -m "$(cat <<'EOF'
feat(admin): add Feedback entry to AdminSidebar

Lucide MessageSquare icon. Linked to /admin/feedback.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Smoke doc + CLAUDE.md + PR + tag

**Files:**
- Modify: `docs/product/beta-smoke-test.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Append smoke section**

Append at end of `docs/product/beta-smoke-test.md`:

```markdown

### Sub-projeto 14 — Feedback Review Loop

- [ ] Beta user dá 👎 com comentário → aparece em `/admin/feedback` em ≤30s, com a pergunta e o comentário visíveis.
- [ ] Filtro "rating=down" remove os 👍 da lista; "resolvidos=true" alterna pra mostrar resolvidos.
- [ ] Click num row mostra pergunta+resposta+chunks (com badges de tema do sub-projeto 12/13).
- [ ] Botão "Marcar como resolvido" persiste após F5; row some da view default.
- [ ] Top queries panel mostra as N perguntas mais frequentes; números fazem sentido vs uso real.
- [ ] Tentar setar `resolved` via dev tools com não-admin: API retorna 404.
```

- [ ] **Step 2: Update CLAUDE.md**

Add a row to "## Status — sub-projetos completos" table after sub-projeto 13:

```markdown
| 14 | `feedback-review-loop-complete` | Página `/admin/feedback` lê `message_feedback` (sub-projeto 9) via service-role e lista 👍/👎 com filtros (rating, resolvido, has-comment, date range). Migration 0011 adiciona `resolved_at timestamptz` + index parcial. Detail pane extrai pergunta+resposta+chunks de `sessions.messages` JSONB via match `annotations[].traceId === feedback.trace_id` (fallback: último assistant message da sessão). Painel `<TopQueries>` mostra top 10 user queries dos últimos 30 dias via SQL function `admin_top_queries`. PATCH endpoint resolve / desfaz resolve via flag `resolved_at`. Sem ML — constrói o dataset humano-curado pra Tier 2/3 futuro. |
```

Add to "## O que evitar" (append at end of section, before next `##`):

```markdown
- Ler `message_feedback` via cookie-aware client (`supabaseBrowser`) em código admin — RLS é owner-only e admin não consegue ver feedback de outros users. Use `getServerSupabase()` (service-role) em route handler admin-gated. Pattern já estabelecido em `/api/admin/articles`.
- Ler `sessions.messages` via `supabaseBrowser` em UI admin — RLS owner-only bloqueia sessões de outros users. Use `GET /api/admin/sessions/[id]/messages` (sub-projeto 14) que usa service-role.
- Esquecer de criar a SQL function `admin_top_queries` ao reaplicar migration 0011 — sem ela, `topQueries()` retorna array vazio sem erro óbvio. A função é parte da migration 0011; verifique com `select count(*) from pg_proc where proname='admin_top_queries'` se suspeitar.
- Confiar no `last user message` do `sessions.messages` JSONB pra preview de feedback — pode não bater com o turno do trace. v1 do sub-projeto 14 NÃO mostra preview na lista por isso. Se um sub-projeto futuro quiser preview, persistir trace_id por turno em `sessions.messages` JSONB.
- Considerar `resolved_at` como audit log — não há `resolved_by` nem timeline. Single-tenant atual = single admin OK; em B2B precisa schema change.
```

Update `## Estrutura de pastas` to add the new admin feedback files:

```
/components
  /admin (AdminSidebar, ..., FeedbackRoot, FeedbackList, FeedbackDetail, TopQueries)
```

And under `/app`:

```
  /admin
    ...
    /feedback/page.tsx                  (gated por requireAdmin → 404; mounts <FeedbackRoot/>)
  /api/admin
    ...
    /feedback/route.ts                  (Node: GET paginated + filtered)
    /feedback/[id]/resolve/route.ts     (Node: POST toggle resolved_at)
    /feedback/top-queries/route.ts      (Node: GET aggregation)
    /sessions/[id]/messages/route.ts    (Node: admin-gated GET de sessions.messages JSONB)
```

- [ ] **Step 3: Run final CI gate locally**

```bash
npm run typecheck
npm test
```

Expected: typecheck clean, full vitest suite green (~312 tests).

(Skip `npm run rag:eval` — sub-projeto 14 doesn't touch RAG; eval state unchanged.)

- [ ] **Step 4: Commit docs**

```bash
git add docs/product/beta-smoke-test.md CLAUDE.md
git commit -m "$(cat <<'EOF'
docs(CLAUDE.md): record sub-projeto 14 (feedback review loop)

Captures the admin feedback review page, schema (resolved_at flag),
service-role pattern for admin reads of message_feedback / sessions.messages,
the admin_top_queries SQL function, and the limitation that v1 doesn't
show question preview in the list. Smoke test adds 6 manual checks.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5: Push branch + open PR**

```bash
git push -u origin feat/feedback-review-loop
```

Then open the PR via gh:

```bash
gh pr create --title "feat: feedback review loop (sub-projeto 14)" --body "$(cat <<'EOF'
## Summary

Closes the loop on 👍/👎 feedback (sub-projeto 9) by giving the admin a `/admin/feedback` page to review, drill into, and mark as resolved. Adds migration 0011 (`resolved_at` flag + partial index + `admin_top_queries` SQL function). 11 tasks, ~25 new vitest tests.

Spec: `docs/superpowers/specs/2026-05-08-feedback-review-loop-design.md`
Plan: `docs/superpowers/plans/2026-05-08-feedback-review-loop.md`

## Highlights

- New page `/admin/feedback` with 3 components (`<FeedbackList>`, `<FeedbackDetail>`, `<TopQueries>`)
- 4 new admin-only API routes (list, resolve, top-queries, sessions-messages)
- `lib/feedback.ts` extended with admin helpers (service-role, bypasses RLS)
- `<FeedbackDetail>` extracts Q+A+chunks from `sessions.messages` JSONB by `traceId` matching, with fallback
- Migration 0011 schema + SQL function applied via psycopg

## Test plan

- [ ] CI green (typecheck + vitest + pytest + rag:eval)
- [ ] Manual smoke: dar 👎 com comentário no chat → aparece em /admin/feedback
- [ ] Manual smoke: clicar em row → pergunta+resposta+chunks aparecem
- [ ] Manual smoke: marcar como resolvido → row some do filtro default; reaparece em "resolvidos=true"
- [ ] Manual smoke: top queries mostra perguntas reais, não vazio (assumindo histórico)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 6: After merge, apply tag**

```bash
git checkout main
git pull origin main
git tag feedback-review-loop-complete
git push origin feedback-review-loop-complete
```

(Do this AFTER the PR is reviewed & merged — not before.)

- [ ] **Step 7: Verify CI green**

```bash
gh run list --branch main --limit 1 --json status,conclusion,headSha,displayTitle
```

If CI fails on the merge commit, fix and create a new commit on main (do not amend the tagged commit).

---

## Verification checklist (sub-projeto 14 exit criteria)

After Task 11:

1. ✅ Migration `0011` applied; `resolved_at` column + partial index + `admin_top_queries` function exist.
2. ✅ `lib/feedback.ts` exports `listFeedback`, `resolveFeedback`, `topQueries` covered by ~10 vitest tests.
3. ✅ 4 admin-only API routes: `/api/admin/feedback` (GET), `/api/admin/feedback/[id]/resolve` (POST), `/api/admin/feedback/top-queries` (GET), `/api/admin/sessions/[id]/messages` (GET); all gated by `requireAdmin()`; ~15 vitest tests.
4. ✅ 3 client components rendered in `/admin/feedback` page; click on row opens detail; resolve flips state.
5. ✅ AdminSidebar has "Feedback" entry.
6. ✅ Smoke test in `docs/product/beta-smoke-test.md` has 6 new items.
7. ✅ CLAUDE.md updated with sub-projeto 14 row + structure update + 5 gotchas.
8. ✅ PR opened on `feat/feedback-review-loop`; CI green; merged.
9. ✅ Tag `feedback-review-loop-complete` applied to merge commit.
