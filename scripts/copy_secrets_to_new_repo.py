"""One-shot: copy CI-relevant secrets from .env.local to PROGPTBR/PROGPT.

Run after the GitHub repo migration to seed Actions secrets on the new repo.
Idempotent — gh secret set overwrites existing values.
"""
import os, subprocess, sys
from dotenv import load_dotenv

load_dotenv('.env.local')

REPO = 'PROGPTBR/PROGPT'

# Names referenced in .github/workflows/ci.yml (post sub-projeto 13 refresh)
CI_SECRETS = [
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
]

# Sensible defaults for entries that may not be in .env.local
DEFAULTS = {
    'OPENAI_MODEL': 'gpt-4o-mini',
    'VOYAGE_MODEL': 'voyage-3-large',
    'COHERE_RERANK_MODEL': 'rerank-multilingual-v3.0',
}

ok = 0
skipped: list[str] = []
for name in CI_SECRETS:
    value = os.environ.get(name) or DEFAULTS.get(name)
    if not value:
        skipped.append(name)
        continue
    # gh secret set NAME --repo X --body VALUE — use --body to avoid stdin
    # subtleties; pass value via env to avoid shell escape issues.
    res = subprocess.run(
        ['gh', 'secret', 'set', name, '--repo', REPO, '--body', value],
        capture_output=True, text=True,
    )
    if res.returncode == 0:
        print(f'  OK{name}')
        ok += 1
    else:
        print(f'  XX{name}: {res.stderr.strip()}', file=sys.stderr)

print(f'\nset {ok}/{len(CI_SECRETS)} secrets on {REPO}')
if skipped:
    print(f'skipped (no value in .env.local and no default): {skipped}')
