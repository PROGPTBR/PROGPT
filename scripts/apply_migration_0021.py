"""One-shot: apply migration 0021 (profile assistant_type allowed in templates CHECK)."""
import os, urllib.parse
from dotenv import load_dotenv

load_dotenv('.env.local')
import psycopg

url = os.environ['NEXT_PUBLIC_SUPABASE_URL']
ref = url.replace('https://', '').split('.')[0]
pw = urllib.parse.quote(os.environ['SUPABASE_DB_PASSWORD'], safe='')
dsn = f'postgresql://postgres:{pw}@db.{ref}.supabase.co:5432/postgres?sslmode=require'

path = 'supabase/migrations/00000000000021_profile_assistant_type.sql'
with open(path, 'r', encoding='utf-8') as f:
    sql = f.read()

with psycopg.connect(dsn, autocommit=True) as conn:
    with conn.cursor() as cur:
        print(f'applying {path} ({len(sql)} chars)')
        cur.execute(sql)
        print('OK')
        cur.execute(
            """
            select pg_get_constraintdef(c.oid)
            from pg_constraint c
            join pg_class t on t.oid = c.conrelid
            where t.relname = 'templates'
              and c.conname = 'templates_assistant_type_check'
            """
        )
        row = cur.fetchone()
        print(f'CHECK constraint: {row[0] if row else "(missing)"}')
