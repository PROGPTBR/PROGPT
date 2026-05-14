"""One-shot: apply migration 0017 (kraljic assistant_type)."""
import os, urllib.parse
from dotenv import load_dotenv

load_dotenv('.env.local')
import psycopg

url = os.environ['NEXT_PUBLIC_SUPABASE_URL']
ref = url.replace('https://', '').split('.')[0]
pw = urllib.parse.quote(os.environ['SUPABASE_DB_PASSWORD'], safe='')
dsn = f'postgresql://postgres:{pw}@db.{ref}.supabase.co:5432/postgres?sslmode=require'

path = 'supabase/migrations/00000000000017_kraljic_assistant_type.sql'
with open(path, 'r', encoding='utf-8') as f:
    sql = f.read()

with psycopg.connect(dsn, autocommit=True) as conn:
    with conn.cursor() as cur:
        print(f'applying {path} ({len(sql)} chars)')
        cur.execute(sql)
        # Verify the new check definition
        cur.execute(
            "select pg_get_constraintdef(oid) from pg_constraint "
            "where conname='templates_assistant_type_check'"
        )
        row = cur.fetchone()
        print(f'constraint: {row[0] if row else "MISSING"}')
