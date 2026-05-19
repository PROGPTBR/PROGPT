"""One-shot: insert the default ABC (Pareto curve) template.

Idempotent: if a template with the same name + assistant_type='abc'
already exists, this updates body_md/description instead of creating
a duplicate.
"""
import os, urllib.parse
from dotenv import load_dotenv

load_dotenv('.env.local')
import psycopg

ADMIN_USER_ID = '5efba61c-6b36-49d1-b443-b235b003ad54'  # rgoalves@gmail.com
TEMPLATE_NAME = 'Template padrão'
TEMPLATE_DESCRIPTION = (
    'Template padrão para Análise ABC / Curva de Pareto de spend. '
    'Inclui sumário executivo em 3 blocos (veredito de concentração, '
    'diagnóstico, ação prioritária), resumo tabular por classe, plano de '
    'ação para A/B/C, cauda longa com quick wins e próximos passos.'
)
BODY_PATH = 'docs/product/templates/abc-padrao.md'

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
            "where assistant_type='abc' and name=%s",
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
                returning id, char_length(body_md)
                """,
                (body_md, TEMPLATE_DESCRIPTION, tid),
            )
        else:
            print('Não existe. Inserindo...')
            cur.execute(
                """
                insert into templates (assistant_type, name, description, body_md, created_by)
                values ('abc', %s, %s, %s, %s)
                returning id, char_length(body_md)
                """,
                (TEMPLATE_NAME, TEMPLATE_DESCRIPTION, body_md, ADMIN_USER_ID),
            )
        new = cur.fetchone()
        print(f'OK: id={new[0]}, body_md={new[1]} chars')
