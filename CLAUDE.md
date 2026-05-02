# Projeto: ProcurementGPT — Especialista em Teorias de Compras

## Contexto
Chatbot especialista treinado em centenas de artigos sobre teorias, frameworks e práticas
de procurement. Empresa proprietária do produto **a definir** (não usar IAgentics — referência
removida em 2026-05-02). Audiência: gestores de compras brasileiros (PT-BR primário, EN secundário).

## Stack obrigatória
- Next.js 14 App Router + TypeScript strict
- Tailwind + shadcn/ui (tema light/dark via `next-themes`)
- Supabase (Postgres + pgvector + Auth + Storage)
- Google Generative AI SDK (`@google/genai`) — Gemini 3.1 Flash Lite (preview) para classificação, condenser e geração one-shot
- Vercel AI SDK (`ai` v4 + `@ai-sdk/google`) — para o streaming SSE do endpoint de chat
- Voyage AI para embeddings (`voyage-3-large`, 1024 dims)
- Cohere Rerank 3 para reranking
- Langfuse para observabilidade (sub-projeto 7)

## Princípios não-negociáveis
1. **Retrieval híbrido obrigatório** — vetorial + lexical (FTS portuguese) + RRF + Cohere rerank, nunca só cosine
2. **Resposta fundamentada na base** — o contexto recuperado é injetado no prompt para fundamentar a resposta; o modelo NÃO menciona fontes, IDs, ou números entre colchetes para o usuário (decisão 2026-05-02). Sem fonte na base, dizer explicitamente "não tenho fonte sobre isso"
3. **Streaming SSE** — resposta começa a aparecer em <3s
4. **Edge Runtime** nas rotas de chat, Node runtime na ingestão Python
5. **LGPD compliance** — logs sem PII, opt-in para histórico (sub-projeto 6)
6. **Custos sob controle** — cache de embeddings, Gemini Flash Lite para todas as chamadas LLM

## Estrutura de pastas
```
/app
  /api
    /chat/route.ts            (streaming endpoint, Edge)
    /health/route.ts          (smoke check, Edge)
  /(chat)/page.tsx            (UI principal, sub-projeto 5)
  /admin/page.tsx             (gestão de artigos, sub-projeto 6+)
/lib
  /rag
    types.ts                  (Classification, RetrievedChunk, SourceRef, ChatMessage, RagResult)
    classifier.ts             (Gemini Flash: teoria, intenção, idioma)
    retriever.ts              (vetorial + FTS via RPC, RRF)
    reranker.ts               (Cohere wrapper, fallback para RRF)
    prompt-builder.ts         (system prompt + contexto fundamentador, SEM citações)
    condenser.ts              (multi-turn → standalone query)
    index.ts                  (runRag orquestrador)
  /db
    supabase.ts               (server + browser clients)
  /llm
    gemini.ts                 (one-shot wrapper, @google/genai)
    voyage.ts                 (embed com inputType opcional)
    cohere.ts                 (rerank wrapper)
  /env.ts                     (requireEnv)
  /chat-storage.ts            (localStorage CRUD para sessões — sub-projeto 5)
/components
  /chat (ChatRoot, ChatSession, Sidebar, Header, EmptyState, MessageList, Message, Composer)
  /ui (shadcn)
/hooks
  useChatSessions.ts          (sub-projeto 5)
/scripts
  ingest.py                   (pipeline Python separado, sub-projeto 2)
  rag-query.ts                (CLI de debug, sub-projeto 3)
  /eval
    golden.json               (10 Q&A pairs)
    run.ts                    (recall@5, MRR, latência)
/supabase/migrations
  00000000000000_init.sql                       (pgvector, FTS, articles, chunks)
  00000000000001_articles_hash_unique.sql       (idempotência da ingestão)
  00000000000002_rag_rpc.sql                    (match_chunks, search_chunks_fts)
```

## Identidade visual
- **Branding TBD** — empresa proprietária ainda será criada. Não usar IAgentics, ProAICircle, ou qualquer marca específica. Produto se identifica como "ProcurementGPT".
- Cor de acento: `#0066ff` (electric blue) via CSS variable `--brand` — trocável quando a marca final for definida
- Tipografia: Inter
- Sem logo de empresa no header até decisão de branding; só nome do produto

## Comportamento do agente
Persona: "Especialista sênior em procurement com 20 anos de experiência, formação acadêmica
sólida (Kraljic, Porter, Monczka, Cox, Cousins, Dyer), didática mas direta, fundamentada na base
de conhecimento."

Estrutura padrão de resposta (sem citações visíveis):
1. Resposta direta (2-3 linhas)
2. Aprofundamento teórico baseado no contexto fornecido
3. Aplicação prática (exemplo ou caso)
4. Sugestão de leituras complementares (3 artigos da base, mencionados pelo título)

NÃO inventar teorias. Se não houver fonte na base, dizer explicitamente. NÃO mencionar IDs,
números entre colchetes, ou referências bibliográficas estilo `[1]` na resposta — é só
para o usuário ler como uma explicação fluente.

## Variáveis de ambiente
```
GOOGLE_API_KEY=
GEMINI_MODEL=gemini-3.1-flash-lite-preview
VOYAGE_API_KEY=
VOYAGE_MODEL=voyage-3-large
COHERE_API_KEY=
COHERE_RERANK_MODEL=rerank-multilingual-v3.0
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_DB_PASSWORD=          # para o ingest.py via psycopg
LANGFUSE_PUBLIC_KEY=           # opcional até sub-projeto 7
LANGFUSE_SECRET_KEY=
LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

## Comandos
- `npm run dev` — desenvolvimento Next.js
- `npm test` — vitest (TypeScript)
- `npm run typecheck` — `tsc --noEmit`
- `npm run db:migrate` — aplicar migrations Supabase via CLI (ou aplicar manualmente via psycopg/dashboard)
- `npm run rag:query "<pergunta>"` — CLI ad-hoc de retrieval
- `npm run rag:eval` — eval offline (recall@5, MRR, latência)
- `python scripts/ingest.py --path ./artigos/` — ingerir artigos
- `python scripts/ingest.py --file <arquivo>` — ingerir 1 arquivo
- `python scripts/ingest.py --dry-run --path ./artigos/` — preview sem DB
- `scripts/.venv/Scripts/pytest.exe scripts/tests/` — testes Python

## O que evitar
- Chunking fixo por N tokens (use semantic chunking — sub-projeto 2 já entrega híbrido)
- Apenas busca vetorial (sempre híbrida + reranker)
- Mostrar `[1]`, `[2]`, IDs, ou referências bibliográficas para o usuário (decisão 2026-05-02)
- Bibliotecas pesadas no Edge Runtime
- Hardcoded prompts no componente — sempre em `/lib/rag/prompt-builder.ts`
- Reintroduzir IAgentics ou outra marca antes de o usuário decidir o nome da empresa
- Conectar a Supabase com `psycopg` sem `autocommit=True` (transações silenciosamente fazem rollback — ver memory `psycopg3_autocommit.md`)
