"""One-shot: apply migration 0047 (materials table — Batch L do backlog do diretor)."""
import os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from db_connect import connect

path = 'supabase/migrations/00000000000047_materials.sql'
with open(path, 'r', encoding='utf-8') as f:
    sql = f.read()

with connect() as conn:
    with conn.cursor() as cur:
        print(f'applying {path} ({len(sql)} chars)')
        cur.execute(sql)
        print('OK')
        cur.execute("select count(*) from materials")
        print(f'materials rows: {cur.fetchone()[0]}')
        cur.execute("select count(*) from pg_policies where tablename='materials'")
        print(f'materials RLS policies: {cur.fetchone()[0]}')
