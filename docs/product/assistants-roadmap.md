# Roadmap de Assistentes — ProcurementGPT

> Última revisão: 2026-05-19. Catálogo + priorização dos próximos assistentes a construir, organizados pelos **8 passos do Strategic Sourcing** que já estruturam a hub `/assistants`.

## Onde estamos hoje

| Passo | Assistente | Status |
|---|---|---|
| 1. Perfil da Categoria | — | Em breve |
| 2. Análise da Categoria | — | Em breve |
| 3. Visão do Mercado Fornecedor | — | Em breve |
| **4. Estratégia de Sourcing** | **Kraljic** | ✅ Live (sub-projeto 27) |
| **5. Engajamento de Fornecedores** | **RFP / RFQ** | ✅ Live (sub-projeto 20–25) |
| 6. Negociação | — | Em breve |
| 7. Implementação do Contrato | — | Em breve |
| 8. Controle e Melhoria Contínua | — | Em breve |

**Infra reusável** (não precisamos reinventar):
- `streamText` + `onFinish` para qualquer LLM-gerado markdown
- `assemble`/`renderPlaceholders` para template + verbatim tail
- `mdToDocxBuffer` (capa + logo + dados da empresa)
- `buildCotacaoXlsxBuffer` para tabelas multi-sheet
- `RfpChatPanel` (refinement chat assistant-agnostic)
- `apply-suggestion` endpoint (refine.ts dispatcher por type)
- Histórico em `/assistants/history` + detail page `/assistants/runs/[id]`
- Retrieval híbrido + rerank para fundamentar respostas na base canônica

## Critérios de priorização

1. **Frequência de uso pelo comprador** — quanto mais perto da rotina diária, mais alta a prioridade
2. **Reuso da infra** — assistentes que viram "preencher form + LLM gera markdown + render .docx/.xlsx" são quase free vs. ferramentas com cálculo determinístico complexo
3. **Defensabilidade** — usa base canônica curada (Porter, Cox, Williamson, etc.) ou apenas template? Os com base canônica diferenciam mais
4. **Completude dos 8 passos** — cada passo coberto = história mais forte para o B2B

## Roadmap proposto — 3 trimestres

### Trimestre 1 — Densidade alta, esforço baixo (próximos 3)

Esses 3 reusam ~90% da infra do Kraljic/RFP. Cada um ~3–5 dias de dev.

#### A. **5 Forças de Porter** (passo 3)
- **Input form**: nome da categoria, segmento, observações
- **LLM gera**: análise das 5 forças (poder do comprador, poder do fornecedor, ameaça de novos entrantes, ameaça de substitutos, rivalidade) com referências canônicas (Porter 1979, HBR)
- **Output**: `.docx` com diagrama SVG das 5 forças + narrativa por força + síntese estratégica
- **Reuso**: 100% do pipeline RFP (template + assemble + chat refinamento)
- **Defensabilidade**: alta — Porter 1979 está na base, retrieval vai trazer trechos canônicos
- **Por que primeiro**: framework canônico mais pedido em entrevistas de compras + esforço mínimo

#### B. **Gerador de Cláusulas Contratuais** (passo 7)
- **Input form**: tipo de contrato (serviços/produtos/SaaS/aluguel), valor, prazo, criticidade, jurisdição, fornecedor estrangeiro?
- **LLM gera**: cláusulas SLA, força maior, reajuste por IGPM/IPCA, multa, foro, indenização, propriedade intelectual, confidencialidade, LGPD — adaptadas ao contexto
- **Output**: `.docx` com cláusulas numeradas pronto pra colar no contrato; `.xlsx` com matriz de risco por cláusula
- **Reuso**: 100% pipeline RFP
- **Defensabilidade**: média — base canônica tem material sobre TCO, contratos, mas cláusulas legais Brasil-específicas precisam ingestion de templates jurídicos (TBD)
- **Por que: ** dor diária dos compradores; quem fecha contrato precisa disso semanalmente

#### C. **Supplier Scorecard** (passo 8)
- **Input form**: lista de fornecedores (paste / upload .xlsx), 5–10 critérios (qualidade, prazo, preço, inovação, ESG, etc.) com pesos, dados de performance último período
- **Determinístico**: calcula scores ponderados; ranqueia
- **LLM gera**: análise comparativa, classificação (estratégico/desenvolvimento/saída), plano de ação por fornecedor
- **Output**: `.xlsx` multi-sheet (scorecard + ranking + plano de ação) + `.docx` narrativo
- **Reuso**: estrutura parecida com Kraljic (form de N items + classify deterministic + LLM-gera-narrativa)
- **Defensabilidade**: alta — base tem Cousins, SRM, supplier management

### Trimestre 2 — Análise quantitativa (3)

Mais cálculo, mais valor pra times maduros. Cada um ~5–7 dias.

#### D. **Curva ABC / Pareto** (passo 2)
- **Input**: lista de items com spend (paste / upload)
- **Determinístico**: ordena, calcula percentil acumulado, classifica em A/B/C
- **LLM gera**: ações sugeridas por classe (A: gestão estratégica; B: monitoramento; C: automatização/agregação), considerando o portfolio
- **Output**: `.xlsx` com curva + ranking; `.docx` narrativo

#### E. **TCO Calculator** (passo 3)
- **Input**: parâmetros do produto/serviço — preço aquisição, vida útil, custo operacional, manutenção, descarte, custo de inventário, frete, impostos
- **Determinístico**: calcula TCO por opção comparada
- **LLM gera**: análise das opções, sensibilidade aos drivers, recomendação
- **Output**: `.xlsx` com comparativo lado-a-lado; `.docx` narrativo

#### F. **Brief de Estratégia de Negociação** (passo 6)
- **Input form**: categoria, fornecedor (com info de spend/dependência), objetivos (preço/SLA/prazo/garantia), histórico, contexto (renovação? compra spot?)
- **LLM gera**: BATNA estimado, ZOPA, táticas (anchoring, packaging, splitting), checklist de concessões aceitáveis, perguntas-armadilha
- **Output**: `.docx` 1-pager pra levar pra mesa
- **Defensabilidade**: muito alta — base tem Fisher & Ury, Lewicki, Walton & McKersie

### Trimestre 3 — Fechando os 8 passos (4)

Coberturas restantes para a hub mostrar 100% verde.

#### G. **Category Profile Generator** (passo 1)
- **Input**: nome da categoria, contexto da empresa
- **LLM gera**: definição, escopo, drivers de custo, players globais/nacionais, sazonalidade, marcos regulatórios, conexões com outras categorias
- **Output**: `.docx` briefing de 2–3 páginas

#### H. **Supplier Segmentation Matrix** (passo 4) — complementa Kraljic
- Kraljic classifica **categorias**; este classifica **fornecedores** (ferramenta diferente)
- **Input**: lista de fornecedores com atributos (criticidade, performance, alinhamento estratégico, dependência mútua)
- Eixos: dependência mútua (baixa/alta) × performance (baixa/alta)
- 4 quadrantes: Transacional / Preferencial / Estratégico / Cativo
- **Output**: matriz + plano de relacionamento por quadrante

#### I. **RFI Generator** (passo 5) — versão leve do RFP
- Para mapeamento de mercado antes da etapa de RFP
- Form simples + LLM gera RFI .docx + chat de refinamento

#### J. **Contract Risk Review** (passo 7)
- **Input**: upload de contrato (anexo PDF/DOCX já suportado em /api/chat/attachments!)
- **LLM analisa**: aponta cláusulas ausentes/abusivas, calcula risk score, sugere contra-redação
- **Output**: `.docx` com markup das cláusulas problemáticas + sumário executivo

### Backlog (cross-cutting + nice-to-have)

Sem prioridade clara — surgem por demanda de cliente ou diferenciação.

- **ESG / Sustainability Assessment** — pegada de carbono, código de conduta, due diligence socio-ambiental
- **Risk Score Aggregator** — combina risco financeiro (D&B-like), geopolítico, operacional, ESG por fornecedor
- **Should-Cost Modeling** — engenharia reversa do custo do produto via decomposição (matéria-prima + mão-de-obra + overhead + margem)
- **Make-vs-Buy Analysis** — quando produzir vs terceirizar
- **Maverick Spend Detector** — identifica compras fora do contrato/política em uma planilha de spend
- **Savings Tracker** — captura cost saving / cost avoidance / value generation, valida com finanças
- **Negotiation Simulator** — role-play de negociação com o assistente como fornecedor
- **PDCA Cycle Helper** — input KPI off-track, sugere root cause + action plan
- **Supplier Onboarding Wizard** — KYC + cadastro + due diligence em workflow guiado

### Cross-cutting — não bloqueia o roadmap mas multiplica valor

- **Compartilhar entre membros do mesmo workspace** (B2B feature — ver `docs/product/b2b-roadmap.md`)
- **Versionamento de artefatos** — RFP v1, v2, v3 com diff
- **Notificações** — Slack / email quando colega "publica" análise no workspace
- **Biblioteca de templates customizados por organização** — empresa edita os templates padrão pra seu DNA

## Padrão de implementação (reuso máximo)

Cada novo assistente segue o mesmo blueprint do Kraljic/RFP — quem implementar deve respeitar:

1. **Form upfront** com schema zod
2. **Pipeline determinístico** quando houver cálculo (classifyItems pattern)
3. **`buildXPrompt`** que combina:
   - `X_SYSTEM_PROMPT` byte-stable (prefix cache)
   - Template em DB (admin curated)
   - Parâmetros do form
   - Contexto retrievado (retrieve + rerank sobre query derivada)
   - Verbatim tail (cláusulas, termos, etc.)
4. **`streamText`** com `onFinish` que faz `assembleOutput` + `updateRunOutput` + `recordApiUsage`
5. **Result page** com:
   - Markdown rendering (prose-invert)
   - Botões `.docx` / `.xlsx` (rotas `/api/assistants/runs/[id]/docx|xlsx`)
   - `RfpChatPanel` para refinamento (assistant-agnostic via `buildRefineSystemForType`)
6. **AssistantEntryChoice** (sub-projeto 28) — tela inicial com dois cards (download template + criar com assistente)
7. **Adicionar entrada em `AssistantsHub.STEPS[].assistants`** + atualizar progress bar
8. **Migration**: adicionar `'<type>'` ao CHECK constraint de `templates.assistant_type` se for um novo tipo
9. **Testing**: vitest cobrindo classify + prompt building + xlsx/docx render + api route 4xx/5xx

Esforço típico (caso o assistente seja "form simples + LLM gera + downloads"): **3-5 dias**. Caso tenha cálculo determinístico não-trivial (TCO, ABC, Scorecard): **5-7 dias**. Caso envolva ingestão custom (Contract Risk com upload de contrato): **7-10 dias** (pode reusar `/api/chat/attachments` que já parseia PDF/DOCX/XLSX).

## Decisões pendentes (não bloqueiam o T1)

- **Templates jurídicos brasileiros**: pra cláusulas contratuais de qualidade precisamos de uma biblioteca jurídica curada. Opções:
  1. Coletar templates públicos (CNJ, OAB, ANPD para LGPD) — começa com cobertura razoável
  2. Comprar/licenciar de fornecedor jurídico
  3. Pedir templates do parceiro 2B Supply
- **Diferenciação Kraljic ↔ Supplier Segmentation**: precisamos comunicar bem que são ferramentas distintas (categoria vs fornecedor). Pode virar confusão.
- **Quanto da base canônica está em PT vs EN**? Se a maioria está em EN, retrieval para certas respostas vai trazer trechos EN. Avaliar se vale ingerir mais material em PT.

## Próximo passo recomendado

Começar pelo **5 Forças de Porter** (T1-A):
- Esforço mais baixo do trimestre 1
- Framework canônico mais conhecido — bom marketing/onboarding
- Valida o padrão "novo assistente com infra Kraljic" em <1 semana
- Output visual atraente (diagrama das 5 forças em SVG, similar ao bubble do Kraljic)

Se OK, abro plano formal para o Porter assistente quando quiser.
