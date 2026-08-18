"""One-shot: aplica só a migration 0046 (simulador_simulacoes).

Idempotente (CREATE ... IF NOT EXISTS + DROP POLICY IF EXISTS). Usa o helper
db_connect (direto IPv6 -> pooler IPv4). Rodar: python scripts/apply_migration_0046.py
"""
import os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from db_connect import connect

PATH = 'supabase/migrations/00000000000046_simulador.sql'

with open(PATH, 'r', encoding='utf-8') as f:
    sql = f.read()

with connect() as conn:
    with conn.cursor() as cur:
        cur.execute(sql)
    print(f'APPLIED {PATH} ({len(sql)} chars)')
print('done')
