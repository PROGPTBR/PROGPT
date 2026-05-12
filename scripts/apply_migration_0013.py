"""One-shot: apply migration 0013 (api_usage_events table + admin_api_usage_daily fn)."""
import os, sys, urllib.parse
from dotenv import load_dotenv

load_dotenv('.env.local')
import psycopg

url = os.environ['NEXT_PUBLIC_SUPABASE_URL']
ref = url.replace('https://', '').split('.')[0]
pw = urllib.parse.quote(os.environ['SUPABASE_DB_PASSWORD'], safe='')
dsn = f'postgresql://postgres:{pw}@db.{ref}.supabase.co:5432/postgres?sslmode=require'

path = 'supabase/migrations/00000000000013_api_usage_events.sql'
with open(path, 'r', encoding='utf-8') as f:
    sql = f.read()

with psycopg.connect(dsn, autocommit=True) as conn:
    with conn.cursor() as cur:
        print(f'applying {path} ({len(sql)} chars)')
        cur.execute(sql)
        print('OK')
        cur.execute("select count(*) from api_usage_events")
        print(f'api_usage_events rows: {cur.fetchone()[0]}')
        cur.execute("select count(*) from pg_proc where proname='admin_api_usage_daily'")
        print(f"admin_api_usage_daily function exists: {cur.fetchone()[0] > 0}")
