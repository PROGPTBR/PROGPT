"""Testes do helper de conexão (direct → pooler fallback)."""
import psycopg
import pytest

from scripts.db_connect import build_candidate_dsns, connect, DEFAULT_POOLER_HOST


def test_build_candidate_dsns_direct_first_then_pooler():
    dsns = build_candidate_dsns("abc123", "pw")
    assert len(dsns) == 2
    # direct primeiro (preferência quando há IPv6)
    assert dsns[0].startswith("postgresql://postgres:pw@db.abc123.supabase.co:5432/")
    # pooler como fallback (IPv4), user com sufixo do ref
    assert f"postgres.abc123:pw@{DEFAULT_POOLER_HOST}:5432" in dsns[1]


def test_build_candidate_dsns_url_encodes_password():
    dsns = build_candidate_dsns("abc123", "p@ss/w:rd")
    # caracteres especiais escapados em ambos
    assert "p%40ss%2Fw%3Ard" in dsns[0]
    assert "p%40ss%2Fw%3Ard" in dsns[1]
    assert "p@ss/w:rd" not in dsns[0]


def test_build_candidate_dsns_pooler_host_override():
    dsns = build_candidate_dsns("abc123", "pw", pooler_host="aws-0-eu-west-1.pooler.supabase.com")
    assert "aws-0-eu-west-1.pooler.supabase.com" in dsns[1]


def test_connect_falls_back_to_pooler_when_direct_fails(monkeypatch):
    calls = []

    def fake_connect(dsn, **kw):
        calls.append(dsn)
        if "db.abc123.supabase.co" in dsn:
            raise OSError("Socket is not connected")  # IPv6 indisponível
        return f"CONN::{dsn}"

    monkeypatch.setattr(psycopg, "connect", fake_connect)
    monkeypatch.setenv("NEXT_PUBLIC_SUPABASE_URL", "https://abc123.supabase.co")
    monkeypatch.setenv("SUPABASE_DB_PASSWORD", "pw")

    conn = connect()
    assert isinstance(conn, str) and conn.startswith("CONN::")
    assert "pooler.supabase.com" in conn
    assert len(calls) == 2  # tentou direct, caiu no pooler


def test_connect_raises_when_all_fail(monkeypatch):
    def fake_connect(dsn, **kw):
        raise OSError("nope")

    monkeypatch.setattr(psycopg, "connect", fake_connect)
    monkeypatch.setenv("NEXT_PUBLIC_SUPABASE_URL", "https://abc123.supabase.co")
    monkeypatch.setenv("SUPABASE_DB_PASSWORD", "pw")

    with pytest.raises(RuntimeError, match="all DB connection attempts failed"):
        connect()
