"""Summary of articles without chunks: counts by parser, by job status, error patterns."""
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

with psycopg.connect(dsn, autocommit=True) as conn, conn.cursor() as cur:
    cur.execute("select count(*) from articles")
    print(f"Total articles: {cur.fetchone()[0]}")
    cur.execute("select count(*) from chunks")
    print(f"Total chunks: {cur.fetchone()[0]}")

    cur.execute(
        """
        select count(*) from articles a
        left join chunks c on c.article_id = a.id
        where c.id is null
        """
    )
    print(f"\nArticles WITHOUT chunks: {cur.fetchone()[0]}")

    print("\n=== By parser ===")
    cur.execute(
        """
        select coalesce(a.metadata->>'parser', '<null>') as parser, count(*)
        from articles a
        left join chunks c on c.article_id = a.id
        where c.id is null
        group by parser
        order by 2 desc
        """
    )
    for parser, cnt in cur.fetchall():
        print(f"  {parser}: {cnt}")

    print("\n=== By raw_md presence ===")
    cur.execute(
        """
        select case when length(coalesce(a.raw_md, '')) > 0 then 'has raw_md' else 'NO raw_md' end as bucket,
               count(*)
        from articles a
        left join chunks c on c.article_id = a.id
        where c.id is null
        group by bucket
        """
    )
    for b, cnt in cur.fetchall():
        print(f"  {b}: {cnt}")

    print("\n=== Matching ingestion_jobs status ===")
    cur.execute(
        """
        select coalesce(j.status, '<no job>') as status,
               coalesce(j.stage, '<n/a>') as stage,
               count(*)
        from articles a
        left join chunks c on c.article_id = a.id
        left join ingestion_jobs j on j.article_id = a.id
        where c.id is null
        group by j.status, j.stage
        order by 3 desc
        """
    )
    for status, stage, cnt in cur.fetchall():
        print(f"  status={status:<12} stage={stage:<20} count={cnt}")

    print("\n=== Sample errors from related jobs (top 10 by frequency) ===")
    cur.execute(
        """
        select substring(j.error_message, 1, 180) as err_short, count(*)
        from articles a
        left join chunks c on c.article_id = a.id
        join ingestion_jobs j on j.article_id = a.id
        where c.id is null and j.error_message is not null
        group by err_short
        order by 2 desc
        limit 10
        """
    )
    rows = cur.fetchall()
    if not rows:
        print("  (no related jobs with error_message)")
    for err, cnt in rows:
        print(f"  [{cnt}x] {err}")

    print("\n=== Time distribution of orphan articles ===")
    cur.execute(
        """
        select date_trunc('day', a.ingested_at) as day, count(*)
        from articles a
        left join chunks c on c.article_id = a.id
        where c.id is null
        group by day
        order by day desc
        limit 20
        """
    )
    for day, cnt in cur.fetchall():
        print(f"  {day}: {cnt}")
