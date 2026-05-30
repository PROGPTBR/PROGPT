"""One-shot: insert the default Scorecard template into the templates table.

Idempotent: if a template with the same name + assistant_type='scorecard'
already exists, this updates body_md/description instead of creating
a duplicate.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from db_connect import connect  # direct→pooler(IPv4) fallback

ADMIN_USER_ID = '5efba61c-6b36-49d1-b443-b235b003ad54'  # rgoalves@gmail.com
TEMPLATE_NAME = 'Scorecard Padrão'
TEMPLATE_DESCRIPTION = (
    'Template padrão para avaliação multidimensional de fornecedores (Supplier Scorecard). '
    'Segue a metodologia Monczka/CIPS com 4 dimensões ponderadas (Qualidade 30%, '
    'Entrega 25%, Custo 25%, Relacionamento 20%) e 3 faixas de classificação '
    '(Estratégico ≥75 / Desenvolvimento 50-74 / Saída <50). '
    'Inclui resumo executivo + ranking geral + análise por faixa + plano de ação por fornecedor.'
)
BODY_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    '..', 'docs', 'product', 'templates', 'scorecard-padrao.md',
)

with open(BODY_PATH, 'r', encoding='utf-8') as f:
    body_md = f.read()

print(f'Template: {TEMPLATE_NAME!r}')
print(f'Tamanho do body_md: {len(body_md)} chars')

with connect() as conn:
    with conn.cursor() as cur:
        cur.execute(
            "select id, char_length(body_md) from templates "
            "where assistant_type='scorecard' and name=%s",
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
                values ('scorecard', %s, %s, %s, %s)
                returning id
                """,
                (TEMPLATE_NAME, TEMPLATE_DESCRIPTION, body_md, ADMIN_USER_ID),
            )
            new_id = cur.fetchone()[0]
            print(f'INSERT OK id={new_id}')

        cur.execute(
            "select id, name, char_length(body_md), created_at "
            "from templates where assistant_type='scorecard' order by created_at desc"
        )
        print('\nTemplates Scorecard em produção:')
        for row in cur.fetchall():
            print(f'  - {row[0]} | {row[1]!r} | {row[2]} chars | {row[3]}')
