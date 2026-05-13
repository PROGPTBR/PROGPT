"""One-shot: apply migration 0014 (templates + assistant_runs tables)."""
import os, urllib.parse
from dotenv import load_dotenv

load_dotenv('.env.local')
import psycopg

url = os.environ['NEXT_PUBLIC_SUPABASE_URL']
ref = url.replace('https://', '').split('.')[0]
pw = urllib.parse.quote(os.environ['SUPABASE_DB_PASSWORD'], safe='')
dsn = f'postgresql://postgres:{pw}@db.{ref}.supabase.co:5432/postgres?sslmode=require'

path = 'supabase/migrations/00000000000014_templates_and_assistant_runs.sql'
with open(path, 'r', encoding='utf-8') as f:
    sql = f.read()

with psycopg.connect(dsn, autocommit=True) as conn:
    with conn.cursor() as cur:
        print(f'applying {path} ({len(sql)} chars)')
        cur.execute(sql)
        print('OK')
        cur.execute("select count(*) from templates")
        print(f'templates rows: {cur.fetchone()[0]}')
        cur.execute("select count(*) from assistant_runs")
        print(f'assistant_runs rows: {cur.fetchone()[0]}')
        cur.execute("""
            select policyname from pg_policies
            where tablename in ('templates', 'assistant_runs')
            order by tablename, policyname
        """)
        for r in cur.fetchall():
            print(f'  policy: {r[0]}')
