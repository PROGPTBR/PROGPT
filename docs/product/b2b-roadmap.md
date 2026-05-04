# ProcurementGPT — Roadmap B2B (rascunho 2026-05-03)

Plano de fases para transformar o produto atual (single-tenant, invite-only, base canônica única) num SaaS B2B vendável para times de compras. Salvo a partir de conversa de 2026-05-03 — não é um milestone formal ainda; vira PROJECT.md/roadmap quando o usuário aprovar.

> **Pré-requisito de saúde**: Milestone 1 fechado, CI verde (`recall@5 ≥ 0.85`), Langfuse instrumentado fim-a-fim. A camada técnica para virar produto está madura — o que falta é a camada de produto/comercial/compliance.

---

## O que já está pronto a favor

- Auth + RLS owner-only (sub-projetos 6a/6b)
- Ingestão assíncrona TS (sub-projeto 6c)
- Retrieval híbrido + Cohere rerank + eval automatizado (sub-projeto 3 + 7)
- Observabilidade fim-a-fim com Langfuse + CI gate de qualidade (sub-projeto 7)

Base acima do MVP médio. O caro daqui pra frente é **multi-tenancy** e **billing**.

---

## Bloqueadores agrupados

### Comerciais (sem isso, não vende)
1. **Multi-tenancy real** — `organizations` table, `org_id` em tudo (articles, chunks, sessions, jobs, ingestion_jobs), RLS por org, convites por org, billing por org. Maior refactor do produto.
2. **Knowledge base por cliente** — namespace de corpus por org (canônico compartilhado vs. privado), retrieval que mistura "base canônica + base do cliente", controle de visibilidade.
3. **Onboarding self-service** — signup → criar org → convidar time → upload docs → primeiro chat. Hoje é invite-only manual com 1 admin global.
4. **Billing & planos** — Stripe + planos por seats/mensagens/docs ingeridos, paywall + trial, fatura/NF-e (BR).
5. **SSO** — Microsoft 365 / Azure AD (maioria dos times de compras BR), idealmente SAML para enterprise. Google Workspace OAuth já existe.

### Confiança (LGPD, Segurança, Compliance)
6. **DPA + termos** — Data Processing Agreement, política de privacidade, termos de uso, sub-processadores listados (Google, Voyage, Cohere, Supabase, Langfuse, Vercel).
7. **Data residency** — Supabase em região BR (São Paulo) ou ao menos opção.
8. **Audit log** — `audit_events` table cobrindo ações sensíveis (quem viu, ingeriu, deletou, convidou).
9. **Content safety / PII redaction** — guardrail detectando CNPJ, CPF, dados de fornecedor sensíveis em uploads.
10. **Retenção & exclusão** — UI de "deletar minha conta + tudo" (cascade via FK já existe), prazo de retenção configurável por org.
11. **SOC 2 / ISO 27001 path** — relatório de pen-test + roadmap visível para enterprise grande.

### Produto (sem isso, churn rápido)
12. **Feedback loop** — 👍/👎 + comentário por resposta, alimentando eval e melhorando prompt/retrieval.
13. **Citações opcionais** — toggle "ver fontes" ou painel lateral com chunks recuperados (reverter parcialmente decisão de 2026-05-02 para contexto B2B).
14. **Personas / casos de uso** — "Comprador estratégico", "Categoria indireta", "Sourcing internacional" — coleção de queries-modelo por persona.
15. **Integrações** — Notion/Confluence export, Slack/Teams bot, upload por link (Google Drive/SharePoint).
16. **Analytics para admin do cliente** — perguntas mais frequentes, queries sem resposta, adoção semanal.
17. **API pública** — OpenAPI + API keys por org + rate limiting, para clientes embarcarem no portal interno.

### Operação
18. **Rate limiting + abuse protection** — proteger orçamento Gemini/Voyage/Cohere por org.
19. **Cost dashboard por org** — saber quanto cada cliente custa para precificar bem.
20. **Observabilidade pública** — status page, incident comms, SLA contratual.
21. **Suporte** — Intercom/Crisp + base de conhecimento + SLA de resposta.

---

## Roadmap em fases

### Fase 1 — Vendável (mínimo para abrir conversa de venda)
Sub-projetos candidatos:
- **8 — multi-tenancy** (orgs + RLS por org, migração dos dados existentes para "org default", convites por org)
- **9 — knowledge base por cliente** (corpus canônico vs. privado, retrieval merged, UI de gestão)
- **10 — feedback loop** (👍/👎 + comentário, persiste em DB, alimenta eval)
- **11 — citações opcionais** (toggle no chat, painel lateral de fontes)

### Fase 2 — Cobrável (mínimo para ter receita)
- **12 — Stripe + planos** (seats/mensagens/docs, trial, paywall)
- **13 — onboarding self-service** (signup público → criar org → convidar)
- **14 — cost dashboard por org** (consumo de Gemini/Voyage/Cohere por org, alertas)

### Fase 3 — Enterprise (mínimo para ticket grande)
- **15 — Microsoft SSO** (Azure AD OAuth + idealmente SAML)
- **16 — audit log** (`audit_events` + UI de visualização para admin do cliente)
- **17 — DPA + sub-processadores + termos** (página pública + flow de assinatura)
- **18 — status page + SLA contratual**
- **19 — API pública** (OpenAPI + API keys por org + rate limiting já desenhado)

### Fase 4 — Defensivo (mínimo para enterprise grande não recusar)
- **20 — SOC 2 path** (políticas internas + pen-test agendado)
- **21 — PII redaction** (guardrail em upload + chat)
- **22 — integrações** (Slack/Teams bot, Notion/Confluence export, Google Drive/SharePoint upload)
- **23 — analytics para admin do cliente** (dashboard de uso interno)

---

## Decisões pendentes antes de virar milestone formal

1. **Nome da empresa proprietária** — ainda TBD (CLAUDE.md). Bloqueia branding em marketing site, contratos, billing.
2. **Modelo de pricing** — por seat? por mensagens? por docs ingeridos? híbrido? (afeta sub-projeto 12)
3. **GTM** — venda direta (founder-led) vs. self-service vs. parcerias com consultorias de procurement?
4. **Reverter "sem citações"?** — decisão de 2026-05-02 foi pensada para UX consumer. B2B precisa de fontes visíveis pelo menos como toggle. Confirmar com usuário antes de sub-projeto 11.
5. **Data residency obrigatória?** — depende de qual segmento mira (enterprise BR exige SP; mid-market aceita US).

---

## Próximo passo concreto

Quando aprovado, este documento vira:
- update do `CLAUDE.md` abrindo "Milestone 2 — B2B Foundation"
- `/gsd:new-milestone` ou edição manual do roadmap em `.planning/`
- spec do sub-projeto 8 (multi-tenancy) primeiro, porque trava todo o resto
