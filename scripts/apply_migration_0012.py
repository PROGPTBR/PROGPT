"""One-shot: apply migration 0012 (open taxonomy)."""
import os, sys, urllib.parse
from dotenv import load_dotenv

load_dotenv('.env.local')
import psycopg

url = os.environ['NEXT_PUBLIC_SUPABASE_URL']
ref = url.replace('https://', '').split('.')[0]
pw = urllib.parse.quote(os.environ['SUPABASE_DB_PASSWORD'], safe='')
dsn = f'postgresql://postgres:{pw}@db.{ref}.supabase.co:5432/postgres?sslmode=require'

path = 'supabase/migrations/00000000000012_open_taxonomy.sql'
with open(path, 'r', encoding='utf-8') as f:
    sql = f.read()

with psycopg.connect(dsn, autocommit=True) as conn:
    with conn.cursor() as cur:
        print(f'applying {path} ({len(sql)} chars)')
        cur.execute(sql)
        print('OK')

        cur.execute("select column_name, data_type from information_schema.columns where table_name='articles' and column_name in ('theme', 'theme_status') order by column_name")
        print('articles theme columns:', cur.fetchall())

        cur.execute("select theme_status, count(*) from articles group by theme_status order by theme_status")
        print('article counts by theme_status:', cur.fetchall())
