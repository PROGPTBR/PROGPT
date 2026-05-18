"""Show full detail of the last orphan article."""
import os
import urllib.parse
import psycopg
from dotenv import load_dotenv

load_dotenv('.env.local')

url = os.environ['NEXT_PUBLIC_SUPABASE_URL']
ref = url.replace('https://', '').split('.')[0]
pw = urllib.parse.quote(os.environ['SUPABASE_DB_PASSWORD'], safe='')
dsn = f'postgresql://postgres:{pw}@db.{ref}.supabase.co:5432/postgres?sslmode=require'

with psycopg.connect(dsn, autocommit=True) as conn, conn.cursor() as cur:
    cur.execute(
        """
        select a.id, a.title, a.theme, a.metadata, a.ingested_at, length(coalesce(a.raw_md, ''))
        from articles a
        left join chunks c on c.article_id = a.id
        where c.id is null
        """
    )
    for (aid, title, theme, meta, ing, raw_len) in cur.fetchall():
        print(f"id: {aid}")
        print(f"title: {title}")
        print(f"theme: {theme}")
        print(f"ingested_at: {ing}")
        print(f"raw_md length: {raw_len}")
        print(f"metadata: {meta}")
        print()
        cur.execute(
            "select id, filename, status, stage, error_message, created_at, finished_at "
            "from ingestion_jobs where article_id = %s order by created_at",
            (aid,),
        )
        for jrow in cur.fetchall():
            print(f"  job: {jrow}")
