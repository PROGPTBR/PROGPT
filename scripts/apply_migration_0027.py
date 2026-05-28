"""One-shot: apply migration 0027 (billing — subscriptions + webhook events)."""
import os, urllib.parse
from dotenv import load_dotenv

load_dotenv('.env.local')
import psycopg

url = os.environ['NEXT_PUBLIC_SUPABASE_URL']
ref = url.replace('https://', '').split('.')[0]
pw = urllib.parse.quote(os.environ['SUPABASE_DB_PASSWORD'], safe='')
dsn = f'postgresql://postgres:{pw}@db.{ref}.supabase.co:5432/postgres?sslmode=require'

path = 'supabase/migrations/00000000000027_billing.sql'
with open(path, 'r', encoding='utf-8') as f:
    sql = f.read()

with psycopg.connect(dsn, autocommit=True) as conn:
    with conn.cursor() as cur:
        print(f'applying {path} ({len(sql)} chars)')
        cur.execute(sql)
        print('OK')

        cur.execute(
            """
            select column_name, data_type
            from information_schema.columns
            where table_name='subscriptions'
            order by ordinal_position
            """
        )
        print('subscriptions columns:')
        for row in cur.fetchall():
            print(f'  {row}')

        cur.execute(
            "select count(*) from information_schema.tables "
            "where table_schema='public' and table_name='billing_webhook_events'"
        )
        print(f'billing_webhook_events exists: {cur.fetchone()[0]}')
