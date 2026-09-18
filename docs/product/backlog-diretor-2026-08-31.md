# Backlog do diretor (31/08/2026) — plano por batch

Fonte: mensagens do Alexandre (2B Supply) via WhatsApp em 31/08/2026, 3 ideias novas + 1
imagem de exemplo. Continua a numeração de
[`backlog-diretor-2026-08-19.md`](backlog-diretor-2026-08-19.md) (Batches A–M já entregues).

- **Monitor de Entregas** [14:17] — "Cruza pedido, contrato, programação, recebimento e
  estoque. Antecipa atrasos."
- **Radar de Mercado** [14:18] — "Acompanha preço do café, histórico, tendências, câmbio e
  notícias relevantes. Ajuda a decidir quando comprar." + [14:18] "Nós temos o segundo,
  poderíamos ter mais índices desta linha de produção" + [14:20] ideia de "consultor de
  últimas notícias" (comprador pergunta "me dê as últimas notícias de tal linha de produção" →
  lista de notícias daquele setor) + [14:23] visão de virar **módulo específico do PROGPT para
  compra de commodities**, começando pelo café e evoluindo pra soja, milho, trigo, açúcar e
  outras categorias. Imagem anexa: tabela de cenários (Base/Alta/Queda/Estresse) cruzando %
  de variação de Café/Câmbio/Frete → Impacto financeiro em R$.
- **Homologador Digital** [14:34] — "Documentação + critérios. Checklist de homologação e
  riscos encontrados." Detalhado em [14:37]: a empresa já tem lista pré-definida de documentos
  necessários; o comprador pede essa lista ao vendedor (exemplo dado: "Célio"); o vendedor
  recebe acesso a uma página "Enviar documentos", anexa os arquivos, e a IA já cruza o que foi
  pedido com o que foi entregue, dando sinal verde ou vermelho mostrando o que está faltando.

**Nenhum destes 3 itens foi iniciado.** Este doc é só planejamento — nenhum código foi escrito.

## Ordem de execução

| Batch | Escopo | Esforço | Depende de |
|---|---|---|---|
| **N** | Radar de Mercado — Fase 1: câmbio ao vivo + consultor de notícias por setor + simulador de cenário (Base/Alta/Queda/Estresse) | M | — |
| **O** | Homologador Digital — checklist configurável + portal externo pro fornecedor subir documentos + IA cruza pedido×entregue | G | Capability nova: portal público tokenizado (ver risco) |
| **P** | Monitor de Entregas — cruza pedido/contrato/programação/recebimento/estoque, antecipa atrasos | G+ | Escopo não está definido — precisa de decisão do diretor antes de codar (ver seção) |

Racional da ordem: N é o único dos três que tem infraestrutura pronta pra reusar (câmbio ao
vivo, padrão de web search) e dá pra demonstrar rápido. O e P exigem capability nova
(portal externo sem login) ou schema inteiro novo (PO/contrato/estoque) — nenhum dos dois
tem precedente no código hoje; ver achados por item abaixo.

## O que já existe (achados da investigação no código, 31/08/2026)

- **Câmbio USD/BRL — já existe, reuso direto**: `lib/govdata/indicadores.ts` (`SGS.CAMBIO_USD`,
  código BACEN 1) dá o câmbio atual; `lib/spend/fx.ts` (`PTAX_SERIES` + `pickNearestRate`) já
  resolve câmbio histórico por data via PTAX, hoje usado só pelo Spend Analysis.
- **Preço de café/commodity agrícola — não existe, sem API estável conhecida**:
  `lib/govdata/indicadores.ts:594-597` já lista CEPEA/Esalq como **fonte referenciada** (card
  com link, sem integração ao vivo) desde o Batch K anterior — mesma classificação "Tier 3"
  daquele doc. Nenhuma integração viva de preço agrícola em lugar nenhum do código hoje.
- **Padrão de web search / notícias — reuso parcial**: `lib/fiscal/reputacao.ts`
  (`buscarReputacao`) usa `openai.responses.create({ tools: [{ type: 'web_search' }] })`,
  fail-soft (nunca lança), timeout 25s, kill-switch por env (mesmo padrão de
  `HOMOLOGACAO_WEBSEARCH`/`FINANCIAL_WEBSEARCH`), `recordApiUsage` com `operation` dedicada.
  A assinatura é amarrada a CNPJ/razão social pra due diligence de fornecedor — não dá pra
  chamar direto pro "consultor de notícias" (prompt livre por tema/commodity). Clonar o
  padrão (mesmo tool, mesmo fail-soft/timeout/kill-switch) num módulo novo é o caminho, não
  reuso da função em si.
- **Homologação atual — zero sobreposição com o Homologador Digital novo**:
  `lib/assistants/homologacao.ts` (`fetchHomologacaoData`) é 100% consulta a bases públicas
  por CNPJ em paralelo (Receita, PNCP, sanções, reputação web) — nenhum upload de documento,
  nenhum checklist configurável pela empresa, nenhum cruzamento pedido×entregue. A ideia nova
  roda **em paralelo** ao assistente existente, não o substitui nem se sobrepõe.
- **Portal externo tokenizado (fornecedor sem login) — não existe, capability nova**:
  `lib/email/inbound.ts` só gera alias de *e-mail* (`cotacoes-<token>@dominio`) — o token nunca
  vira URL. Grep por rota `[token]` em `app/`: zero resultados. `middleware.ts` (linha do
  matcher) só gateia rotas autenticadas conhecidas; uma rota pública nova (ex.
  `/homologacao-vendor/[token]`) não seria bloqueada pelo gate do Supabase, mas também não tem
  **nenhum precedente** de geração/validação de token público, expiração ou rate-limit
  anônimo no projeto (o rate-limit anônimo existente, sub-projeto 25, é só pra
  signup/reset-password). Buckets de Storage hoje (`ingest-uploads`, `spend-uploads`) são
  todos `user_id`-scoped via RLS — um bucket novo pra upload de fornecedor externo precisa ser
  **token-scoped**, não `auth.uid()`-scoped, e as policies de Storage atuais não servem de
  modelo direto.
- **Parse de documento — reuso direto**: `app/api/chat/attachments` já faz parse
  multimodal de PDF/DOCX reusável pro passo "IA lê os documentos enviados".
- **Proc2Pay — não serve de base pro Monitor de Entregas**: as etapas `emissao_po`,
  `follow_up` e `avaliacao` (`lib/proc2pay/executors.ts`) são narrativa pura de LLM — a "PO"
  emitida é uma string (`PO-${ano}-${timestamp}`) sem quantidade/prazo/local estruturado, e
  não existe leitura/escrita de estoque, contrato ou recebimento em lugar nenhum do schema.
  Zero tabela de `pedido`/`contrato`/`programação`/`recebimento`/`estoque` existe hoje (grep
  completo em `supabase/migrations/*.sql` confirma). O Monitor de Entregas seria construído do
  zero — na melhor das hipóteses, consumindo o `context.emissao_po` do Proc2Pay como uma das
  fontes de "pedido", mas isso é insuficiente sozinho porque falta o resto (contrato,
  programação, recebimento, estoque).

---

## Batch N — Radar de Mercado (Fase 1)

**Item do doc**: "Acompanha preço do café, histórico, tendências, câmbio e notícias
relevantes. Ajuda a decidir quando comprar" + "mais índices desta linha de produção" +
consultor de últimas notícias + simulador de cenário (imagem).

**Escopo desta fase**: só as partes que já têm infraestrutura pronta. Preço de café ao vivo
fica pra uma fase 2 condicionada a uma fonte de dado real (ver "Decisões pendentes").

**Passos**

1. **Câmbio ao vivo por categoria/commodity**: expor `SGS.CAMBIO_USD` (já existe em
   `lib/govdata/indicadores.ts`) numa tela/card dedicado de "Radar de Mercado — Café", com
   histórico via range query (mesmo padrão do `/assistants/indicadores` do sub-projeto 37).
2. **Consultor de últimas notícias** (novo `lib/assistants/market-news.ts`, clonando
   `lib/fiscal/reputacao.ts`): `buscarNoticiasSetor({ tema, contexto? })` via
   `openai.responses.create` com `tools:[{type:'web_search'}]`, fail-soft, timeout 25s,
   kill-switch novo (`MARKET_NEWS_WEBSEARCH`, default ON, espelhando
   `HOMOLOGACAO_WEBSEARCH`/`FINANCIAL_WEBSEARCH`). Saída zod: lista de `{titulo, resumo, url,
   data, fonte}`, rotulada "não-oficial/indicativo" como as outras due diligences.
   `POST /api/assistants/market/news` (Node, `requireUser` + `checkChatRateLimit` +
   `recordApiUsage({ operation: 'market-news-search' })`).
3. **Simulador de cenário** (Base/Alta/Queda/Estresse, da imagem): calculadora pura no client
   — usuário informa 3 valores-base (preço café, câmbio, frete) + volume/quantidade de compra;
   4 linhas pré-definidas de % de variação (Base=0%/0%/0%, Alta/Queda/Estresse configuráveis)
   calculam o impacto em R$. **Não depende de preço de café ao vivo** — os valores-base são
   digitados pelo comprador (ele já sabe o preço que está cotando). `lib/assistants/market-
   scenario.ts` puro/testável (mesmo espírito de `lib/dashboard/aggregate.ts`), sem LLM, sem
   chamada de API — é só aritmética. Câmbio-base pode ser pré-preenchido pelo card do passo 1.
4. **Tela** `/assistants/market` (ou dentro de `/assistants/indicadores`, decidir layout):
   card de câmbio + bloco de notícias + simulador de cenário, com CEPEA/Esalq como fonte
   referenciada (link) pro preço de café real, igual ao padrão já usado no Batch K pra
   commodities sem API.
5. Registrar em `AssistantToolCTA` + lista "Ferramentas dedicadas" do `SYSTEM_PROMPT` (ver
   "O que evitar" do CLAUDE.md) **se** virar um assistente novo formal — se ficar como extensão
   do painel de indicadores existente, não precisa.

**Testes**: `market-scenario.ts` puro (cálculo de impacto pros 4 cenários + custom);
`buscarNoticiasSetor` fail-soft (erro/timeout → `[]`, nunca lança); endpoint com rate-limit +
auth mockados.

**Risco**: nenhum risco estrutural — é o batch mais barato dos três porque não inventa
capability nova, só compõe módulos existentes (`indicadores`, o padrão `reputacao.ts`, uma
calculadora pura).

---

## Batch O — Homologador Digital (checklist + portal do fornecedor)

**Item do doc**: comprador tem lista de documentos pré-definida pela empresa → pede ao
vendedor → vendedor sobe os documentos numa página própria → IA cruza pedido×entregue → sinal
verde/vermelho com o que falta.

**Gap**: isso não existe. Requer uma capability nova pro projeto — acesso externo sem login
via token, com upload de arquivo. Ver achados acima (`lib/email/inbound.ts` só gera alias de
e-mail, não link; nenhuma rota `[token]` existe; buckets de Storage são todos
`user_id`-scoped).

**Passos**

1. **Checklist configurável** (por empresa/comprador, não hardcoded): tabela nova
   `homologacao_checklists` (owner-RLS, `user_id`, `nome`, `documentos jsonb` — lista de
   `{label, obrigatorio, descricao}`). Sem isso vira lista fixa e não atende "lista
   pré-definida pela empresa".
2. **Convite ao fornecedor**: tabela nova `homologacao_convites` (owner-RLS na criação —
   `user_id` = comprador; token opaco gerado via `crypto.randomBytes`, igual ao padrão já
   usado pra alias de e-mail em `lib/email/inbound.ts`; `expires_at`; `checklist_id`;
   `fornecedor_nome`/`email` pra contexto). `POST /api/assistants/homologacao/convites` gera o
   link (`/homologacao/enviar/[token]`) — comprador copia/envia manualmente (ou, se
   `RESEND_INBOUND_DOMAIN` estiver setado, reusa `lib/email/client.ts` pra mandar direto).
3. **Página pública `/homologacao/enviar/[token]`** (fora do matcher do `middleware.ts` —
   **não** pode ficar atrás do gate de assinatura, é o fornecedor externo sem conta acessando):
   valida token+expiração server-side (`GET /api/public/homologacao/[token]`, sem
   `requireUser`), mostra a checklist, permite upload por item (reusa `app/api/chat/
   attachments` pro parse). Rate-limit anônimo por IP nesta rota (mesmo padrão de
   `checkAnonRateLimit`, sub-projeto 25) — é a única superfície pública de upload de arquivo do
   projeto, superfície de abuso nova.
4. **Bucket novo `homologacao-uploads`**, **token-scoped** (não `user_id`-scoped como os
   buckets atuais): policy de insert só via service-role a partir da rota validada por token,
   não RLS de `auth.uid()` — o uploader não tem conta.
5. **Cruzamento IA**: `lib/assistants/homologacao-review.ts` — pra cada documento requerido na
   checklist, classifica se algum arquivo enviado o satisfaz (tipo de documento via parse
   multimodal + LLM classificador barato, tier `routing`), produz `{item, atendido: bool,
   arquivoId?, observacao?}[]`. Sinal verde/vermelho agregado + lista do que falta.
6. **Tela do comprador**: `/assistants/homologacao/convites/[id]` mostra status do convite
   (pendente/em análise/completo), resultado do cruzamento, e permite pedir reenvio de item
   específico.

**Testes**: geração/validação de token (válido, expirado, inexistente); rate-limit anônimo na
rota pública; cruzamento IA com checklist completa/parcial/vazia; RLS/policy do bucket novo
(fornecedor não pode ler documentos de outro convite).

**Risco — o maior dos três**: é a primeira superfície do projeto com upload de arquivo por
usuário **sem conta**. Precisa de rate-limit anônimo dedicado, expiração de token curta
(sugestão: 7 dias, configurável), e antivírus/validação de MIME mais rígida que os fluxos
internos (superfície de abuso: qualquer um com o link pode tentar subir arquivo malicioso).
Recomendo revisão de segurança dedicada antes de expor a rota pública em produção.

---

## Batch P — Monitor de Entregas

**Item do doc**: "Cruza pedido, contrato, programação, recebimento e estoque. Antecipa
atrasos."

**Por que não tem passos numerados ainda**: ao contrário de N e O, este item **não tem escopo
definido o suficiente pra planejar direito**. "Pedido", "contrato", "programação",
"recebimento" e "estoque" são 5 conceitos que hoje não existem no schema **nenhum um deles** —
não é estender uma tabela existente, é desenhar um mini-ERP de rastreamento de compras. Antes
de codar, preciso de respostas do diretor (ver "Decisões pendentes" abaixo) — do contrário o
risco é construir 5 tabelas que não batem com o fluxo real do cliente.

**O que dá pra afirmar hoje sem mais contexto**:

- Não reusa Proc2Pay como fonte de dado — as etapas `emissao_po`/`follow_up`/`avaliacao` são
  só texto de LLM, sem quantidade/prazo/local estruturado persistido (ver achados acima). Na
  melhor hipótese, o Proc2Pay poderia **futuramente** gravar num Monitor de Entregas já
  existente (dependência inversa), não o contrário.
- "Estoque" é o conceito mais arriscado de todos — é o único que, se levado a sério
  (quantidade atual, ponto de reposição, saldo por SKU), pede sincronização com um sistema
  real do cliente (ERP/WMS existente) e não é algo que o usuário vai manter atualizado te
  digitando manualmente por muito tempo. Vale perguntar ao diretor se "estoque" aqui é
  simplificado (ex: só "quantidade esperada vs. recebida" por pedido) ou se é de fato saldo
  corrente — são dois produtos bem diferentes em esforço.
- "Antecipa atrasos" sugere que existe uma **data prometida** (da programação/contrato) e uma
  **data real** (do recebimento) sendo comparadas — esse é o núcleo mínimo do produto
  (comparação de datas + alerta), e dá pra entregar sem resolver "estoque" de verdade.

**Proposta de escopo mínimo** (a confirmar com o diretor antes de qualquer código): tabela
`purchase_orders` (owner-RLS) com `numero`, `fornecedor_cnpj`, `itens jsonb`, `data_pedido`,
`data_prometida`, `contrato_ref` (texto livre ou link, não uma entidade de contrato completa
na v1), `status`; tabela `purchase_order_recebimentos` (1:N, `data_recebimento`,
`quantidade_recebida`, `divergencia`). "Antecipa atrasos" = job/query que compara
`data_prometida` com `hoje` pra pedidos sem recebimento completo e sinaliza risco — sem
depender de integração de estoque nenhuma na v1. Isso reduz o escopo de "mini-ERP completo"
pra "rastreador de prazo de pedido", que é o que a frase "antecipa atrasos" realmente pede.

---

## Decisões pendentes com o diretor

1. **Radar de Mercado — preço de café ao vivo**: não existe fonte pública com API estável (CEPEA/Esalq é HTML/scraping frágil, já rejeitado no Batch K anterior pelo mesmo motivo). Aceita entrar como fonte referenciada (link + "consulte no CEPEA") na Fase 1, e avaliar uma fonte paga/parceria (ex. um provedor de dados de commodities) numa fase 2 se o módulo de commodities avançar de fato?
2. **Radar de Mercado — escopo do módulo de commodities**: o diretor descreveu uma visão grande ("módulo específico do PROGPT para compra de commodities", café → soja/milho/trigo/açúcar). O Batch N proposto acima é deliberadamente pequeno (Fase 1). Confirma que faz sentido validar pequeno com café antes de generalizar pra outras commodities, ou já quer o desenho do módulo completo antes de codar qualquer coisa?
3. **Homologador Digital — quem define a checklist**: é por empresa (1 checklist padrão do comprador) ou por categoria/tipo de compra (várias checklists)? Afeta o schema do Batch O (passo 1).
4. **Homologador Digital — canal de convite**: o vendedor recebe o link por e-mail automático (precisa `RESEND_INBOUND_DOMAIN`/Resend outbound configurado) ou o comprador copia/cola o link manualmente (WhatsApp, e-mail próprio)? V1 proposta no Batch O assume manual — automático é incremento simples depois.
5. **Monitor de Entregas — "estoque" simplificado ou saldo real**: ver nota acima. Define se o Batch P é um rastreador de prazo de pedido (menor) ou uma integração de estoque de verdade (maior, provavelmente exige integração com sistema do cliente).
6. **Monitor de Entregas — fonte do "pedido"**: nasce sempre dentro do PROGPT (ex.: um Proc2Pay concluído vira um pedido automaticamente) ou o comprador cadastra pedidos que vieram de fora do sistema (ERP do cliente, e-mail, etc.)? Isso muda se o Batch P precisa de uma tela de cadastro manual de pedido na v1.
