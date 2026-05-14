"""One-shot: apply migration 0015 (profile logo columns) + create
user-logos Storage bucket with user-scoped RLS policies.

The bucket and policies are bundled here because they're inseparable from
the column — leaving either half undone breaks the upload flow.
"""
import os, sys, urllib.parse
from dotenv import load_dotenv

load_dotenv('.env.local')
import psycopg

url = os.environ['NEXT_PUBLIC_SUPABASE_URL']
ref = url.replace('https://', '').split('.')[0]
pw = urllib.parse.quote(os.environ['SUPABASE_DB_PASSWORD'], safe='')
dsn = f'postgresql://postgres:{pw}@db.{ref}.supabase.co:5432/postgres?sslmode=require'

path = 'supabase/migrations/00000000000015_profile_logo.sql'
with open(path, 'r', encoding='utf-8') as f:
    sql = f.read()

BUCKET = 'user-logos'
SIZE_LIMIT_BYTES = 2 * 1024 * 1024  # 2 MB

with psycopg.connect(dsn, autocommit=True) as conn:
    with conn.cursor() as cur:
        print(f'applying {path} ({len(sql)} chars)')
        cur.execute(sql)
        cur.execute(
            "select column_name from information_schema.columns "
            "where table_name='profiles' and column_name in ('logo_path','logo_mime')"
        )
        cols = [r[0] for r in cur.fetchall()]
        print(f'profiles columns present: {sorted(cols)}')

        # Bucket — private, 2MB cap, only PNG/JPEG allowed
        cur.execute(
            """
            insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
            values (%s, %s, false, %s, %s::text[])
            on conflict (id) do update
              set file_size_limit = excluded.file_size_limit,
                  allowed_mime_types = excluded.allowed_mime_types
            returning id, file_size_limit, allowed_mime_types
            """,
            (BUCKET, BUCKET, SIZE_LIMIT_BYTES, ['image/png', 'image/jpeg']),
        )
        print(f'bucket: {cur.fetchone()}')

        # RLS on storage.objects — user-scoped to auth.uid()
        for pname in (
            'user_logos_owner_select',
            'user_logos_owner_insert',
            'user_logos_owner_update',
            'user_logos_owner_delete',
        ):
            cur.execute(f'drop policy if exists {pname} on storage.objects')

        b = BUCKET.replace("'", "''")
        cur.execute(
            f"""
            create policy user_logos_owner_select on storage.objects
              for select to authenticated
              using (
                bucket_id = '{b}'
                and (storage.foldername(name))[1] = auth.uid()::text
              )
            """
        )
        cur.execute(
            f"""
            create policy user_logos_owner_insert on storage.objects
              for insert to authenticated
              with check (
                bucket_id = '{b}'
                and (storage.foldername(name))[1] = auth.uid()::text
              )
            """
        )
        cur.execute(
            f"""
            create policy user_logos_owner_update on storage.objects
              for update to authenticated
              using (
                bucket_id = '{b}'
                and (storage.foldername(name))[1] = auth.uid()::text
              )
              with check (
                bucket_id = '{b}'
                and (storage.foldername(name))[1] = auth.uid()::text
              )
            """
        )
        cur.execute(
            f"""
            create policy user_logos_owner_delete on storage.objects
              for delete to authenticated
              using (
                bucket_id = '{b}'
                and (storage.foldername(name))[1] = auth.uid()::text
              )
            """
        )
        print('storage.objects policies: 4 created (select/insert/update/delete, owner-scoped)')
