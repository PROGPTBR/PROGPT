"""One-shot migrator: apply every supabase/migrations/*.sql file in order.

Idempotent-ish: each migration uses CREATE ... IF NOT EXISTS where possible, but
this script is intended for a fresh project (verified empty `public` schema).
"""
import os, sys, glob

# Import sibling helper independentemente do cwd (rodado como `python
# scripts/apply_migrations.py`). connect() tenta direto (IPv6) → pooler (IPv4).
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from db_connect import connect

files = sorted(glob.glob('supabase/migrations/*.sql'))
if not files:
    print('no migrations found', file=sys.stderr)
    sys.exit(1)

with connect() as conn:
    for path in files:
        name = os.path.basename(path)
        with open(path, 'r', encoding='utf-8') as f:
            sql = f.read()
        if not sql.strip():
            print(f'SKIP {name} (empty)')
            continue
        print(f'APPLY {name} ({len(sql)} chars)')
        try:
            with conn.cursor() as cur:
                cur.execute(sql)
        except Exception as e:
            print(f'  FAILED: {e}')
            raise
print('done')
