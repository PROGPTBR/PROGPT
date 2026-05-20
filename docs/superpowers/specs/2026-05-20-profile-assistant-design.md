# Sub-projeto 33 — Profile (Perfil da Categoria) Assistant

**Status:** spec aprovado conversacionalmente em 2026-05-20.
**Roadmap:** Strategic Sourcing Step 1 — "Perfil da Categoria" (hoje `available:false` no hub).
**Tag-alvo de fechamento:** `profile-assistant-complete`.

## Context

O hub `/assistants` mostra 8 passos do Strategic Sourcing; Steps 2 (ABC), 3 (Porter), 4 (Kraljic), 5 (RFP) e 7 (Financial) já existem. Step 1 — "Perfil da Categoria" — está vazio. É o primeiro passo do método: caracterização da categoria de compra **antes** de classificar spend ou ir pra mercado. Sem ele, ABC/Kraljic/Porter/RFP rodam às cegas (o comprador inventa categoria e critérios no momento, sem documento autoritativo).

Além de fechar o gap visível no hub, o Perfil destrava um padrão de uso integrado: outros assistentes ganham um botão **"Iniciar de um Perfil"** que pré-popula seus forms com os campos relevantes. v1 não muda schema de outros assistentes — o link `perfilId` vive em `params` JSONB do run-filho.

## Approach

Padrão de assistente puro — reusa `buildAssistantHandler` (entregue no PR #53) → route declarativa de ~30-50 linhas. Sem classificação determinística (Perfil é puramente narrativo). Inclui upload opcional de PDF/DOCX que extrai os 15 campos via multimodal antes do form.

## Componentes (resumo de Seção 2)

**Schema** — 15 campos em 5 blocos (Identificação, Volume & mercado, Critérios técnicos, Stakeholders, Prioridade). 4 obrigatórios + 11 opcionais. Mapping para integração:

| Destino | Recebe |
|---|---|
| RFP | `category, scope, criteria` |
| Kraljic | `portfolioName, items[0].category` |
| Porter | `categoria, segmento, escopo` |
| ABC | `analysisName` |
| Financial | _não recebe_ — é per-fornecedor |

Todos os runs gerados a partir de um Perfil ganham `perfilId: <uuid>` em `params` JSONB (sem migration nas tabelas-filhas).

**Arquivos novos**

- `lib/assistants/profile.ts` — `PROFILE_SYSTEM_PROMPT` + `buildProfilePrompt`
- `lib/assistants/profile-extract.ts` — `extractProfileFromUpload(buffer, mime, filename)`
- `app/api/assistants/profile/route.ts` — `buildAssistantHandler({type:'profile', ...})`
- `app/api/assistants/profile/extract/route.ts` — POST multipart, extração com Zod
- `app/api/assistants/runs/[id]/details/route.ts` — GET retorna `{ params }` do run (owner-gated)
- `components/assistants/ProfileForm.tsx`
- `components/assistants/ProfileResult.tsx`
- `components/assistants/ProfileAssistant.tsx`
- `components/assistants/PastProfileView.tsx`
- `components/assistants/UseProfilePicker.tsx` — dropdown reusável, montado em TODOS os 5 forms existentes
- `components/assistants/previews/ProfileDocPreview.tsx`
- `app/assistants/profile/page.tsx`
- `supabase/migrations/00000000000021_profile_assistant_type.sql` — estende CHECK pra incluir `'profile'`
- `scripts/apply_migration_0021.py`
- `docs/product/templates/profile-padrao.md` + `scripts/insert_template_profile.py`
- Tests: `tests/lib/assistants/profile.test.ts`, `tests/lib/assistants/profile-extract.test.ts`, mais branch em `tests/lib/assistants/refine-dispatch.test.ts`

**Arquivos modificados (≤5 linhas cada na maioria)**

- `lib/assistants/types.ts` — `'profile'` no `AssistantType` + `ASSISTANT_TYPES` + `ProfileItemSchema`, `ProfileParamsSchema`, `ProfileRequestSchema`, exports tipo + union em `AssistantRunRow.params`
- `lib/assistants/template-assembly.ts` — `AssistantParams` union ganha `ProfileParams` + branch de `renderPlaceholders` para placeholders de Perfil
- `lib/assistants/refine.ts` — `PROFILE_REFINE_SYSTEM_PROMPT` + `buildProfileRefineSystem` + branch no dispatcher
- `lib/assistants/docx.ts` — sem alteração obrigatória (markdown→docx já é genérico)
- `lib/observability/api-usage.ts` — `'assistant-profile-generate'`, `'-refine'`, `'-apply'`, `'-extract'`
- `app/api/assistants/runs/[id]/apply/route.ts` — `PROFILE_SYSTEM_PROMPT` no dispatcher
- `app/api/assistants/runs/[id]/chat/route.ts` — `'profile': 'assistant-profile-refine'` no refineOp map
- `app/api/assistants/runs/[id]/docx/route.ts` — sem alteração (markdown→docx genérico)
- `app/assistants/runs/[id]/page.tsx` — `PastProfileView` no dispatcher
- `components/assistants/AssistantsHub.tsx` — Step 1 → `available:true`, novo spotlight card no topo
- `components/assistants/RfpHistoryList.tsx` — branch `'profile'` no rendering
- `components/admin/TemplateEditor.tsx`, `TemplatesAdmin.tsx` — `'profile'` no dropdown + label map
- Cada `{Rfp,Kraljic,Porter,Financial,Abc}Form.tsx` — montagem do `UseProfilePicker` no topo + handler `onProfileSelected`

## Data flow

Detalhado na Seção 3 da conversa. Três fluxos principais: gerar (form → handler → stream), extrair (upload → multimodal → form), integrar (picker em form existente → details → setState).

## Error handling

- **Extract failures**: se a chamada multimodal falhar (zod parse error, timeout 120s, erro de API), o endpoint `/extract` retorna `{ error: 'extract_failed', message }` com status 422. O form mostra toast "Falha ao extrair — preencha manualmente" sem bloquear o fluxo.
- **Upload size**: cap em 10MB (igual `/abc/import`). Mime check estrito: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`. Outros → 400 `unsupported_mime`.
- **Form validation**: client-side via Zod (`ProfileParamsSchema.safeParse`). Server-side a mesma schema reaplica no `buildAssistantHandler`.
- **Picker (`UseProfilePicker`) sem perfis**: dropdown mostra empty state com link "Criar Perfil →" para `/assistants/profile`. Botão não é escondido — preserva discoverability.
- **Picker em run sem `perfilId`**: o run pode existir mas ter sido gerado antes da integração — picker não mostra ele como origem; o run-filho continua sem `perfilId` (campo é opcional).
- **Refine que pede pra "reclassificar" campos do form**: igual aos outros assistentes — `PROFILE_REFINE_SYSTEM_PROMPT` instrui a NÃO alterar valores literais de requisitos técnicos / restrições regulatórias (audit-críticos), mas pode sugerir reformulações.
- **Apply que mude o output_md**: o apply usa `splitAssembledOutput` igual aos outros — preserva tail verbatim do template. Nenhum tratamento especial.

## Testing

**Vitest novos:**

- `tests/lib/assistants/profile.test.ts`
  - `ProfileParamsSchema` valida campos obrigatórios; rejeita stakeholders vazios; aceita defaults em opcionais
  - `buildProfilePrompt` injeta os 15 campos no user prompt; o system prompt é byte-stable (prefix cache)
  - System prompt menciona "preservar literal" para requisitos técnicos e restrições regulatórias

- `tests/lib/assistants/profile-extract.test.ts`
  - `PartialProfile` (zod) aceita 0 ou mais campos preenchidos
  - Extração com sucesso retorna params + warnings vazio
  - Extração com extract parcial gera warnings nominais por campo ausente

- `tests/api/assistants/profile-extract.test.ts`
  - 400 sem multipart
  - 400 com mime não suportado
  - 401 sem auth
  - 200 com PDF mockado retorna `{ params, warnings }`
  - 422 quando o multimodal call falha

- `tests/lib/assistants/refine-dispatch.test.ts` (acréscimo)
  - dispatcher de `'profile'` retorna `PROFILE_REFINE_SYSTEM_PROMPT`
  - System prompt instrui preservação literal de campos críticos

- `tests/components/assistants/UseProfilePicker.test.tsx`
  - Empty state mostra link "Criar Perfil →"
  - Click em item dispara `onProfileSelected` com os params completos

**Smoke manual:**

1. Subir PDF de perfil existente → form pré-preenche ≥10 dos 15 campos.
2. Preencher form do zero, submit, baixar .docx, abrir e verificar todas 5 seções.
3. Chat refine: pedir "expanda os sub-segmentos" → output muda sem perder requisitos técnicos literais.
4. Abrir RFP, clicar "Iniciar de um Perfil ▾", selecionar o Perfil → form do RFP fica pré-populado, submit gera RFP coerente, `params.perfilId` vem populado no row de DB.
5. Mesmo teste pra Kraljic, Porter, ABC.

**CI gates:**

- `npm run typecheck` zero erros
- `npx vitest run` 100% green
- `npm run rag:eval` recall@5 ≥ 0.85 (não esperado mudar)

## Critical files / reuso

- [lib/assistants/handler.ts](../../../lib/assistants/handler.ts) — buildAssistantHandler (PR #53)
- [lib/assistants/template-assembly.ts](../../../lib/assistants/template-assembly.ts) — `splitTemplateBody` + `assembleOutput`
- [lib/ingest/multimodal-parse.ts](../../../lib/ingest/multimodal-parse.ts) — `parsePdfMultimodal` (reusado em `/extract`)
- [lib/ingest/docx-parse.ts](../../../lib/ingest/docx-parse.ts) — `parseDocxWithTables`
- [lib/observability/api-usage.ts](../../../lib/observability/api-usage.ts) — `recordApiUsage`
- [lib/assistants/refine.ts](../../../lib/assistants/refine.ts) — dispatcher e padrão dos REFINE_SYSTEM_PROMPTs

## Verification (end-to-end)

1. `python scripts/apply_migration_0021.py` aplica migration no Supabase.
2. `python scripts/insert_template_profile.py` insere template padrão.
3. `npm run typecheck && npx vitest run` — esperado zero erros e ~640+ tests passando (~25 novos).
4. Smoke manual de 5 passos acima.
5. PR + merge para `main`, tag `profile-assistant-complete`.
