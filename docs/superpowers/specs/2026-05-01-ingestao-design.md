# Spec: Sub-projeto 2 — Pipeline de Ingestão (ProcurementGPT)

**Data:** 2026-05-01
**Sub-projeto:** 2 de 7
**Depende de:** Fundação (`fundacao-complete` tag)
**Status:** Aprovado para implementação

## Contexto

A Fundação entregou o schema (`articles`, `chunks` com `embedding vector(1024)` e `tsv tsvector` portuguese FTS) e os wrappers Node. Este sub-projeto entrega o pipeline Python que popula essas tabelas a partir de arquivos em `./artigos/`.

O retriever do sub-projeto 3 só funciona se este pipeline produzir chunks corretamente embebidos. Portanto, o critério de pronto deste sub-projeto é: dados artigos reais em `./artigos/`, executar `python scripts/ingest.py` produz uma base íntegra sobre a qual buscas vetorial e BM25 retornam resultados sensatos.

## Objetivo

CLI Python single-file (`scripts/ingest.py`) que:

- Descobre arquivos em uma pasta (filtros: `.pdf`, `.md`, `.txt`, `.html`)
- Parseia cada arquivo via `unstructured` (mix de formatos)
- Extrai metadados (título, idioma, autor opcional, data opcional) automaticamente
- Aplica chunking híbrido (estrutural por seções + sliding window 800 tokens / 100 overlap dentro de seções grandes)
- Embebe chunks via Voyage `voyage-3-large` em batches de 128
- Faz upsert idempotente em Supabase via psycopg, identificando duplicatas por SHA-256 do raw

Não-objetivos: UI admin, re-embedding em massa quando trocar modelo, crawl web, streaming de progresso pra browser, OCR profundo de PDFs scaneados.

## Stack

- **Python 3.11** (controlado por `scripts/.python-version`)
- **`unstructured[pdf,md,html]`** — parser universal
- **`langdetect`** — detecção de idioma (pt/en)
- **`psycopg[binary]` + `pgvector`** — Postgres + vector type
- **`httpx`** — Voyage HTTP (sem SDK Node aqui)
- **`tqdm`** — progress bar terminal
- **`python-dotenv`** — lê `.env.local` (mesmo arquivo do Next.js)
- **`pytest` + `pytest-mock`** — testes
- Tudo em `scripts/.venv/` (gitignored)

Decisão: **não** usar Supabase Python SDK. Escrita direta via psycopg é mais rápida, suporta `COPY` se precisarmos, e evita uma dep redundante (já temos service-role key).

## Estrutura de pastas (delta)

```
scripts/
├─ ingest.py                         (CLI + orquestração, ~300 linhas)
├─ requirements.txt                   (deps Python pinadas)
├─ .python-version                    (3.11)
├─ README.md                          (setup do venv, comandos)
├─ .embed-cache/                      (gitignored, ativo só com --cache)
└─ tests/
   ├─ __init__.py
   ├─ fixtures/
   │  ├─ sample_pt.md
   │  ├─ sample_en.md
   │  └─ sample.html
   ├─ test_chunker.py
   ├─ test_metadata.py
   └─ test_idempotency.py
artigos/
└─ .gitkeep                           (pasta vazia, alvo de drop)
supabase/migrations/
└─ 00000000000001_articles_hash_unique.sql
```

`.gitignore` ganha: `scripts/.venv/`, `scripts/.embed-cache/`, `scripts/__pycache__/`, `scripts/tests/__pycache__/`, `scripts/.pytest_cache/`.

## CLI

```bash
python scripts/ingest.py --path ./artigos/             # default: skip se hash existe
python scripts/ingest.py --path ./artigos/ --force     # reprocessa todos
python scripts/ingest.py --file ./artigos/x.pdf        # ingerir 1 arquivo
python scripts/ingest.py --dry-run --path ./artigos/   # parseia + chunka, não embeda nem grava
python scripts/ingest.py --cache --path ./artigos/     # usa cache local de embeddings
```

`argparse` da stdlib. Saída: progress bar via `tqdm`, sumário no fim (`"X new, Y skipped, Z forced. Total chunks: N"`).

## Pipeline (linear, por arquivo, em transação)

```
discover(path)                          → list[Path]
for each file (sequential):
    raw_bytes = read_file(path)
    h = sha256(raw_bytes)
    existing_id = lookup_by_hash(h)
    if existing_id and not force:
        skip(); continue
    if existing_id and force:
        delete_article(existing_id)     # CASCADE limpa chunks

    parsed = unstructured.partition(filename=path)
    meta = extract_metadata(parsed, path)
    raw_md = elements_to_markdown(parsed)
    chunks = chunk_hybrid(parsed)
    if dry_run:
        print(meta, len(chunks)); continue

    embeddings = embed_batch([c.content for c in chunks])

    with conn.transaction():
        article_id = insert_article(meta, raw_md, h)
        insert_chunks(article_id, chunks, embeddings)
```

## Chunking híbrido (`chunk_hybrid`)

1. Itera elementos do `unstructured`. Quando encontra `Title`, abre nova seção.
2. Acumula texto da seção até o limite `MAX_CHUNK_TOKENS = 800` (estimado: `len(text) // 4` ≈ 4 chars/token, suficiente como heurística).
3. Se a seção atual ultrapassa o limite com o próximo elemento, fecha o chunk corrente e abre novo.
4. Se um único elemento já excede o limite, sliding window com overlap `OVERLAP_TOKENS = 100` (em chars: 400) dentro do elemento.
5. Retorna `list[ChunkInput]` onde `ChunkInput = NamedTuple(content: str, ord: int, metadata: dict)`. `metadata` carrega `{"section_title": str | None, "page": int | None}`.

Constantes (`MAX_CHUNK_TOKENS`, `OVERLAP_TOKENS`) ficam no topo do arquivo, comentadas com a heurística usada.

## Extração de metadados (`extract_metadata`)

- `title`: primeiro `Title` element do `unstructured`. Fallback: filename sem extensão, replace `_-` por espaços.
- `language`: `langdetect.detect(first_1000_chars(raw_md))`. Aceita só `'pt'` ou `'en'`; outros idiomas ficam `'pt'` (fallback) — registrar warning no log.
- `author`: regex `r'(?:Author|Autor|By|Por)[:\s]+([A-Z][\w\s\.\-]+?)(?:\n|$)'` nas primeiras 500 chars. `None` se não bate.
- `published_at`: regex `r'\b(\d{4})-(\d{2})-(\d{2})\b|\b(\d{2})/(\d{2})/(\d{4})\b'` nas primeiras 500 chars. `None` se não bate.
- `metadata`:
  ```json
  {
    "content_hash": "<sha256>",
    "source_file": "<basename>",
    "pages": <int|null>,
    "parsed_at": "<iso-timestamp>"
  }
  ```

## Idempotência

Migration adicional (`00000000000001_articles_hash_unique.sql`):

```sql
create unique index articles_content_hash_idx
  on articles ((metadata->>'content_hash'))
  where metadata ? 'content_hash';
```

Partial unique index: só impõe unicidade quando o campo existe.

`lookup_by_hash(hash) -> article_id | None` faz `SELECT id FROM articles WHERE metadata->>'content_hash' = %s LIMIT 1`.

`--force`: `DELETE FROM articles WHERE id = %s` (FK em `chunks.article_id` tem `ON DELETE CASCADE`, limpa automaticamente).

## Embeddings em lote

`embed_batch(texts: list[str]) -> list[list[float]]`:

- Lê `VOYAGE_API_KEY` e `VOYAGE_MODEL` do env (carregado via `python-dotenv`)
- Chunka em batches de 128 textos por request
- POST `https://api.voyageai.com/v1/embeddings`
- Retry: 3 tries com backoff exponencial 2s/4s/8s nos casos `429`, `500`, `502`, `503`, `504`
- Timeout HTTP: 60s (Voyage pode demorar em batches grandes)
- Logging de tokens consumidos por response (campo `usage.total_tokens`) para visibilidade de custo

Cache local (opt-in via `--cache`):
- Diretório `scripts/.embed-cache/`
- Chave: `sha256(model + ":" + text)`
- Valor: JSON com array de floats
- Gitignored

## Inserção em DB (`insert_article` + `insert_chunks`)

- `insert_article(meta, raw_md, hash) -> uuid` — `INSERT INTO articles (...) VALUES (...) RETURNING id`
- `insert_chunks(article_id, chunks, embeddings)` — uma única statement com `executemany` ou `COPY` se virar gargalo. Para o volume A (centenas), `executemany` basta. `pgvector.psycopg.register_vector(conn)` no início pra mapear `vector` type.
- `tsv` é coluna `generated`, não inserimos.

## Tests (pytest)

Três módulos puros:

**`test_chunker.py`**
- Fixture: lista de elementos `unstructured` montada manualmente (Title + NarrativeText) em pt-BR
- Casos: doc pequeno em 1 chunk; doc com 3 seções → 3 chunks; seção gigante → split com overlap
- Asserções: `ord` sequencial 0,1,2,...; `metadata.section_title` correto; nenhum chunk vazio; overlap presente onde esperado

**`test_metadata.py`**
- Casos: markdown com `# Título`, parágrafo em pt → `title="Título", language="pt"`
- Markdown 100% inglês → `language="en"`
- Texto sem título → `title=<filename-derived>`
- Texto com `Autor: João Silva` → `author="João Silva"`
- Texto com data `2024-03-15` → `published_at=date(2024,3,15)`
- Sem autor/data → `None`

**`test_idempotency.py`**
- Mocka `lookup_by_hash` e `delete_article`
- Caso 1: hash novo + force=False → segue pra processamento
- Caso 2: hash existe + force=False → pula, contador `skipped` incrementa
- Caso 3: hash existe + force=True → chama delete, segue
- Caso 4: hash novo + force=True → não chama delete, segue

Não testamos: chamadas reais Voyage / Postgres (out of unit scope). Smoke test manual ao final do plan: ingerir 1 fixture real, verificar contagem na DB.

## Critérios de sucesso (verificáveis)

1. `python -m venv scripts/.venv && pip install -r scripts/requirements.txt` instala sem erros
2. `pytest scripts/tests/` → 3 arquivos, todos passam
3. `python scripts/ingest.py --dry-run --path scripts/tests/fixtures/` parseia os 3 fixtures sem tocar DB e imprime metadata + chunk count
4. Migration `00000000000001_articles_hash_unique.sql` aplicada (índice único existe)
5. `python scripts/ingest.py --file scripts/tests/fixtures/sample_pt.md` insere 1 article + N chunks; `select count(*)` confere
6. Re-rodar mesmo comando → "1 skipped"
7. Mesmo comando com `--force` → "1 forced", contagem na DB inalterada (delete + reinsert)
8. `/api/health` continua 200 (não regrediu Supabase)
9. `npm test` (Node side) continua 15/15 (não tocamos código Node)

## Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| `unstructured` puxa muitas deps (≥500MB) | Aceitar — é o padrão da indústria. Documentar tempo de install no README. |
| OCR Tesseract pode não estar instalado | `unstructured` cai em parsing texto-only sem OCR; documentar como prereq opcional. PDFs scaneados saem como chunks vazios — pular silenciosamente com warning. |
| Voyage rate limit em batches grandes | Retry com backoff, 60s timeout, batch size 128 (limite da API) |
| pgvector binding em psycopg | Documentar `pgvector.psycopg.register_vector(conn)` na connect helper |
| Encoding de PDFs antigos | `unstructured` lida com a maioria; se um arquivo falhar, log warning + skip, continua o batch |

## Fora de escopo

- UI admin pra subir arquivos (sub-projeto 6)
- Comando `re-embed` quando trocar modelo de embedding (sub-projeto futuro)
- Crawl web ou ingestão de fontes externas (Drive/S3)
- OCR profundo de PDFs scaneados (suporte básico via Tesseract se instalado)
- Streaming de progresso pra UI ou Slack
- Paralelismo (sequencial é suficiente pra centenas de docs)
- Checkpointing/resume (suficiente: re-rodar é idempotente)
