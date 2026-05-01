-- Partial unique index on articles.metadata->>'content_hash'
-- Enforces idempotency for the ingest pipeline (sub-projeto 2).
-- Partial because legacy rows without content_hash should not collide on null.

create unique index if not exists articles_content_hash_idx
  on articles ((metadata->>'content_hash'))
  where metadata ? 'content_hash';
