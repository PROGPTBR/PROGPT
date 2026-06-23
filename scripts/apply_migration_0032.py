"""One-shot: apply migration 0032 (homologacao assistant_type + template seed).

Usa o helper db_connect (direto → pooler IPv4) por causa do host direto
ser IPv6-only nesta rede. Idempotente: re-rodar é seguro.
"""
import sys
sys.path.insert(0, 'scripts')
from db_connect import connect

PATH = 'supabase/migrations/00000000000032_homologacao_assistant_type.sql'

with open(PATH, 'r', encoding='utf-8') as f:
    sql = f.read()

with connect() as conn:
    with conn.cursor() as cur:
        print(f'applying {PATH} ({len(sql)} chars)')
        cur.execute(sql)
        cur.execute("select count(*) from templates where assistant_type = 'homologacao'")
        n = cur.fetchone()[0]
        print(f'OK — templates homologacao no banco: {n}')
