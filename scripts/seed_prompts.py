"""Sub-projeto 32 — carrega scripts/data/prompts-seed.json na tabela `prompts`.

Lê o JSON limpo (gerado por `npm run prompts:import`) e faz upsert idempotente
por `prompt_number` no Supabase do PROGPT. Rode DEPOIS de aplicar a migration
0034. Requer OK explícito (escreve dados em prod).

    python scripts/seed_prompts.py

Conexão via scripts/db_connect.connect() (pooler IPv4 us-west-2, autocommit).
"""
import json
import os
import sys

import db_connect

SEED_PATH = os.path.join(os.path.dirname(__file__), "data", "prompts-seed.json")

UPSERT = """
insert into prompts (prompt_number, title, summary, content, category, tags, source)
values (%s, %s, %s, %s, %s, %s, 'pro-ai-circle')
on conflict (prompt_number) where prompt_number is not null
do update set
  title = excluded.title,
  summary = excluded.summary,
  content = excluded.content,
  category = excluded.category,
  tags = excluded.tags,
  updated_at = now()
"""

INSERT_NO_NUM = """
insert into prompts (prompt_number, title, summary, content, category, tags, source)
values (null, %s, %s, %s, %s, %s, 'pro-ai-circle')
"""


def main():
    if not os.path.exists(SEED_PATH):
        print(f"Arquivo nao encontrado: {SEED_PATH}\nRode `npm run prompts:import` antes.")
        sys.exit(2)

    with open(SEED_PATH, encoding="utf-8") as f:
        prompts = json.load(f)

    print(f"Lendo {len(prompts)} prompts de {SEED_PATH}")

    conn = db_connect.connect()
    upserted = 0
    with conn.cursor() as cur:
        for p in prompts:
            tags = p.get("tags") or []
            args = (
                p.get("title", ""),
                p.get("summary", ""),
                p.get("content", ""),
                p.get("category", "Geral"),
                tags,
            )
            num = p.get("prompt_number")
            if num is not None:
                cur.execute(UPSERT, (num, *args))
            else:
                cur.execute(INSERT_NO_NUM, args)
            upserted += 1
        cur.execute("select count(*), count(distinct category) from prompts")
        total, cats = cur.fetchone()

    conn.close()
    print(f"OK: {upserted} upserts. Tabela tem {total} prompts em {cats} categorias.")


if __name__ == "__main__":
    main()
