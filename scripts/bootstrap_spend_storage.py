"""Cria o bucket `spend-uploads` + policies RLS OWNER-scoped (path = auth.uid()).

Diferente do `ingest-uploads` (admin-only), este é para usuários comuns: cada
um só acessa a própria pasta `<user_id>/...`. NÃO usa is_admin() — isso
trancaria todo usuário real (ver Análise de Gastos, sub-projeto 38).

Idempotente: bucket via on conflict do nothing; policies via drop-if-exists.
Usa o helper db_connect (direto IPv6 -> pooler IPv4, autocommit).
"""
import os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from db_connect import connect

BUCKET = "spend-uploads"
SIZE_LIMIT = 15 * 1024 * 1024  # 15 MB por arquivo (espelha SPEND_MAX_FILE_BYTES)

with connect() as conn:
    with conn.cursor() as cur:
        # 1. Bucket privado
        cur.execute(
            """
            insert into storage.buckets (id, name, public, file_size_limit)
            values (%s, %s, false, %s)
            on conflict (id) do update set file_size_limit = excluded.file_size_limit
            returning id
            """,
            (BUCKET, BUCKET, SIZE_LIMIT),
        )
        print(f"bucket: ok ({BUCKET}, limit {SIZE_LIMIT} bytes)")

        # 2. Policies OWNER-scoped (path = auth.uid()), SEM is_admin().
        for pname in (
            "spend_uploads_owner_select",
            "spend_uploads_owner_insert",
            "spend_uploads_owner_update",
            "spend_uploads_owner_delete",
        ):
            cur.execute(f"drop policy if exists {pname} on storage.objects")

        b = BUCKET.replace("'", "''")
        cur.execute(
            f"""
            create policy spend_uploads_owner_select on storage.objects
              for select to authenticated
              using (
                bucket_id = '{b}'
                and (storage.foldername(name))[1] = auth.uid()::text
              )
            """
        )
        cur.execute(
            f"""
            create policy spend_uploads_owner_insert on storage.objects
              for insert to authenticated
              with check (
                bucket_id = '{b}'
                and (storage.foldername(name))[1] = auth.uid()::text
              )
            """
        )
        cur.execute(
            f"""
            create policy spend_uploads_owner_update on storage.objects
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
            create policy spend_uploads_owner_delete on storage.objects
              for delete to authenticated
              using (
                bucket_id = '{b}'
                and (storage.foldername(name))[1] = auth.uid()::text
              )
            """
        )
        print("storage.objects policies: 4 created (owner + path-scoped, sem is_admin)")

        cur.execute(
            "select id, public, file_size_limit from storage.buckets where id = %s",
            (BUCKET,),
        )
        print("verify:", cur.fetchone())
