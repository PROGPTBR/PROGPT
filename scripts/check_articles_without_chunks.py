"""Diagnostic: list articles that have zero chunks in the chunks table."""
import os
import sys
import urllib.parse
import psycopg
from dotenv import load_dotenv

load_dotenv('.env.local')

url = os.environ['NEXT_PUBLIC_SUPABASE_URL']
ref = url.replace('https://', '').split('.')[0]
pw = urllib.parse.quote(os.environ['SUPABASE_DB_PASSWORD'], safe='')
dsn = f'postgresql://postgres:{pw}@db.{ref}.supabase.co:5432/postgres?sslmode=require'

try:
    with psycopg.connect(dsn, autocommit=True) as conn:
        with conn.cursor() as cur:
            cur.execute("select count(*) from articles")
            total = cur.fetchone()[0]
            print(f"Total articles: {total}")

            cur.execute(
                """
                select a.id, a.title, a.theme, a.theme_status, a.source_chars,
                       a.ingested_at,
                       a.metadata->>'parser' as parser,
                       a.metadata->>'source_filename' as source_filename,
                       length(coalesce(a.raw_md, '')) as raw_md_len
                from articles a
                left join chunks c on c.article_id = a.id
                where c.id is null
                order by a.ingested_at desc
                """
            )
            rows = cur.fetchall()
            print(f"Articles WITHOUT chunks: {len(rows)}\n")
            print("=" * 100)
            for (aid, title, theme, theme_status, src_chars, ing, parser, srcfn, raw_len) in rows:
                print(f"id: {aid}")
                print(f"title: {title}")
                print(f"theme: {theme} ({theme_status})  parser: {parser}")
                print(f"source_filename: {srcfn}")
                print(f"source_chars: {src_chars}  raw_md_len: {raw_len}")
                print(f"ingested_at: {ing}")
                print("-" * 100)

            print()
            print("=== Matching ingestion_jobs (by article_id) ===\n")
            if rows:
                ids = [r[0] for r in rows]
                cur.execute(
                    """
                    select article_id, filename, status, stage, progress, chunks_count,
                           error_message, created_at, finished_at
                    from ingestion_jobs
                    where article_id = any(%s)
                    order by created_at desc
                    """,
                    (ids,),
                )
                jobs = cur.fetchall()
                if not jobs:
                    print("(no ingestion_jobs reference these article ids)")
                for (aid, fn, st, stage, prog, ch, err, created, finished) in jobs:
                    print(f"article_id: {aid}")
                    print(f"  job filename: {fn}")
                    print(f"  status={st} stage={stage} progress={prog} chunks_count={ch}")
                    print(f"  created={created} finished={finished}")
                    if err:
                        print(f"  ERROR: {err[:300]}")
                    print()
except Exception as e:
    print(f"DB error: {e}", file=sys.stderr)
    sys.exit(1)
