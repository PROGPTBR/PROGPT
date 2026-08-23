# Backlog do diretor (19/08/2026) — plano por batch

Fonte: dois arquivos entregues pelo diretor em 21/08/2026.

- `Maturidade do negócio o que é e quais são as formas de medir.docx` — 15 prints de tela
  anotados (13 pedidos distintos).
- `Mudanças v1.xlsx` — 9 abas: modelo de pontuação do vendedor (8 grupos de critérios,
  escala 1–5, pesos somando 1,00), KPIs essenciais, ponderação de métricas, capacidades
  estratégicas, equações, 2 abas de "prompt base" e um link de exemplos de gráfico. É o
  anexo citado na anotação da tela do **Supplier Scorecard** ("utilize a planilha que foi
  enviada em anexo para colocar os cenários de avaliação").

**Já entregue** (não está neste plano): Batch A = `2a84dba` (#225) Simulador Tributário
"Em breve" + card Simulador Logístico/DIFAL · Batch B = `6368a9d` (#226) negociação (voz
1.15x, poder de decisão, técnica, concessões/trocas, checklist) · Batch C = `d3e5a4b` (#227)
financeira 12 → 15 indicadores.

**Batches D–I** estão entregues (D–G = `8084c07`, H = `03e2adb`, I = esta rodada) — ver o
Rastreamento no fim deste doc. Pendências externas: provisionar `PORTAL_TRANSPARENCIA_TOKEN`
no Railway (sem ele a 3ª base do Batch E fica dormente) e rodar
`python scripts/insert_template_rfq_padrao.py` pra o template da RFQ em produção passar a
usar os placeholders comerciais do Batch I.

## Ordem de execução

| Batch | Escopo | Esforço | Depende de |
|---|---|---|---|
| **D** ✅ | Quick wins: Homologação "SOB DEMANDA" + 2 disclaimers (preços e indicadores) | P (1 PR curto) | — |
| **E** ✅ | Busca de Fornecedores: 3 bases do governo + saúde financeira + documentação | P/M (reuso puro) | — |
| **F** ✅ | Financeira: os 3 campos qualitativos do doc (tipo de negócio, tempo de mercado, pendências) | P/M | — |
| **G** ✅ | Pesquisa de Preços: "Buscar preço e NCM aproximado" via LLM + web search | M | D (disclaimer) |
| **H** ✅ | SWOT: perguntas no Contexto Comercial + gráfico 2×2 no relatório | M | — |
| **I** ✅ | RFQ/RFP: mais campos + anexo + abrir e-mail com o arquivo anexado | M | — |
| **J** | Supplier Scorecard: adotar a planilha `Mudanças v1.xlsx` | G | — |
| **K** | Indicadores: ampliar fontes com link/fonte/data + tabela categoria→referência | G | D (disclaimer) |
| **L** | Base do cliente: materiais + vendor list (upload, atualizável, autofill) | G | — |
| **M** | Bug "assistente travado em uma operação" (diagnóstico) | ? | precisa repro |

Racional da ordem: D–F são reuso/copy com impacto imediato na demo; G–I são features
contidas numa tela; J–L são schema+integração. M depende de reprodução com o diretor.

## Regras da casa que valem para todos os batches

- **Migration nova**: o último número é `0046`. Rodar `ls supabase/migrations/` antes de
  nomear — o projeto já tem duas colisões (`0032` e `0036`). Tabela nova = **owner-RLS**
  (`user_id default auth.uid()`), **nunca** copiar o `is_admin()` do bucket `ingest-uploads`.
- **Runtime**: rotas que leem/escrevem dados do usuário usam service-role + `.eq('user_id')`
  explícito (é esse filtro, não a RLS, que segura o isolamento).
- **Custo**: qualquer call novo de LLM/embed/rerank precisa de `recordApiUsage()` com
  `operation` nova; modelo novo exige rate card em `lib/observability/api-usage.ts` **antes**
  do flip (senão cai no `RATE_FALLBACK` = gpt-5.5).
- **Tier de modelo**: narrativa/geração = `getOpenAIModel('generation')`; JSON curto de
  roteamento = default (`routing`).
- **`SYSTEM_PROMPT` do chat é byte-estável** (prefix cache OpenAI + 33 testes no
  prompt-builder). Mexer só quando o batch exigir e rodar os testes do prompt-builder.
- **Assistente novo ou mudança de status de tile** → atualizar `AssistantToolCTA`
  (`AssistantToolType` + `META` + `VALID_TYPES` + `STRIP_TYPES`) **e** a lista "Ferramentas
  dedicadas" no `SYSTEM_PROMPT`.
- **Baseline de testes**: a `main` tem **16 vitest vermelhos pré-existentes** (checkout e
  webhook do Asaas, guard de sandbox, voice-routes, middleware, EmptyState) + 1 flaky de
  exceljs. Verificado com `git stash` em 22/08/2026. Não confundir com regressão do batch.

---

## Batch D — Quick wins (copy + gating)

**Itens do doc**: (1) print 10 — "Neste em específico é algo que demanda um projeto. Coloque
esta tela como se não estivesse liberado e com os dizeres SOB DEMANDA" (card **Homologação de
Fornecedor**); (2) print 11/12 — disclaimer de preço/NCM abaixo do assistente; (3) print 13 —
disclaimer dos indicadores.

**Passos**

1. `components/assistants/assistants-data.ts`: trocar o boolean `emBreve?: boolean` por
   `badge?: 'em_breve' | 'sob_demanda'` (mantendo `emBreve` como getter derivado se ficar mais
   barato) e marcar `homologacao` como `sob_demanda`.
2. `components/assistants/AssistantsHub.tsx:76,111,132`: hoje o badge e o bloqueio de clique
   leem `assistant.emBreve` em 3 pontos — passar a ler o `badge`, com rótulo "Sob demanda" e
   CTA "Falar com o time" (mailto `comercial@2bsupply.com.br`) em vez de texto morto.
3. `components/chat/AssistantsSidePanel.tsx:48,54`: a partição disponíveis/futuros precisa
   tratar `sob_demanda` junto com `em_breve`.
4. Fechar as outras portas de entrada da Homologação: `AssistantToolCTA` (remover do
   `VALID_TYPES`/`META` ou marcar como não-sugerível), a lista de ferramentas no
   `SYSTEM_PROMPT` (`lib/rag/prompt-builder.ts`) e `app/assistants/homologacao/page.tsx`
   (redirect para `/assistants` ou tela "sob demanda"). **Não** remover
   `app/api/assistants/homologacao/route.ts` nem o tipo do CHECK de `templates` — histórico de
   runs antigos (`/assistants/runs/[id]`, `RfpHistoryList`, `lib/dashboard/labels.ts`) precisa
   continuar renderizando.
5. Disclaimers (texto **verbatim** do doc, em constante compartilhada — sugestão
   `lib/legal/disclaimers.ts`):
   - Preços/NCM: "Os preços apresentados neste relatório possuem caráter exclusivamente
     referencial…" → renderizar em `PesquisaPrecosForm.tsx` (abaixo do form) e no rodapé do
     `.docx`/resultado.
   - Indicadores: "Aviso: Antes de incluir estas informações em contratos ou pedidos de
     compra, o comprador deverá confirmar sua atualização e validá-las com o fornecedor e as
     áreas responsáveis." → `IndicadoresDashboard.tsx`.

**Testes**: hub/side-panel renderizando os 3 estados (ativo, em breve, sob demanda); `/assistants/homologacao`
redirecionando; disclaimers presentes nas duas telas.

**Risco**: a Homologação hoje é linkada da landing, `/recursos` e `lib/assistants/examples.ts` —
varrer `grep -rl homologacao` (24 arquivos) para não deixar link órfão clicável.

---

## Batch E — Busca de Fornecedores: 3 bases do governo + saúde financeira + documentação

**Item do doc**: print 3 — "além da base de fornecedores, avaliações de saúde financeira e de
documentação. Eu gostaria que o assistente acesse pelo menos 3 bases do governo e que tenha uma
análise minimamente."

**Por que é barato**: as três integrações já existem no repo, só não estão ligadas nesta tela.

| Base | Módulo existente | Estado |
|---|---|---|
| Receita Federal (CNPJ/situação/risco) | `lib/fiscal/snapshot.ts` via `POST /api/suppliers/enrich` | **já ligado** (1 base) |
| PNCP / Compras.gov.br ("fornece pro governo") | `lib/govdata/fornecedor.ts` `historicoPublico()` | existe, usado só na Homologação |
| Portal da Transparência (CEIS/CNEP) | `lib/fiscal/sancoes.ts` (`isSancoesEnabled`) | existe, desligado por falta de `PORTAL_TRANSPARENCIA_TOKEN` |

**Passos**

1. `app/api/suppliers/enrich/route.ts`: estender o payload com `historicoPublico` e
   `sancoes`, mantendo o cap de 30 CNPJs e `CONCURRENCY = 4` — cada fonte é fail-soft
   independente (uma falha não derruba o selo das outras). Cache por CNPJ como no fiscal.
2. `SuppliersResultCard.tsx`: selos novos — **"Fornece pro governo"** (nº de contratos/12m),
   **⛔ sanção CEIS/CNEP** (impeditivo, vermelho) e bloco **Documentação** com os links de
   certidões por UF (`lib/assistants/certidoes-links.ts`, já parametrizado por UF do endereço).
3. **Saúde financeira** nesta tela = sinais já disponíveis (capital social, porte, tempo de
   mercado via `aberturaAno` do PR #215) + CTA "Analisar saúde financeira" que abre
   `/assistants/financial` com CNPJ pré-preenchido. Não duplicar o assistente aqui.
4. Provisionar `PORTAL_TRANSPARENCIA_TOKEN` no Railway (cadastro grátis na CGU) — sem ele a
   3ª base fica dormente e o pedido do diretor não é atendido de fato.
5. "Análise minimamente": um resumo determinístico por card (sem LLM) — ex.
   `ATIVA · risco baixo · 3 contratos públicos/12m · sem sanções`.

**Testes**: helpers puros dos selos; enrich devolvendo parcial quando uma fonte falha; card
renderizando com/sem token de sanções.

---

## Batch F — Financeira: os 3 campos qualitativos do doc

**Item do doc**: print 8 — junto do "12 para 15" o diretor listou três coisas que **não** são
índices contábeis e por isso ficaram de fora do Batch C: tipo de negócio (pequena/grande,
comércio/serviço), **CNPJ irregular** (pendências judiciais/protestos "em alguma base
confiável") e **tempo de mercado** ("o comprador precisa colocar este número").

**Passos**

1. `lib/assistants/types.ts`: acrescentar ao `FinancialParams` (não ao
   `FinancialIndicatorsSchema` — não são indicadores e não entram na pontuação determinística):
   `tipoNegocio` (enum: micro/pequena/média/grande × comércio/indústria/serviço),
   `tempoMercadoAnos` (number) e `pendencias` (texto livre + flag).
2. `components/assistants/FinancialForm.tsx`: 2 selects + 1 número + textarea. **Tempo de
   mercado auto-preenchido** pelo botão "Consultar" que já existe: `fetchFiscalSnapshot`
   devolve `cnpjData.data_abertura` (`lib/fiscal/types.ts:107`) — calcular os anos e deixar o
   comprador sobrescrever.
3. `lib/assistants/financial.ts`: injetar os 3 no bloco de contexto do prompt com peso
   qualitativo explícito ("tempo de mercado < 3 anos = alerta de estabilidade";
   "pendências/protestos = ressalva obrigatória na recomendação"). Não mexer nos 4 pilares nem
   no score.
4. **Pendências judiciais/protestos**: não há base pública gratuita (CNJ não expõe por CNPJ;
   protesto é por cartório/CENPROT, pago). Duas saídas — escolher com o diretor:
   (a) campo manual + link para consulta (CENPROT/e-SAJ) — entrega hoje, custo zero;
   (b) reusar `lib/fiscal/reputacao.ts` (web search da OpenAI, já existe) rotulado
   **indicativo/não-oficial**, como já é feito na Homologação — custo por análise.
   Recomendação: (a) no Batch F + (b) atrás de flag no mesmo PR.

**Testes**: prompt contendo os 3 blocos quando preenchidos e ausente quando vazios; cálculo
de anos a partir de `data_abertura`.

---

## Batch G — Pesquisa de Preços: "Buscar preço e NCM aproximado"

**Item do doc**: prints 11/12 — quando o CATMAT não tem amostra ("sem amostras no recorte"),
oferecer um botão azul **"Buscar preço e NCM aproximado"** que consulta o LLM direto (o
diretor comparou com o ChatGPT respondendo "caneta BIC ≈ R$ 1,20 no RJ, conforme Kalunga").

**Passos**

1. `lib/govdata/precos.ts` já classifica o caso "sem amostras" — expor isso no resultado por
   item para o client saber quando mostrar o botão (hoje o texto está só na narrativa).
2. Novo `lib/assistants/precos-aproximado.ts`: Responses API com `tools: [{ type: 'web_search' }]`,
   **clonando o padrão de `lib/fiscal/reputacao.ts:51`** (mesmo modelo de tool, mesma
   disciplina de rótulo não-oficial). Saída zod: `{ precoUnitario, moeda, unidade, ncm,
   ncmDescricao, fontes: [{titulo, url}], confianca, dataConsulta }`.
3. `POST /api/assistants/pesquisa_precos/aproximado` (Node): `requireUser` +
   `checkChatRateLimit` + `recordApiUsage({ operation: 'pesquisa-precos-aproximado', metadata: { web_search: true } })`.
   Fail-soft → `{ disponivel: false }`.
4. `PesquisaPrecosResult.tsx`: botão azul por item sem amostra + bloco de resultado com
   **fonte e data da consulta** e o selo "referencial · não-oficial". Flag
   `PRECOS_WEBSEARCH` (default ON, espelhando `HOMOLOGACAO_WEBSEARCH`).
5. Disclaimer do Batch D acompanha o bloco no resultado e no `.docx`.

**Cuidado**: NCM sugerido por LLM erra; o texto do diretor já prevê isso ("o NCM informado
também é apenas uma referência e deverá ser confirmado…") — usar exatamente essa frase junto
do valor, nunca só o número.

---

## Batch H — SWOT: perguntas no Contexto Comercial + gráfico no relatório

**Item do doc**: "Coloque mais um item dentro do CONTEXTO COMERCIAL em forma de perguntas" +
print 7 = mockup de como a matriz deve aparecer no relatório.

**Estado atual**: a SWOT já é **gerada pela IA** (`prompt-strategy.ts:45`, 4 sub-arrays) e
renderizada como 4 cards (`NegotiationStrategyResult.tsx:204-231`) e como bullets no markdown
(`strategy-md.ts:109-122`). Falta o **input** e o **gráfico**.

**Passos**

1. `NegotiationStrategyForm.tsx`: bloco "Matriz SWOT (opcional)" dentro de CONTEXTO COMERCIAL
   com as 4 perguntas do doc (forças/fraquezas nossas e do cliente; oportunidades; ameaças) —
   4 textareas curtos, opcionais.
2. `types.ts` + `prompt-strategy.ts`: campos `swotInput.*`; quando preenchidos, o prompt passa
   a instruir "**parta do SWOT do comprador**, refine e complete — não descarte" (hoje a IA
   inventa do zero).
3. Novo `lib/assistants/negotiation/swot-chart.ts`: matriz 2×2 em `@napi-rs/canvas`, mesmo
   padrão de `kraljic-chart.ts`/`scorecard-chart.ts`; plugar no branch `negotiation` de
   `app/api/assistants/runs/[id]/chart/route.ts` e embutir no `.docx` (`mdToDocxBuffer` já
   aceita PNG, como no `spendChartPng`).

**Testes**: prompt com/sem `swotInput`; geração do PNG (smoke, como os outros charts).

---

## Batch I — RFQ/RFP: mais campos + anexo + abrir o e-mail com o arquivo

**Item do doc**: print 5 — "Colocar mais campos e que pudesse ter uma forma de anexo para
seguir com a RFQ para o mercado. Um campo onde o comprador pudesse apertar e abrisse o e-mail
dele para enviar a RFQ com o arquivo já anexado."

**Restrição técnica**: `mailto:` **não anexa arquivo** (e o body é cortado em 1800 chars —
`lib/email/mailto.ts:10`). O botão atual (`SendEmailButton`, PR #74) é o teto do mailto.

**Opções** (decidir com o diretor; recomendo 1):

1. **Download de `.eml`** — o servidor monta um RFC-822 (`multipart/mixed`) com destinatários,
   assunto, corpo e o `.docx` em base64. O clique abre o Outlook/Thunderbird **com o anexo já
   dentro**, pronto para revisar e enviar. É o que mais se aproxima do pedido, sem SMTP.
2. **Envio server-side via Resend** (já integrado, `lib/email/client.ts`): sai do nosso
   domínio, não do e-mail do comprador — muda a semântica (e exige campo de destinatários +
   registro do envio).
3. Baixar `.docx` + abrir mailto e pedir para anexar (o que existe hoje, só com instrução).

**Passos (opção 1)**

1. `lib/email/eml.ts` puro: `buildEml({ to[], subject, bodyText, attachments[] })`, quoted-printable
   no corpo + base64 no anexo, CRLF correto.
2. `GET /api/assistants/runs/[id]/eml`: reusa o `mdToDocxBuffer` do run (owner-gated via
   `getRunForOwner`, igual às rotas `docx`/`xlsx`) e devolve `message/rfc822` com
   `Content-Disposition: attachment`.
3. `RfpResult.tsx`: botão "Abrir e-mail com a RFQ anexada" ao lado do "Enviar por email"
   atual; campo opcional de destinatários (fornecedores) no resultado.
4. **Mais campos** no `RfpForm.tsx` (fechar a lista com o diretor — não está explicitada no
   doc). Candidatos naturais para RFQ de mercado: quantidade/unidade, local e prazo de
   entrega, Incoterm, condição de pagamento, validade da proposta, necessidade de amostra,
   contato do comprador, data/hora limite de resposta, moeda. Cada campo entra no
   `RfpParamsSchema` + no `buildRfpPrompt` + no template `rfq-padrao.md`.

---

## Batch J — Supplier Scorecard: adotar a planilha `Mudanças v1.xlsx`

**Item do doc**: print 9 — "Utilize a planilha que foi enviada em anexo para colocar os
cenários de avaliação".

**Gap**: hoje são 6 critérios flat, escala 0–10, pesos em % (`types.ts:841-848`). A planilha
pede: **8 grupos** (Adesão ao RFP, Informações da empresa, Compreensão do projeto, Requisitos,
Viabilidade/histórico do produto, Termos e condições, Demonstração, Resumo da taxa) com
**sub-critérios** (4–10 por grupo), **escala 1–5**, coluna **"Base para pontuação"**
(justificativa qualitativa por sub-critério), **pesos por grupo somando 1,00**, média por grupo
e score ponderado por fornecedor — mais 5 abas de conteúdo (KPIs essenciais, ponderação,
capacidades estratégicas, equações, prompt base).

**Passos**

1. **Schema hierárquico** (`types.ts`): `ScorecardCriterion` ganha `group` e `basis`
   (base para pontuação); `scale: 5 | 10` no params com **default 10 para runs antigos**
   (compat: `assistant_runs.params` de runs existentes precisa continuar abrindo em
   `PastScorecardView`). Limite atual `criteria.max(15)` sobe (a planilha tem ~40
   sub-critérios) — revisar também `suppliers.max(100)`.
2. `lib/assistants/scorecard.ts`: média por grupo → peso do grupo → score 0–100. Manter
   ranking estável em empate e as faixas 70/40.
3. **Capacidades estratégicas** (aba 5): lista de 9 itens marcáveis que **aumentam** a métrica
   final ("assinalar com x para que sendo marcado o valor aumente"). Implementar como bônus
   explícito e auditável (ex. +1 ponto por item, cap declarado), nunca como peso oculto.
4. **Prompt base** (abas "Prompt 1"/"Prompt 2" + KPIs + ponderação + equações): incorporar ao
   system prompt do scorecard como doutrina (medidas de qualidade × quantidade, scorecard como
   incentivo e não penalidade, equações de rejeição/prazo).
5. **Template e import**: `public/templates/` e `scorecard-import.ts` passam a falar a grade
   nova (grupo, sub-critério, base, 1–5) — manter aceitação do formato antigo.
6. **Exports**: `scorecard-xlsx.ts` ganha as abas espelhando a planilha; `scorecard-chart.ts`
   ganha os gráficos do link da aba 9 (sugestão: barras empilhadas por grupo + radar por
   fornecedor, além do ranking atual).
7. `ScorecardForm.tsx`: grade agrupada com colapso por grupo, soma de pesos = 100% por grupo,
   coluna de base por sub-critério.

**Risco**: é o batch que mais mexe em contrato de dados persistido. Fazer com fallback de
leitura para runs antigos e testes de round-trip (params antigos → view; params novos →
docx/xlsx/chart).

---

## Batch K — Indicadores: ampliar fontes, com link/fonte/data

**Item do doc**: print 13 — "Podemos ampliar os índices", com uma tabela de 10 fontes, a lista
"qual indicador usar em cada compra" (9 categorias), a exigência de registrar **fonte, data da
consulta, período, abrangência e metodologia** e o **link em cada indicador**.

**Estado atual**: 6 cards, **todos do BACEN/SGS** (`lib/govdata/indicadores.ts:16-21`), sem
link/metodologia por indicador.

**Trilha por viabilidade** (a diferença é o custo de integração, não o valor):

- **Tier 1 — mesma API que já usamos (BACEN/SGS)**: INPC, IGP-DI, INCC, IPA, IPCA-15 e outros
  câmbios são séries do próprio SGS. Custo ≈ acrescentar códigos + metadados. **Confirmar cada
  código consultando a série antes de commitar** (`/serie/bcdata.sgs.<n>/dados/ultimos/1`) —
  não chutar número.
- **Tier 1 — BACEN Focus**: API Olinda/OData de Expectativas de Mercado (pública, sem chave) →
  novo `GovBase 'bacen_olinda'` em `lib/govdata/client.ts:20-32` (+ `DEFAULT_BASE`, `ENV_KEY`,
  contrato em `docs/product/govdata-api-contract.md`).
- **Tier 2 — IBGE SIDRA** (IPCA/INPC/IPP/SINAPI por agregado) e **IpeaData** (OData) e
  **Comex Stat** (consulta por NCM): APIs públicas, cada uma com formato próprio → 1 módulo
  por fonte, mesmo padrão fail-soft/cache.
- **Tier 3 — sem API estável**: ANP (dados abertos em CSV/planilha), ANTT (calculadora do piso,
  só web), CEPEA (HTML/xls), Banco Mundial Pink Sheet (xlsx mensal). Entregar como **fonte
  referenciada** (card com link, descrição e aplicação em suprimentos) em vez de scraping
  frágil; promover para dado quando houver demanda.

**Passos**

1. `IndicadorCard` ganha `fonte`, `fonteUrl`, `periodo`, `abrangencia`, `metodologia`,
   `consultadoEm` — e o dashboard/`IndicadorDetailDialog` passam a exibir isso (é pedido
   explícito do doc).
2. Painel cresce por seções (Juros/Câmbio · Inflação e reajuste · Custos setoriais ·
   Commodities e comércio externo), mantendo `Promise.allSettled` por card.
3. Nova aba/bloco **"Qual indicador usar em cada compra"** — tabela estática das 9 categorias
   do doc (dado curado, não vem de API) + a nota do diretor: "indicador econômico não é cotação
   de mercado".
4. Disclaimer do Batch D.
5. `indicadores-xlsx.ts` exporta as colunas de fonte/data/metodologia.
6. Novas envs opcionais (`IBGE_API_URL`, `IPEA_API_URL`, `COMEX_API_URL`, `BACEN_OLINDA_URL`)
   com default público, todas atrás do `GOVDATA_ENABLED` existente.

**Atenção**: a tool de voz `consultar_indicadores_economicos` e o bloco macro da Análise
Financeira leem os mesmos helpers — crescer o painel sem inflar o payload dessas duas rotas.

---

## Batch L — Base do cliente: materiais + vendor list

**Itens do doc**: print 2 (ABC) — "precisa carregar o banco de dados de materiais do cliente e
seus fornecedores e que possa ser atualizado"; print 3 — "precisa carregar exemplo de planilhas
do cliente e daí ele consultar a base dele"; print 4 (Kraljic) — "poderia subir o vendor list
do cliente [e] ele puxasse da base interna facilitando com o preenchimento CNPJ, nome e outras
informações".

**Estado atual**: existe a base de fornecedores (`/fornecedores`, `suppliers`, migration 0045),
mas **só é lida em `SupplierBase.tsx` e `SuppliersResults.tsx`** (`useSupplierBase`), **não tem
import de planilha** e **não existe base de materiais**.

**Passos**

1. **Migration nova** (`0047_materials.sql`): `materials` owner-RLS — `codigo` (SKU),
   `descricao`, `categoria`, `unidade`, `ncm`, `fornecedor_padrao_cnpj`, `preco_ultimo`,
   `moeda`, `updated_at`; índice único parcial `(user_id, codigo)` para upsert idempotente.
2. **Import de planilha** para materiais e fornecedores, reusando o casamento fuzzy de
   cabeçalho e a coerção numérica pt-BR/en-US de `lib/spend/sheet-import.ts` (não reescrever).
   Regra de atualização: upsert por `codigo` / `cnpj_basico`, com preview "N novos · N
   atualizados" antes de gravar — atende o "que possa ser atualizado".
3. **Telas**: aba Materiais em `/fornecedores` (ou `/base`) com lista, filtro, edição inline e
   import; botão "Importar vendor list" na base de fornecedores.
4. **Autofill nos assistentes** (o ganho real): `ABCForm` e `KraljicForm` ganham "Carregar da
   minha base" ao lado do "Carregar exemplo"; `NegotiationStrategyForm`, `FinancialForm`,
   `HomologacaoForm` e `PesquisaPrecosForm` ganham um seletor de fornecedor/material que
   preenche nome, CNPJ e demais campos. Um hook novo (`useMaterialsBase`) espelhando
   `useSupplierBase`.
5. Semear a base a partir do que o cliente já rodou (fornecedores vistos em Spend Analysis /
   busca) é um follow-up, não escopo deste batch.

**Risco**: é o batch com maior superfície de UI. Sugiro fatiar em L1 (migration + import +
tela) e L2 (autofill nos 6 forms).

---

## Batch M — Bug "assistente travado em uma operação"

**Item do doc**: print 1 (tela **Painel**) — "Não consegui trabalhar no assistente que parece
que esta travado em uma operação".

Não é acionável como está: a anotação está sobre o Painel, que é somente leitura (`GET
/api/dashboard`), então o travamento provavelmente foi em outro lugar (execução de assistente
presa, Spend Analysis em polling, ou o chat).

**Passos**

1. Pedir ao diretor: qual assistente, o que a tela mostrava e o horário (com isso dá para achar
   o trace no Langfuse e o run no DB).
2. Enquanto isso, cobrir o modo de falha genérico: `assistant_runs` não tem coluna de progresso
   — só o Spend Analysis tem heartbeat (`spend_invoices.updated_at`, reaper de 5 min). Um run
   de outro tipo que morra no meio fica sem status terminal e a UI espera para sempre.
   Entregáveis: timeout no client com toast acionável, botão "Cancelar / recomeçar" no
   histórico, e varredura de runs órfãos (`created_at` antigo sem `output_md`).
3. Verificar também o caso Proc2Pay: etapa síncrona longa sem feedback de progresso passa a
   mesma impressão de "travado".

---

## Rastreamento

| # | Item | Batch | Status |
|---|---|---|---|
| 1 | Assistente travado | M | ⬜ precisa repro |
| 2 | Base de materiais do cliente (ABC) | L | ⬜ |
| 3 | Planilhas do cliente + 3 bases gov + saúde financeira/documentação (Busca) | E / L | 🟡 E feito (falta o token da CGU); planilhas ficam no L |
| 4 | Vendor list + autofill CNPJ/nome (Kraljic) | L | ⬜ |
| 5 | RFQ: campos + anexo + e-mail com anexo | I | ✅ |
| 6 | Negociação: voz, poder de decisão, técnica, concessões, checklist | Batch B | ✅ #226 |
| 7 | SWOT como perguntas + gráfico no relatório | H | ✅ |
| 8 | Financeira 12 → 15 indicadores | Batch C | ✅ #227 |
| 9 | Financeira: tipo de negócio, pendências, tempo de mercado | F | ✅ |
| 10 | Scorecard com a planilha `Mudanças v1.xlsx` | J | ⬜ |
| 11 | Homologação como SOB DEMANDA | D | ✅ |
| 12 | Preço + NCM aproximado via LLM | G | ✅ |
| 13 | Disclaimer de preços/NCM | D | ✅ |
| 14 | Indicadores: ampliar fontes + link/fonte/data | K | ⬜ |
| 15 | Disclaimer dos indicadores | D | ✅ |
| 16 | Simulador Tributário "Em breve" | Batch A | ✅ #225 |
| 17 | Card Simulador Logístico (DIFAL) | Batch A | ✅ #225 |

## Decisões pendentes com o diretor

### Resolvidas na implementação (confirmar com o diretor na próxima demo)

1. ✅ **Homologação "sob demanda"**: virou **CTA comercial**. O card do Hub e a página
   `/assistants/homologacao` abrem `mailto:comercial@2bsupply.com.br` com o assunto
   "Interesse: Homologação de Fornecedor"; no painel lateral do chat aparece como
   "Sob demanda", inclicável.
2. ✅ **RFQ com anexo**: implementado o `.eml` (opção 1). A mensagem sai com o `.docx` já
   anexado e abre no cliente do próprio comprador — o remetente continua sendo ele, sem
   registro de envio nem domínio nosso na conversa com o fornecedor. Resend (opção 2) fica
   disponível se o diretor quiser rastrear envios, mas muda a semântica.
3. ✅ **Quais "mais campos" na RFQ**: entrou a lista proposta inteira (quantidade/unidade,
   local e prazo de entrega, Incoterm, condição de pagamento, moeda, validade da proposta,
   data/hora limite de resposta, contato do comprador, amostra) — **todos opcionais**. Campo
   em branco não entra no prompt nem vira linha no documento.
4. ✅ **Pendências judiciais/protestos**: entregues **as duas saídas**, como recomendado —
   campo manual `pendencias` no form com links de consulta (CENPROT / e-SAJ TJSP) **e**
   busca web rotulada indicativa/não-oficial atrás de `FINANCIAL_WEBSEARCH` (default ON,
   operação de custo própria `assistant-financial-reputacao`).

### Em aberto

5. **Escala do Scorecard**: migrar tudo para 1–5 (como a planilha) ou manter 0–10 e converter
   na exibição? Afeta runs já salvos.
6. **Tier 3 dos indicadores** (ANP, ANTT, CEPEA, Pink Sheet): aceita entrar como fonte
   referenciada com link nesta rodada?

### Novas, surgidas na implementação

7. **Preço aproximado no `.docx`**: hoje o resultado do botão "Buscar preço e NCM aproximado"
   é só de tela (não entra no relatório baixado, que leva apenas o disclaimer). Deve ser
   persistido no run e incluído no `.docx` como seção "estimativas indicativas"?
8. **Sanções CEIS/CNEP**: o Batch E liga a 3ª base, mas ela só responde com
   `PORTAL_TRANSPARENCIA_TOKEN` provisionado no Railway (cadastro grátis na CGU). Confirmar
   quem provisiona antes de demonstrar "3 bases do governo".
