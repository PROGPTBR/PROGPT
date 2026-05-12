"""Pull today's negative feedback with the question + assistant response."""
import os, urllib.parse
import psycopg
from dotenv import load_dotenv

load_dotenv('.env.local')

url = os.environ['NEXT_PUBLIC_SUPABASE_URL']
ref = url.replace('https://', '').split('.')[0]
pw = urllib.parse.quote(os.environ['SUPABASE_DB_PASSWORD'], safe='')
dsn = f'postgresql://postgres:{pw}@db.{ref}.supabase.co:5432/postgres?sslmode=require'

with psycopg.connect(dsn, autocommit=True) as conn:
    with conn.cursor() as cur:
        cur.execute("""
            select mf.id, mf.trace_id, mf.rating, mf.comment, mf.created_at,
                   mf.session_id, s.messages
            from message_feedback mf
            left join sessions s on s.id = mf.session_id
            where mf.rating = 'down'
              and mf.created_at::date = current_date
            order by mf.created_at desc
        """)
        rows = cur.fetchall()
        print(f"=== [down] hoje: {len(rows)} ===\n")
        if not rows:
            cur.execute("""
                select count(*), max(created_at)
                from message_feedback where rating = 'down'
            """)
            (total, latest) = cur.fetchone()
            print(f"(0 hoje; total histórico de [down]: {total}; último em {latest})")

        for (mf_id, trace, rating, comment, created, session_id, messages) in rows:
            print(f"--- feedback {str(mf_id)[:8]} ---")
            print(f"  created : {created}")
            print(f"  trace   : {trace}")
            print(f"  comment : {comment or '(nenhum)'}")
            user_q = None
            asst = None
            chunks = []
            if messages:
                # Match by annotation traceId or fall back to last assistant
                for i, m in enumerate(messages):
                    if m.get('role') == 'assistant':
                        for a in (m.get('annotations') or []):
                            if isinstance(a, dict) and a.get('traceId') == trace:
                                asst = m
                                chunks = a.get('sources') or []
                                if i > 0 and messages[i-1].get('role') == 'user':
                                    user_q = messages[i-1].get('content')
                                break
                    if asst:
                        break
                if not asst:
                    for i in range(len(messages) - 1, -1, -1):
                        if messages[i].get('role') == 'assistant':
                            asst = messages[i]
                            if i > 0 and messages[i-1].get('role') == 'user':
                                user_q = messages[i-1].get('content')
                            break
            print(f"  user_q  : {(user_q or '(?)')[:400]}")
            print(f"  asst    : {(asst.get('content', '') if asst else '(?)')[:800]}")
            if chunks:
                print(f"  chunks ({len(chunks)}):")
                for c in chunks[:8]:
                    print(f"    [{c.get('number')}] {(c.get('articleTitle') or '?')[:70]}")
            print()
