"""One-shot diagnostic: list recent ingestion_jobs + count articles."""
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
            print(f"articles count: {cur.fetchone()[0]}")
            print()
            print("=== recent ingestion_jobs (last 10) ===")
            cur.execute(
                """
                select id, filename, status, stage, progress, chunks_count, article_id,
                       error_message, created_at, finished_at
                from ingestion_jobs
                order by created_at desc
                limit 10
                """
            )
            for row in cur.fetchall():
                (jid, fn, st, stage, prog, chunks, aid, err, created, finished) = row
                print(f"- {fn}")
                print(f"  status={st} stage={stage} progress={prog} chunks={chunks}")
                print(f"  article_id={aid}")
                print(f"  created={created} finished={finished}")
                if err:
                    print(f"  ERROR: {err[:200]}")
                print()
            print("=== newest 5 articles ===")
            cur.execute(
                """
                select title, theme, ingested_at
                from articles
                order by ingested_at desc
                limit 5
                """
            )
            for (title, theme, ts) in cur.fetchall():
                print(f"- [{theme}] {title}  (ingested_at={ts})")
except Exception as e:
    print(f"DB error: {e}", file=sys.stderr)
    sys.exit(1)
