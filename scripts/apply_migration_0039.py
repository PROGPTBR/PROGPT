"""One-shot: aplica a migration 0039 (spend_analysis assistant_type + tabela
spend_invoices) em PROD.

Idempotente (ALTER do CHECK + seed `where not exists` + `create table if not
exists` + `drop policy if exists` antes de recriar). Usa o helper db_connect
(direto IPv6 -> pooler IPv4, autocommit).
"""
import os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from db_connect import connect

PATH = "supabase/migrations/00000000000039_spend_analysis_assistant_type.sql"

with open(PATH, "r", encoding="utf-8") as f:
    sql = f.read()

with connect() as conn:
    with conn.cursor() as cur:
        cur.execute(sql)
        cur.execute(
            "select count(*) from templates where assistant_type = 'spend_analysis'"
        )
        n_templates = cur.fetchone()[0]
        cur.execute(
            "select count(*) from information_schema.tables where table_name = 'spend_invoices'"
        )
        has_table = cur.fetchone()[0]
print(
    f"OK — migration 0039 aplicada. templates spend_analysis: {n_templates}; "
    f"tabela spend_invoices: {'existe' if has_table else 'AUSENTE'}"
)
