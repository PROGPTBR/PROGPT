"""One-shot: sweep orphaned files in the `ingest-uploads` bucket.

A file is considered orphaned when no row in `ingestion_jobs` has a
matching `storage_path`. This happens historically because:
  - error jobs were deleted manually before sub-projeto 32 (which added
    storage cleanup to the DELETE endpoint), leaving the upload behind
  - jobs with status='done' have their storage already deleted by the
    pipeline, but if any past run somehow skipped that step the file
    would still be here

Default mode is dry-run — prints the orphans without deleting. Pass
--apply to actually remove them.

Lists files at the top of the bucket and recursively into per-user
subfolders (the upload policy scopes paths under `<user_id>/...`).
"""
import os
import sys
import urllib.parse
from dotenv import load_dotenv

load_dotenv('.env.local')

import psycopg
import requests

BUCKET = 'ingest-uploads'


def supabase_storage_list(url: str, key: str, bucket: str, prefix: str = '') -> list[dict]:
    endpoint = f'{url}/storage/v1/object/list/{bucket}'
    headers = {
        'Authorization': f'Bearer {key}',
        'apikey': key,
        'Content-Type': 'application/json',
    }
    body = {
        'prefix': prefix,
        'limit': 1000,
        'offset': 0,
        'sortBy': {'column': 'name', 'order': 'asc'},
    }
    r = requests.post(endpoint, json=body, headers=headers, timeout=30)
    r.raise_for_status()
    return r.json()


def supabase_storage_remove(url: str, key: str, bucket: str, paths: list[str]) -> None:
    endpoint = f'{url}/storage/v1/object/{bucket}'
    headers = {
        'Authorization': f'Bearer {key}',
        'apikey': key,
        'Content-Type': 'application/json',
    }
    r = requests.delete(endpoint, json={'prefixes': paths}, headers=headers, timeout=60)
    r.raise_for_status()


def walk_bucket(url: str, key: str, prefix: str) -> list[str]:
    """Return all object paths under `prefix` (recursive). Storage list
    returns folders (id=None) and files (id=str) mixed at one level."""
    out: list[str] = []
    items = supabase_storage_list(url, key, BUCKET, prefix)
    for it in items:
        name = it.get('name')
        if not name:
            continue
        sub = f'{prefix}{name}' if prefix.endswith('/') or not prefix else f'{prefix}/{name}'
        if it.get('id') is None:
            # folder
            out.extend(walk_bucket(url, key, sub + '/'))
        else:
            out.append(sub)
    return out


def main() -> int:
    apply = '--apply' in sys.argv
    url = os.environ['NEXT_PUBLIC_SUPABASE_URL']
    key = os.environ['SUPABASE_SERVICE_ROLE_KEY']
    ref = url.replace('https://', '').split('.')[0]
    pw = urllib.parse.quote(os.environ['SUPABASE_DB_PASSWORD'], safe='')
    dsn = f'postgresql://postgres:{pw}@db.{ref}.supabase.co:5432/postgres?sslmode=require'

    print(f'[sweep] mode={"APPLY" if apply else "DRY-RUN"}')
    print(f'[sweep] listing bucket={BUCKET} ...')
    paths = walk_bucket(url, key, '')
    print(f'[sweep] {len(paths)} files in bucket')

    with psycopg.connect(dsn, autocommit=True) as conn:
        with conn.cursor() as cur:
            cur.execute(
                'select storage_path from ingestion_jobs where storage_path is not null'
            )
            referenced = {row[0] for row in cur.fetchall()}

    print(f'[sweep] {len(referenced)} referenced by ingestion_jobs')
    orphans = [p for p in paths if p not in referenced]
    print(f'[sweep] {len(orphans)} orphans')

    for p in orphans[:20]:
        print(f'  {p}')
    if len(orphans) > 20:
        print(f'  … (+{len(orphans) - 20} more)')

    if not apply:
        print('[sweep] dry-run done. Re-run with --apply to delete.')
        return 0

    if not orphans:
        return 0

    # Storage remove API accepts up to ~100 paths per call, chunk to be safe.
    chunk = 100
    removed = 0
    for i in range(0, len(orphans), chunk):
        batch = orphans[i:i + chunk]
        supabase_storage_remove(url, key, BUCKET, batch)
        removed += len(batch)
        print(f'[sweep] removed {removed}/{len(orphans)}')
    print(f'[sweep] done. {removed} files removed from bucket {BUCKET}.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
