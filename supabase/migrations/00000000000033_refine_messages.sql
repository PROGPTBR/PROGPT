-- Roadmap item 6 — Persist the assistant refine-chat.
--
-- The refine conversation (where a user iterates on a generated artifact) was
-- in-memory only and lost on reload (sub-projeto 21 decision). Now it's
-- persisted per run so the refinement survives reload and shows on replay.
--
-- JSONB column (same pattern as the negotiation `transcript`), append-only:
-- the client sends the full history each turn, so we replace the snapshot.
-- Idempotent: ADD COLUMN IF NOT EXISTS.

alter table assistant_runs
  add column if not exists refine_messages jsonb;

comment on column assistant_runs.refine_messages is
  'Array<{role: "user" | "assistant", content: string, ts: ISO8601}> — histórico do refine-chat, gravado por turno em POST /api/assistants/runs/[id]/chat (item 6 do roadmap; reverte a decisão in-memory do sub-projeto 21).';
