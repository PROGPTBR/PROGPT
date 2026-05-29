"""One-shot: apply migration 0030 (admin_funnel_metrics fn)."""
import os, urllib.parse
from dotenv import load_dotenv

load_dotenv('.env.local')
import psycopg

url = os.environ['NEXT_PUBLIC_SUPABASE_URL']
ref = url.replace('https://', '').split('.')[0]
pw = urllib.parse.quote(os.environ['SUPABASE_DB_PASSWORD'], safe='')
dsn = f'postgresql://postgres:{pw}@db.{ref}.supabase.co:5432/postgres?sslmode=require'

path = 'supabase/migrations/00000000000030_admin_funnel.sql'
with open(path, 'r', encoding='utf-8') as f:
    sql = f.read()

print(f'target project: {ref}')
with psycopg.connect(dsn, autocommit=True) as conn:
    with conn.cursor() as cur:
        print(f'applying {path} ({len(sql)} chars)')
        cur.execute(sql)
        print('OK')

        # Dry-call the function and print the shape
        cur.execute('select admin_funnel_metrics()')
        row = cur.fetchone()
        print('admin_funnel_metrics() returned:')
        print(f'  {row[0]}')
