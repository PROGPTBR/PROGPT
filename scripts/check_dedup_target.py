"""Look up which existing article a dedup job matched against."""
import os, sys, urllib.parse
import psycopg
from dotenv import load_dotenv

load_dotenv('.env.local')
url = os.environ['NEXT_PUBLIC_SUPABASE_URL']
ref = url.replace('https://', '').split('.')[0]
pw = urllib.parse.quote(os.environ['SUPABASE_DB_PASSWORD'], safe='')
dsn = f'postgresql://postgres:{pw}@db.{ref}.supabase.co:5432/postgres?sslmode=require'

aid = sys.argv[1] if len(sys.argv) > 1 else '8338b698-c7dc-4591-b5e5-6abd0d68cfbf'

with psycopg.connect(dsn, autocommit=True) as conn:
    with conn.cursor() as cur:
        cur.execute(
            """
            select id, title, theme, ingested_at,
                   metadata->>'source_filename' as source_filename,
                   metadata->>'content_hash' as content_hash
            from articles where id = %s
            """,
            (aid,),
        )
        row = cur.fetchone()
        if not row:
            print(f"no article with id {aid}")
            sys.exit(1)
        (i, t, th, ts, fn, h) = row
        print(f"id={i}")
        print(f"title={t}")
        print(f"theme={th}")
        print(f"ingested_at={ts}")
        print(f"source_filename={fn}")
        print(f"content_hash={h[:16]}...")
