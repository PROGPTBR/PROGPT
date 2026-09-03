"""One-shot: apply migration 0049 (comprador_quotes.pedido_cotacao)."""
import os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from db_connect import connect

path = 'supabase/migrations/00000000000049_comprador_pedido_cotacao.sql'
with open(path, 'r', encoding='utf-8') as f:
    sql = f.read()

with connect() as conn:
    with conn.cursor() as cur:
        print(f'applying {path} ({len(sql)} chars)')
        cur.execute(sql)
        print('OK')
        cur.execute(
            "select column_name, data_type, column_default, is_nullable "
            "from information_schema.columns "
            "where table_name='comprador_quotes' and column_name='pedido_cotacao'"
        )
        row = cur.fetchone()
        print(f'pedido_cotacao column: {row}')
