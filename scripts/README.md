# scripts/ — Pipeline de Ingestão (Python)

CLI que ingere artigos de `./artigos/` para Supabase (`articles` + `chunks`).

## Setup (1x)

```bash
python -m venv scripts/.venv
# Windows PowerShell:
scripts\.venv\Scripts\Activate.ps1
# bash/zsh:
source scripts/.venv/bin/activate

pip install -r scripts/requirements.txt
```

Pré-requisitos opcionais:
- **Tesseract OCR** para PDFs scaneados (`unstructured` faz fallback gracioso se ausente)
- **Poppler** para PDFs (incluído via `unstructured[pdf]` em algumas plataformas)

## Comandos

```bash
python scripts/ingest.py --path ./artigos/             # ingestão padrão (skip se hash existe)
python scripts/ingest.py --path ./artigos/ --force     # reprocessa todos
python scripts/ingest.py --file ./artigos/x.pdf        # ingere 1 arquivo
python scripts/ingest.py --dry-run --path ./artigos/   # parse + chunk, sem DB nem embed
python scripts/ingest.py --cache --path ./artigos/     # usa cache local de embeddings

pytest scripts/tests/                                   # testes unitários
```

Lê `.env.local` da raiz do projeto.

## TS / Python helpers (devops + diagnóstico)

Scripts auxiliares que não fazem parte da pipeline principal:

| Script | Função |
|---|---|
| `apply_migrations.py` | Roda todas as `supabase/migrations/*.sql` em ordem (psycopg). Idempotente em projeto fresco |
| `bootstrap_storage.py` | Cria bucket `ingest-uploads` (privado, 100 MB) + 4 RLS policies admin path-scoped |
| `bootstrap_admin.py <password>` | Cria admin via Auth Admin API + promove `profiles.role='admin'` |
| `copy_secrets_to_new_repo.py` | Copia 11 secrets do `.env.local` pra um repo GitHub via `gh secret set` |
| `set_railway_env.py` | Seta 13 env vars no Railway service linkado via `railway variables --set` |
| `diag-recent-ingests.ts` | Lista 10 jobs mais recentes com parser, chunks, source_chars |
| `diag-article-content.ts` | Dumpa raw_md preview + cada chunk de 1 artigo |
| `diag-suspect-articles.ts` | Ranqueia artigos por chars/KB pra flagar sub-extração |
| `reclassify.ts` | Re-roda `classifyContent` em todos os artigos via `raw_md` |
| `smoke-multimodal.ts <pdf>` | Testa `parsePdfMultimodal` num PDF local |
| `rag-query.ts <query>` | CLI ad-hoc do retrieval (debug) |
| `eval/run.ts` | Eval offline (recall@5, MRR, latência); CI gate ≥ 0.85 |
