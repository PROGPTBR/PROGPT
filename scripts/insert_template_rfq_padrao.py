"""One-shot: insert the RFQ Padrão template into templates table.

Idempotent: if a template with the same name + assistant_type already exists,
this updates body_md/description instead of creating a duplicate.
"""
from db_connect import connect

ADMIN_USER_ID = '5efba61c-6b36-49d1-b443-b235b003ad54'  # rgoalves@gmail.com
TEMPLATE_NAME = 'RFQ Padrão (com termos e código de conduta)'
TEMPLATE_DESCRIPTION = (
    'Template completo PT-BR com cotação fiscal brasileira (PIS/COFINS/ICMS/IPI/NCM), '
    'termos & condições (13 cláusulas) e código de ética (10 seções). '
    'Placeholders alinhados aos campos do form: '
    '{{escopo}}, {{categoria}}, {{prazo}}, {{orcamento}}, {{criterios}}, {{notas}}, '
    '{{quantidade}}, {{local_entrega}}, {{prazo_entrega}}, {{incoterm}}, '
    '{{condicao_pagamento}}, {{moeda}}, {{validade_proposta}}, '
    '{{limite_resposta}}, {{contato_comprador}}, {{amostra}}.'
)
BODY_PATH = 'docs/product/templates/rfq-padrao.md'

with open(BODY_PATH, 'r', encoding='utf-8') as f:
    body_md = f.read()

print(f'Template: {TEMPLATE_NAME!r}')
print(f'Tamanho do body_md: {len(body_md)} chars')

# connect() tenta o host direto (IPv6) e cai no pooler IPv4 — o host direto
# sozinho falha em rede sem IPv6 (ver CLAUDE.md / scripts/db_connect.py).
with connect() as conn:
    with conn.cursor() as cur:
        cur.execute(
            "select id, char_length(body_md) from templates where assistant_type='rfp' and name=%s",
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
                values ('rfp', %s, %s, %s, %s)
                returning id
                """,
                (TEMPLATE_NAME, TEMPLATE_DESCRIPTION, body_md, ADMIN_USER_ID),
            )
            new_id = cur.fetchone()[0]
            print(f'INSERT OK id={new_id}')

        cur.execute(
            "select id, name, char_length(body_md), created_at "
            "from templates where assistant_type='rfp' order by created_at desc"
        )
        print('\nTemplates RFP em produção:')
        for row in cur.fetchall():
            print(f'  - {row[0]} | {row[1]!r} | {row[2]} chars | {row[3]}')
