"""One-shot: insert the default Kraljic template into the templates table.

Idempotent: if a template with the same name + assistant_type='kraljic'
already exists, this updates body_md/description instead of creating
a duplicate.
"""
import os, urllib.parse
from dotenv import load_dotenv

load_dotenv('.env.local')
import psycopg

ADMIN_USER_ID = '5efba61c-6b36-49d1-b443-b235b003ad54'  # rgoalves@gmail.com
TEMPLATE_NAME = 'Kraljic Padrão (Procurement Garage methodology)'
TEMPLATE_DESCRIPTION = (
    'Template padrão para análise de portfólio via Matriz de Kraljic. Segue a '
    'metodologia Procurement Garage (4 critérios por eixo, escala 1-4). '
    'Inclui resumo executivo + plano por quadrante + recomendação por item + '
    'apêndice com metodologia e confidencialidade.'
)
BODY_PATH = 'docs/product/templates/kraljic-padrao.md'

with open(BODY_PATH, 'r', encoding='utf-8') as f:
    body_md = f.read()

url = os.environ['NEXT_PUBLIC_SUPABASE_URL']
ref = url.replace('https://', '').split('.')[0]
pw = urllib.parse.quote(os.environ['SUPABASE_DB_PASSWORD'], safe='')
dsn = f'postgresql://postgres:{pw}@db.{ref}.supabase.co:5432/postgres?sslmode=require'

print(f'Conectando em db.{ref}.supabase.co ...')
print(f'Template: {TEMPLATE_NAME!r}')
print(f'Tamanho do body_md: {len(body_md)} chars')

with psycopg.connect(dsn, autocommit=True) as conn:
    with conn.cursor() as cur:
        cur.execute(
            "select id, char_length(body_md) from templates "
            "where assistant_type='kraljic' and name=%s",
            (TEMPLATE_NAME,),
        )
        existing = cur.fetchone()
        if existing:
            tid, old_len = existing
            print(f'Já existe (id={tid}, body_md atual={old_len} chars). Atualizando...')
            cur.execute(
                """
                update templates
                set body_md=%s, description=%s, updated_at=now()
                where id=%s
                """,
                (body_md, TEMPLATE_DESCRIPTION, tid),
            )
            print('UPDATE OK')
        else:
            print('Inserindo novo...')
            cur.execute(
                """
                insert into templates (assistant_type, name, description, body_md, created_by)
                values ('kraljic', %s, %s, %s, %s)
                returning id
                """,
                (TEMPLATE_NAME, TEMPLATE_DESCRIPTION, body_md, ADMIN_USER_ID),
            )
            new_id = cur.fetchone()[0]
            print(f'INSERT OK id={new_id}')

        cur.execute(
            "select id, name, char_length(body_md), created_at "
            "from templates where assistant_type='kraljic' order by created_at desc"
        )
        print('\nTemplates Kraljic em produção:')
        for row in cur.fetchall():
            print(f'  - {row[0]} | {row[1]!r} | {row[2]} chars | {row[3]}')
