"""Conexão Postgres compartilhada para os scripts.

O host direto `db.<ref>.supabase.co:5432` é IPv6-only hoje e FALHA em redes
sem rota IPv6 ("Socket is not connected"). Caímos no pooler Supavisor
(IPv4) como fallback. Região do projeto: us-west-2 (ver memory
supabase_projects.md). Override via env `SUPABASE_POOLER_HOST` se mudar.
"""
import os
import urllib.parse

from dotenv import load_dotenv

# Pooler IPv4 da região do projeto (us-west-2). Session mode (5432) suporta DDL.
DEFAULT_POOLER_HOST = "aws-1-us-west-2.pooler.supabase.com"


def build_candidate_dsns(ref: str, pw: str, pooler_host: str = DEFAULT_POOLER_HOST):
    """DSNs em ordem de preferência: direto (IPv6) primeiro, pooler (IPv4) depois.

    O direto falha rápido (erro de socket, não timeout) em redes sem IPv6,
    então tentá-lo primeiro não custa quase nada e é o preferido onde há IPv6.
    """
    enc = urllib.parse.quote(pw, safe="")
    return [
        f"postgresql://postgres:{enc}@db.{ref}.supabase.co:5432/postgres?sslmode=require",
        f"postgresql://postgres.{ref}:{enc}@{pooler_host}:5432/postgres?sslmode=require",
    ]


def connect(autocommit: bool = True, connect_timeout: int = 10):
    """Conecta ao Postgres do projeto ativo, tentando direto → pooler.

    Lê `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_DB_PASSWORD` do `.env.local`.
    Retorna a conexão psycopg (autocommit=True por padrão — transações
    silenciosamente fazem rollback nesse projeto sem isso).
    """
    import psycopg

    load_dotenv(".env.local")
    ref = os.environ["NEXT_PUBLIC_SUPABASE_URL"].replace("https://", "").split(".")[0]
    pw = os.environ["SUPABASE_DB_PASSWORD"]
    pooler = os.environ.get("SUPABASE_POOLER_HOST", DEFAULT_POOLER_HOST)

    errors = []
    for dsn in build_candidate_dsns(ref, pw, pooler):
        try:
            return psycopg.connect(
                dsn, autocommit=autocommit, connect_timeout=connect_timeout
            )
        except Exception as e:  # noqa: BLE001 — tenta o próximo candidato
            errors.append(str(e)[:120])
    raise RuntimeError("all DB connection attempts failed: " + " | ".join(errors))
