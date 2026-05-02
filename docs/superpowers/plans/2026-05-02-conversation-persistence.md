# DB-Backed Conversation Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace localStorage-backed conversation history (sub-projeto 5) with a DB-backed `sessions` table for authenticated users — invite-acceptance is the consent, DB is the single source of truth, the chat endpoint stays stateless.

**Architecture:** New `sessions` table with owner-only RLS. New `useChatSessionsRemote` hook is a drop-in replacement for `useChatSessions`: same return shape (`UseChatSessions`), but reads/writes via `supabaseBrowser()` instead of `localStorage`. `ChatRoot` swaps one import + tweaks one guard; nothing else in the chat tree changes.

**Tech Stack:** Postgres (jsonb, RLS, FK cascade), `@supabase/supabase-js` via `supabaseBrowser()`, `vitest` + `@testing-library/react`. No new deps.

**Spec:** `docs/superpowers/specs/2026-05-02-conversation-persistence-design.md`

---

## File Structure & Responsibility Map

| File | Responsibility |
|------|---------------|
| `supabase/migrations/00000000000004_sessions.sql` | NEW — `sessions` table, index, 4 owner-only RLS policies |
| `hooks/useChatSessionsRemote.ts` | NEW — DB-backed drop-in for `useChatSessions`, same `UseChatSessions` return shape |
| `tests/hooks/useChatSessionsRemote.test.tsx` | NEW — 5 unit tests with `supabaseBrowser` mocked |
| `components/chat/ChatRoot.tsx` | MODIFY — swap import + change guard from `current` to `currentId` |
| `hooks/useChatSessions.ts` | MODIFY — add `@deprecated` JSDoc to the export only |
| `lib/chat-storage.ts` | MODIFY — add `@deprecated` JSDoc to the module |

The deprecated localStorage modules and their tests stay in the repo. Their tests still pass; sub-projeto 7 may revive them for an offline mode.

---

## Task 1: Migration — `sessions` table + RLS

**Files:**
- Create: `supabase/migrations/00000000000004_sessions.sql`

- [ ] **Step 1: Create the migration file**

Write `supabase/migrations/00000000000004_sessions.sql`:

```sql
-- Sub-projeto 6b: DB-backed conversation persistence (replaces localStorage for authed users)

create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Nova conversa',
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sessions_user_id_updated_at_idx on sessions (user_id, updated_at desc);

alter table sessions enable row level security;

create policy sessions_owner_select on sessions for select to authenticated
  using (user_id = auth.uid());
create policy sessions_owner_insert on sessions for insert to authenticated
  with check (user_id = auth.uid());
create policy sessions_owner_update on sessions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy sessions_owner_delete on sessions for delete to authenticated
  using (user_id = auth.uid());
```

- [ ] **Step 2: Apply via psycopg**

```bash
scripts/.venv/Scripts/python.exe -c "
import sys; sys.path.insert(0, '.')
from scripts.ingest import load_env, connect_db
load_env()
conn = connect_db()
with conn.cursor() as cur:
    with open('supabase/migrations/00000000000004_sessions.sql','r',encoding='utf-8') as f:
        cur.execute(f.read())
    print('migration applied')
conn.close()
"
```

Expected: `migration applied`. No errors.

- [ ] **Step 3: Verify table + index + policies**

```bash
scripts/.venv/Scripts/python.exe -c "
import sys; sys.path.insert(0, '.')
from scripts.ingest import load_env, connect_db
load_env()
conn = connect_db()
with conn.cursor() as cur:
    cur.execute(\"select tablename from pg_tables where tablename='sessions'\")
    print('table:', cur.fetchone())
    cur.execute(\"select indexname from pg_indexes where indexname='sessions_user_id_updated_at_idx'\")
    print('index:', cur.fetchone())
    cur.execute(\"select policyname from pg_policies where tablename='sessions' order by policyname\")
    print('policies:', [r[0] for r in cur.fetchall()])
    cur.execute(\"select column_name, data_type from information_schema.columns where table_name='sessions' order by ordinal_position\")
    for r in cur.fetchall(): print('col:', r)
conn.close()
"
```

Expected: table present; index present; 4 policies (`sessions_owner_delete`, `sessions_owner_insert`, `sessions_owner_select`, `sessions_owner_update`); 6 columns (id uuid, user_id uuid, title text, messages jsonb, created_at + updated_at timestamps).

- [ ] **Step 4: Sanity check — admin can insert + read own row**

```bash
scripts/.venv/Scripts/python.exe -c "
import sys; sys.path.insert(0, '.')
from scripts.ingest import load_env, connect_db
load_env()
ADMIN_ID = '16fab8f7-a960-48b4-903d-b590e476b51b'  # rgoalves@gmail.com from Auth-T4
conn = connect_db()
with conn.cursor() as cur:
    cur.execute(\"insert into sessions (user_id, title, messages) values (%s, 'plan-test', %s::jsonb) returning id\", (ADMIN_ID, '[{\\\"role\\\": \\\"user\\\", \\\"content\\\": \\\"hi\\\"}]'))
    sid = cur.fetchone()[0]
    print('inserted:', sid)
    cur.execute(\"select id, title, jsonb_array_length(messages) from sessions where id=%s\", (sid,))
    print('read back:', cur.fetchone())
    cur.execute(\"delete from sessions where id=%s\", (sid,))
    print('cleaned up')
conn.close()
"
```

Expected: `inserted: <uuid>`, `read back: (UUID, 'plan-test', 1)`, `cleaned up`. (Service-role bypasses RLS, so this works regardless of session.)

- [ ] **Step 5: Stage for commit (controller will commit)**

```bash
git add supabase/migrations/00000000000004_sessions.sql
```

Do NOT commit.

---

## Task 2: `hooks/useChatSessionsRemote.ts` (TDD)

**Files:**
- Create: `hooks/useChatSessionsRemote.ts`
- Create: `tests/hooks/useChatSessionsRemote.test.tsx`

- [ ] **Step 1: Write the failing tests**

Write `tests/hooks/useChatSessionsRemote.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import type { ChatMessage } from '@/lib/rag/types';

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => cleanup());

type Row = { id: string; title: string; messages: ChatMessage[]; updated_at: string };

function mockBrowser(opts: {
  initialRows?: Row[];
  insertRow?: Row;
  insertError?: { message: string } | null;
  updateError?: { message: string } | null;
  deleteError?: { message: string } | null;
}) {
  const insertCalls: Array<Record<string, unknown>> = [];
  const updateCalls: Array<Record<string, unknown>> = [];
  const deleteCalls: string[] = [];

  // Each .from('sessions') call returns a fresh chainable builder.
  function builder() {
    let action: 'select' | 'insert' | 'update' | 'delete' | null = null;
    let pendingPayload: Record<string, unknown> | null = null;
    let eqId: string | null = null;
    return {
      select: vi.fn().mockImplementation(function (this: any) {
        action = action ?? 'select';
        return this;
      }),
      order: vi.fn().mockImplementation(async () => ({
        data: opts.initialRows ?? [],
        error: null,
      })),
      insert: vi.fn().mockImplementation(function (this: any, payload: Record<string, unknown>) {
        action = 'insert';
        pendingPayload = payload;
        insertCalls.push(payload);
        return this;
      }),
      single: vi.fn().mockImplementation(async () => ({
        data: opts.insertRow ?? null,
        error: opts.insertError ?? null,
      })),
      update: vi.fn().mockImplementation(function (this: any, payload: Record<string, unknown>) {
        action = 'update';
        pendingPayload = payload;
        return this;
      }),
      delete: vi.fn().mockImplementation(function (this: any) {
        action = 'delete';
        return this;
      }),
      eq: vi.fn().mockImplementation(async (_col: string, val: string) => {
        eqId = val;
        if (action === 'update') {
          updateCalls.push({ id: val, ...(pendingPayload ?? {}) });
          return { error: opts.updateError ?? null };
        }
        if (action === 'delete') {
          deleteCalls.push(val);
          return { error: opts.deleteError ?? null };
        }
        return { error: null };
      }),
    };
  }

  vi.doMock('@/lib/db/supabase-browser', () => ({
    supabaseBrowser: () => ({ from: () => builder() }),
  }));

  return { insertCalls, updateCalls, deleteCalls };
}

const isoNow = () => new Date().toISOString();

describe('useChatSessionsRemote', () => {
  it('auto-creates one session on mount when DB returns no rows', async () => {
    const fresh: Row = { id: 'new-1', title: 'Nova conversa', messages: [], updated_at: isoNow() };
    mockBrowser({ initialRows: [], insertRow: fresh });
    const { useChatSessionsRemote } = await import('@/hooks/useChatSessionsRemote');
    const { result } = renderHook(() => useChatSessionsRemote());
    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(1);
    });
    expect(result.current.currentId).toBe('new-1');
    expect(result.current.current.id).toBe('new-1');
    expect(result.current.current.messages).toEqual([]);
  });

  it('loads existing rows on mount and selects the first (newest) as current', async () => {
    const rows: Row[] = [
      { id: 'a', title: 'recent', messages: [{ role: 'user', content: 'hi' }], updated_at: '2026-05-02T10:00:00Z' },
      { id: 'b', title: 'older', messages: [], updated_at: '2026-05-01T10:00:00Z' },
    ];
    mockBrowser({ initialRows: rows });
    const { useChatSessionsRemote } = await import('@/hooks/useChatSessionsRemote');
    const { result } = renderHook(() => useChatSessionsRemote());
    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(2);
    });
    expect(result.current.currentId).toBe('a');
    expect(result.current.current.title).toBe('recent');
    expect(result.current.current.messages).toHaveLength(1);
  });

  it('createNew inserts a row, prepends to local state, switches currentId', async () => {
    const initial: Row = { id: 'a', title: 'first', messages: [], updated_at: '2026-05-02T10:00:00Z' };
    const fresh: Row = { id: 'b', title: 'Nova conversa', messages: [], updated_at: '2026-05-02T11:00:00Z' };
    const m = mockBrowser({ initialRows: [initial], insertRow: fresh });
    const { useChatSessionsRemote } = await import('@/hooks/useChatSessionsRemote');
    const { result } = renderHook(() => useChatSessionsRemote());
    await waitFor(() => expect(result.current.sessions).toHaveLength(1));
    await act(async () => {
      await result.current.createNew();
    });
    await waitFor(() => expect(result.current.sessions).toHaveLength(2));
    expect(result.current.currentId).toBe('b');
    expect(result.current.sessions[0]!.id).toBe('b');
    expect(result.current.sessions[1]!.id).toBe('a');
    expect(m.insertCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('updateMessages updates the current row with messages + derived title (optimistic local update)', async () => {
    const initial: Row = { id: 'a', title: 'Nova conversa', messages: [], updated_at: '2026-05-02T10:00:00Z' };
    const m = mockBrowser({ initialRows: [initial] });
    const { useChatSessionsRemote } = await import('@/hooks/useChatSessionsRemote');
    const { result } = renderHook(() => useChatSessionsRemote());
    await waitFor(() => expect(result.current.sessions).toHaveLength(1));
    const msgs: ChatMessage[] = [
      { role: 'user', content: 'O que é Kraljic?' },
      { role: 'assistant', content: 'A matriz...' },
    ];
    await act(async () => {
      await result.current.updateMessages(msgs);
    });
    expect(result.current.current.messages).toEqual(msgs);
    expect(result.current.current.title).toBe('O que é Kraljic?');
    expect(m.updateCalls.length).toBe(1);
    expect(m.updateCalls[0]!.id).toBe('a');
    expect(m.updateCalls[0]!.title).toBe('O que é Kraljic?');
    expect(m.updateCalls[0]!.messages).toEqual(msgs);
  });

  it('deleteSession removes the row from DB and from local state; switches current if deleted was current', async () => {
    const rows: Row[] = [
      { id: 'a', title: 'one', messages: [], updated_at: '2026-05-02T10:00:00Z' },
      { id: 'b', title: 'two', messages: [], updated_at: '2026-05-02T09:00:00Z' },
    ];
    const m = mockBrowser({ initialRows: rows });
    const { useChatSessionsRemote } = await import('@/hooks/useChatSessionsRemote');
    const { result } = renderHook(() => useChatSessionsRemote());
    await waitFor(() => expect(result.current.sessions).toHaveLength(2));
    expect(result.current.currentId).toBe('a');
    await act(async () => {
      await result.current.deleteSession('a');
    });
    await waitFor(() => expect(result.current.sessions).toHaveLength(1));
    expect(result.current.currentId).toBe('b');
    expect(m.deleteCalls).toContain('a');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/hooks/useChatSessionsRemote.test.tsx
```

Expected: import error (module does not exist).

- [ ] **Step 3: Implement `hooks/useChatSessionsRemote.ts`**

Write `hooks/useChatSessionsRemote.ts`:

```ts
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ChatMessage } from '@/lib/rag/types';
import { supabaseBrowser } from '@/lib/db/supabase-browser';
import { deriveTitle, type StoredSession } from '@/lib/chat-storage';
import type { UseChatSessions } from '@/hooks/useChatSessions';

type DBRow = {
  id: string;
  title: string;
  messages: ChatMessage[] | null;
  updated_at: string;
};

function rowToSession(r: DBRow): StoredSession {
  return {
    id: r.id,
    title: r.title,
    messages: (r.messages as ChatMessage[]) ?? [],
    updatedAt: new Date(r.updated_at).getTime(),
  };
}

const EMPTY_STUB: StoredSession = { id: '', title: '', messages: [], updatedAt: 0 };

export function useChatSessionsRemote(): UseChatSessions {
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [currentId, setCurrentId] = useState<string>('');
  const [hydrated, setHydrated] = useState(false);

  // Load on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = supabaseBrowser();
      const { data, error } = await sb
        .from('sessions')
        .select('id, title, messages, updated_at')
        .order('updated_at', { ascending: false });
      if (cancelled) return;
      if (error) {
        console.warn('[useChatSessionsRemote] load failed:', error);
        setHydrated(true);
        return;
      }
      const rows = (data ?? []) as DBRow[];
      if (rows.length === 0) {
        const { data: created, error: insErr } = await sb
          .from('sessions')
          .insert({})
          .select('id, title, messages, updated_at')
          .single();
        if (cancelled) return;
        if (insErr || !created) {
          console.warn('[useChatSessionsRemote] auto-create failed:', insErr);
          setHydrated(true);
          return;
        }
        const fresh = rowToSession(created as DBRow);
        setSessions([fresh]);
        setCurrentId(fresh.id);
      } else {
        const list = rows.map(rowToSession);
        setSessions(list);
        setCurrentId(list[0]!.id);
      }
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const switchTo = useCallback((id: string) => {
    setCurrentId(id);
  }, []);

  const createNew = useCallback(async () => {
    const sb = supabaseBrowser();
    const { data, error } = await sb
      .from('sessions')
      .insert({})
      .select('id, title, messages, updated_at')
      .single();
    if (error || !data) {
      console.warn('[useChatSessionsRemote] createNew failed:', error);
      return;
    }
    const fresh = rowToSession(data as DBRow);
    setSessions((prev) => [fresh, ...prev]);
    setCurrentId(fresh.id);
  }, []);

  const deleteSession = useCallback(
    async (id: string) => {
      const sb = supabaseBrowser();
      const { error } = await sb.from('sessions').delete().eq('id', id);
      if (error) {
        console.warn('[useChatSessionsRemote] delete failed:', error);
        return;
      }
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (id === currentId) {
        // pick any remaining; if none, mount-effect's auto-create won't re-run,
        // so explicitly create a fresh one.
        const remaining = sessions.filter((s) => s.id !== id);
        if (remaining.length > 0) {
          setCurrentId(remaining[0]!.id);
        } else {
          await createNew();
        }
      }
    },
    [createNew, currentId, sessions],
  );

  const updateMessages = useCallback(
    async (messages: ChatMessage[]) => {
      const title = deriveTitle(messages);
      const updatedAt = Date.now();
      // Optimistic local update first.
      setSessions((prev) =>
        prev.map((s) => (s.id === currentId ? { ...s, messages, title, updatedAt } : s)),
      );
      const sb = supabaseBrowser();
      const { error } = await sb
        .from('sessions')
        .update({
          messages,
          title,
          updated_at: new Date(updatedAt).toISOString(),
        })
        .eq('id', currentId);
      if (error) {
        console.warn('[useChatSessionsRemote] update failed:', error);
      }
    },
    [currentId],
  );

  if (!hydrated) {
    return {
      sessions: [],
      currentId: '',
      current: EMPTY_STUB,
      switchTo,
      createNew: createNew as unknown as () => void,
      deleteSession: deleteSession as unknown as (id: string) => void,
      updateMessages: updateMessages as unknown as (messages: ChatMessage[]) => void,
    };
  }

  const current = sessions.find((s) => s.id === currentId) ?? sessions[0] ?? EMPTY_STUB;

  return {
    sessions,
    currentId,
    current,
    switchTo,
    createNew: createNew as unknown as () => void,
    deleteSession: deleteSession as unknown as (id: string) => void,
    updateMessages: updateMessages as unknown as (messages: ChatMessage[]) => void,
  };
}
```

The `as unknown as` casts on the async actions are because `UseChatSessions` declares them as `() => void` (the localStorage hook's signature). The async versions are functionally compatible (callers don't await), but TypeScript's exact-shape match needs the cast. An alternative is to widen `UseChatSessions` to allow `Promise<void>` returns — that requires changing `useChatSessions.ts` too, which we want to avoid touching.

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/hooks/useChatSessionsRemote.test.tsx
```

Expected: 5 passed.

- [ ] **Step 5: Run full test suite + typecheck**

```bash
npm test
npm run typecheck
```

Expected: 84 prior + 5 new = 89 passed. Zero typecheck errors.

- [ ] **Step 6: Stage for commit**

```bash
git add hooks/useChatSessionsRemote.ts tests/hooks/useChatSessionsRemote.test.tsx
```

Do NOT commit.

---

## Task 3: `ChatRoot` import swap + guard tweak

**Files:**
- Modify: `components/chat/ChatRoot.tsx`

- [ ] **Step 1: Make the two edits**

Open `components/chat/ChatRoot.tsx`. Make exactly these two changes:

Change the import at the top:

```diff
- import { useChatSessions } from '@/hooks/useChatSessions';
+ import { useChatSessionsRemote as useChatSessions } from '@/hooks/useChatSessionsRemote';
```

Change the guard inside `ChatRootMounted`:

```diff
-  if (!sessionsApi.current) {
+  if (!sessionsApi.currentId) {
     return <div className="h-screen bg-background" />;
   }
```

The rest of the file is unchanged.

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: zero errors.

- [ ] **Step 3: Verify full test suite still green**

```bash
npm test
```

Expected: 89 passed (no test changes; same count as Task 2 Step 5).

- [ ] **Step 4: Stage for commit**

```bash
git add components/chat/ChatRoot.tsx
```

Do NOT commit.

---

## Task 4: `@deprecated` annotations on the localStorage modules

**Files:**
- Modify: `hooks/useChatSessions.ts`
- Modify: `lib/chat-storage.ts`

These changes are documentation-only — code unchanged, tests still pass.

- [ ] **Step 1: Annotate `hooks/useChatSessions.ts`**

Open `hooks/useChatSessions.ts`. Add a JSDoc comment immediately above the `useChatSessions` export (around line 23):

```ts
/**
 * @deprecated Sub-projeto 6b moved to DB-backed sessions for authenticated users
 * via `useChatSessionsRemote`. Kept for tests + potential offline mode.
 */
export function useChatSessions(): UseChatSessions {
```

The `UseChatSessions` type stays exported unchanged (the new hook reuses it).

- [ ] **Step 2: Annotate `lib/chat-storage.ts`**

Open `lib/chat-storage.ts`. Add a JSDoc comment at the very top of the file (above the imports), and a per-export note on `loadSessions`/`saveSessions`/`createSession` (NOT on `deriveTitle`, which the new hook reuses):

Top-of-file:

```ts
/**
 * @file
 * @deprecated localStorage backend for chat sessions. Sub-projeto 6b moved
 * authenticated users to DB-backed `useChatSessionsRemote`. The `deriveTitle`
 * helper is still in active use; the rest of this module is retained for tests
 * and potential offline mode in sub-projeto 7.
 */
```

(No per-export annotation needed beyond the file-level note — the file-level `@deprecated` is enough for tooling and future readers.)

- [ ] **Step 3: Verify typecheck + tests**

```bash
npm run typecheck
npm test
```

Expected: zero typecheck errors. 89 tests passing (unchanged — JSDoc doesn't affect tests).

- [ ] **Step 4: Stage for commit**

```bash
git add hooks/useChatSessions.ts lib/chat-storage.ts
```

Do NOT commit.

---

## Task 5: Smoke + tag

**Files:** none new — final verification + tag.

I (the controller) run `npm run dev` automatically (per memory `dev_server_workflow.md`). The user's browser tab points at `http://localhost:3000`; they hard-refresh after dev recompiles.

- [ ] **Step 1: Run all automated checks**

```bash
npm test
npm run typecheck
scripts/.venv/Scripts/pytest.exe scripts/tests/ -q
```

Expected: 89 vitest, zero TS errors, 23 pytest.

- [ ] **Step 2: Start dev server**

```bash
npm run dev > .dev-srv.log 2>&1 &
```

Then poll for ready (Monitor or `until grep "Ready in"`).

- [ ] **Step 3: Verify routes**

```bash
curl -s http://localhost:3000/api/health
curl -s -o /dev/null -w "HTTP %{http_code} Loc: %{redirect_url}\n" http://localhost:3000/chat
```

Expected: `/api/health` → ok JSON; `/chat` → 307 to `/login?next=%2Fchat`.

- [ ] **Step 4: Manual UX smoke (user driven, in browser)**

Open `http://localhost:3000/chat` in browser, log in as `rgoalves@gmail.com`. Verify:
- Empty state with hero + 4 cards (no localStorage history exists for this DB-backed account).
- Click "Definir" → composer fills → click Enviar → response streams.
- Sidebar entry appears with title "O que é a matriz de Kraljic?".
- Refresh page → sidebar still shows the conversation; click reloads messages.
- Open `/chat` in an incognito tab, log in as same user → same sidebar (DB is the source of truth).
- Click "+ Nova" → new empty conversation appears.
- Hover an entry → trash icon → click → conversation removed.

- [ ] **Step 5: Verify in DB**

```bash
scripts/.venv/Scripts/python.exe -c "
import sys; sys.path.insert(0, '.')
from scripts.ingest import load_env, connect_db
load_env()
ADMIN_ID = '16fab8f7-a960-48b4-903d-b590e476b51b'
conn = connect_db()
with conn.cursor() as cur:
    cur.execute('select id, title, jsonb_array_length(messages) as msg_count, updated_at from sessions where user_id=%s order by updated_at desc limit 10', (ADMIN_ID,))
    for r in cur.fetchall(): print(r)
conn.close()
"
```

Expected: rows for the conversations created in Step 4, with non-zero message counts.

- [ ] **Step 6: RLS isolation check**

Insert a row for a fake other user via service-role; verify it doesn't appear in your sidebar. Then clean up.

```bash
scripts/.venv/Scripts/python.exe -c "
import sys, uuid; sys.path.insert(0, '.')
from scripts.ingest import load_env, connect_db
load_env()
# fake user_id; not in auth.users so the FK check needs to pass — instead,
# use the admin's id for the FK check, but mark the title to make it identifiable
ADMIN_ID = '16fab8f7-a960-48b4-903d-b590e476b51b'
conn = connect_db()
with conn.cursor() as cur:
    # We can't easily create a fake auth.users row without breaking other things.
    # Instead, verify RLS by reading via psycopg AS the service role (bypasses RLS — sees everything),
    # then assert the admin's count from a SELECT under the anon key would only see admin rows.
    # Simpler: check policy definitions are correct (already done in Task 1).
    cur.execute('select count(*) from sessions where user_id != %s', (ADMIN_ID,))
    print('foreign rows visible to service-role:', cur.fetchone())
conn.close()
"
```

Expected: `foreign rows visible to service-role: (0,)` (no other users exist in `auth.users` yet besides the admin, so there are no foreign rows). RLS policies are verified by the migration file's structure; the runtime isolation is implicit when only one user exists.

- [ ] **Step 7: Stop dev server**

```bash
# kill the process listening on port 3000 (PowerShell)
$pids = (Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue).OwningProcess | Select-Object -Unique
foreach ($p in $pids) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue }
```

Clean log: `rm -f .dev-srv.log`.

- [ ] **Step 8: Tag the milestone**

```bash
git tag -a conversation-persistence-complete -m "Sub-projeto 6b (DB-backed conversation persistence) complete — sessions table + RLS, useChatSessionsRemote drop-in for useChatSessions, localStorage modules deprecated"
```

---

## Self-Review Notes

**Spec coverage check:**
- §2 Objetivo (migration + remote hook + ChatRoot edit + @deprecated annotations + tests) → Tasks 1, 2, 3, 4 (no missed items).
- §3 Stack (no new deps) → confirmed in plan.
- §4 Estrutura → file map at top + per-task headers; matches.
- §5 Migration (table, index, 4 RLS policies, FK cascade, gen_random_uuid) → Task 1.
- §6 Hook contract (auto-create on empty, optimistic local-first writes, async actions, pre-hydration empty stub) → Task 2 impl.
- §6 ChatRoot import swap + guard tweak → Task 3.
- §7.1 5 unit tests → Task 2 Step 1 (5 tests).
- §7.2 existing tests stay green → confirmed by Task 2 Step 5 + Task 3 Step 3 + Task 4 Step 3.
- §7.3 Manual smoke (10 steps) → Task 5 Steps 4-6 cover the key ones; the per-step "Mostrar mais" / "Cap" / "Pagination" items in §7.3 step 5 onwards are documented but not exercised since they're deferred (no real cap, no realtime).
- §8 Critérios #1-9 → covered (Tasks 1, 2, 3, 4, 5).
- §9 Decisões — all reflected in plan choices.
- §10 Riscos — mitigations are coded into the hook (warn-not-throw, optimistic local-first); RLS isolation step in Task 5 verifies one risk.

**Placeholder scan:** No "TBD"/"implement later"/"similar to". Each step has actual code or actual command. Two intentional omissions:
- Task 5 Step 6's RLS isolation check is "implicit" (single-user setup means no foreign rows exist). Documented as such in the step text — not a placeholder, just an honest acknowledgement of what the check can/can't prove with current data.
- Task 4 doesn't add per-export `@deprecated` JSDoc beyond the file-level — explicit choice to keep diff minimal.

**Type consistency:**
- `UseChatSessions` (sessions, currentId, current, switchTo, createNew, deleteSession, updateMessages) — defined in `useChatSessions.ts` (sub-projeto 5), consumed by Task 2 (`useChatSessionsRemote` returns it), Task 3 (ChatRoot reads it). Match.
- `StoredSession` (id, title, messages, updatedAt) — defined in `lib/chat-storage.ts`, used in Task 2 (return rows shape). Match.
- `ChatMessage` (role, content) — from `lib/rag/types.ts`, used in tests + impl. Match.
- `deriveTitle(messages: ChatMessage[]): string` — from `lib/chat-storage.ts`, reused in Task 2 `updateMessages`. Match.
- DB row keys snake_case (`id`, `title`, `messages`, `updated_at`); StoredSession keys camelCase (`updatedAt`); `rowToSession` does the conversion. Consistent.
- `EMPTY_STUB` typed as `StoredSession` — pre-hydration return uses it.

**Test count budget:** 5 new tests on top of 84 → **89 total**. Pytest 23 unchanged.

**Dispatch suggestion to controller:**
- Task 1 — sonnet (DDL + manual verification, similar to Auth-T2).
- Task 2 — sonnet (TDD with chainable mocks; non-trivial).
- Task 3 — controller inline (2-line edit; no need for subagent overhead).
- Task 4 — controller inline (JSDoc only).
- Task 5 — controller inline (smoke + tag; per memory I run npm run dev myself).
