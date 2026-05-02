-- RAG retrieval RPC functions (sub-projeto 3).
-- security definer because RLS is enabled on chunks/articles but has no policies
-- (Fundação decision). Sub-projeto 6 (Auth) revisits.

create or replace function match_chunks(
  query_embedding vector(1024),
  match_count int default 20
)
returns table (
  chunk_id uuid,
  article_id uuid,
  content text,
  ord int,
  similarity float
)
language sql
security definer
set search_path = public
as $$
  select c.id, c.article_id, c.content, c.ord,
         1 - (c.embedding <=> query_embedding) as similarity
  from chunks c
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

create or replace function search_chunks_fts(
  query_text text,
  match_count int default 20
)
returns table (
  chunk_id uuid,
  article_id uuid,
  content text,
  ord int,
  rank float
)
language sql
security definer
set search_path = public
as $$
  select c.id, c.article_id, c.content, c.ord,
         ts_rank(c.tsv, websearch_to_tsquery('portuguese', query_text)) as rank
  from chunks c
  where c.tsv @@ websearch_to_tsquery('portuguese', query_text)
  order by rank desc
  limit match_count;
$$;

grant execute on function match_chunks(vector, int) to anon, authenticated, service_role;
grant execute on function search_chunks_fts(text, int) to anon, authenticated, service_role;
