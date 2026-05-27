"""One-shot: apply migration 0026 (security hardening from Supabase Advisor).

Idempotente — pode ser re-rodado. Toda revogação/grant é estável e DROP usa
IF EXISTS.
"""
import os, urllib.parse
from dotenv import load_dotenv

load_dotenv('.env.local')
import psycopg

url = os.environ['NEXT_PUBLIC_SUPABASE_URL']
ref = url.replace('https://', '').split('.')[0]
pw = urllib.parse.quote(os.environ['SUPABASE_DB_PASSWORD'], safe='')
dsn = f'postgresql://postgres:{pw}@db.{ref}.supabase.co:5432/postgres?sslmode=require'

path = 'supabase/migrations/00000000000026_security_hardening.sql'
with open(path, 'r', encoding='utf-8') as f:
    sql = f.read()

with psycopg.connect(dsn, autocommit=True) as conn:
    with conn.cursor() as cur:
        print(f'applying {path} ({len(sql)} chars)')
        cur.execute(sql)
        print('OK')

        # Verify: profiles_with_email só tem grant pra service_role
        cur.execute(
            """
            select grantee, privilege_type
            from information_schema.role_table_grants
            where table_name = 'profiles_with_email'
            order by grantee
            """
        )
        print('profiles_with_email grants:')
        for row in cur.fetchall():
            print(f'  {row}')

        # Verify: tabelas messages/conversations dropadas
        cur.execute(
            """
            select count(*) from information_schema.tables
            where table_schema = 'public'
              and table_name in ('conversations', 'messages')
            """
        )
        count = cur.fetchone()[0]
        print(f'dead tables remaining (expect 0): {count}')

        # Verify: search_path setado nas 3 funções
        cur.execute(
            """
            select proname, proconfig
            from pg_proc
            where proname in ('admin_top_queries','admin_api_usage_by_user','admin_api_usage_daily')
            """
        )
        print('search_path configs:')
        for row in cur.fetchall():
            print(f'  {row}')
