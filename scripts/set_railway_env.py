"""Set Railway production env vars from .env.local in one command.

Idempotent — railway variables --set overwrites.
Run after `railway link` + `railway service link PROGPT`.
"""
import os, subprocess, sys
from dotenv import load_dotenv

load_dotenv('.env.local')

# Production-runtime env (everything /api needs at runtime + Langfuse + APP_ENV)
NAMES = [
    'OPENAI_API_KEY',
    'OPENAI_MODEL',
    'VOYAGE_API_KEY',
    'VOYAGE_MODEL',
    'COHERE_API_KEY',
    'COHERE_RERANK_MODEL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'LANGFUSE_PUBLIC_KEY',
    'LANGFUSE_SECRET_KEY',
    'LANGFUSE_BASE_URL',
    'APP_ENV',
]
DEFAULTS = {
    'OPENAI_MODEL': 'gpt-4o-mini',
    'VOYAGE_MODEL': 'voyage-3-large',
    'COHERE_RERANK_MODEL': 'rerank-multilingual-v3.0',
    'LANGFUSE_BASE_URL': 'https://cloud.langfuse.com',
    'APP_ENV': 'production',
}

args = ['railway', 'variables']
missing: list[str] = []
for n in NAMES:
    v = os.environ.get(n) or DEFAULTS.get(n)
    if not v:
        missing.append(n)
        continue
    # Strip surrounding quotes that python-dotenv may have left in (e.g. "https://...")
    if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
        v = v[1:-1]
    args.extend(['--set', f'{n}={v}'])

if missing:
    print(f'WARNING: no value found for {missing} — skipping these')

print(f'setting {len(NAMES) - len(missing)} variables on Railway service PROGPT...')
# shell=True so PATH resolution finds railway.cmd on Windows
res = subprocess.run(args, capture_output=True, text=True, shell=True)
print(res.stdout)
if res.returncode != 0:
    print(res.stderr, file=sys.stderr)
    sys.exit(1)
