# Plano — Billing (Asaas, hosted checkout) · Sub-projeto 27

## Contexto

Item #2 do roadmap go-live B2C. Hoje o produto é 100% free e single-tenant; pre-launch público (#1 já hardened pelo sub-projeto 25) precisa de billing pra capturar receita imediata e qualificar usuários sérios.

Brainstorm fechou as decisões de produto:

| Decisão | Escolha | Justificativa |
|---|---|---|
| Goal | **Receita rápida** | MRR visível em 30-60d; paywall agressivo |
| Free tier | Chat ilimitado + **1 execução lifetime** por assistente (7 totais) | Free experimenta valor de cada assistente uma vez (vê .docx, banner Kraljic, score), depois paywall |
| Pro tier | Chat + assistentes **ilimitados** | Sem feature gating além do volume |
| Preço | **R$ 99/mês** | Premium positioning vs ChatGPT Plus; cobre custos com folga |
| Métodos | **Cartão recorrente + Pix Garantido** | Cobre 95% do mercado BR; ambos auto-renew |
| Ciclo | **Mensal only** (v1) | Anual com desconto fica em v1.5 |
| Trial | Sem trial temporal | A 1 execução grátis lifetime *é* o trial |
| Cancelamento | End-of-period (não imediato) | User mantém Pro até fim do ciclo já pago |
| Refund | Sem reembolso v1 | Padrão B2C; documentar em termos |
| Approach | **Asaas Hosted Checkout** | Sem PCI scope; Asaas handle 3DS/retries/cartão recusado |

## Arquitetura — Approach A (Hosted Checkout)

```
User → /pricing → "Upgrade" → POST /api/billing/checkout
                                  ↓
                            Cria Asaas customer (se 1ª vez)
                                  ↓
                            Cria Asaas subscription
                                  ↓
                            Asaas retorna invoiceUrl (hosted checkout)
                                  ↓
                            Insert subscription row (status='pending')
                                  ↓
                            Redirect 302 → invoiceUrl
                                  ↓
                            User paga no Asaas (cartão ou Pix)
                                  ↓
                            Asaas webhook → /api/billing/webhook/asaas
                                  ↓
                            Verify HMAC + idempotency → update subscription
                                  ↓
                            Asaas redirect callback → /account/billing?success=1
```

## Camada de dados — Migration 0027

[supabase/migrations/00000000000027_billing.sql](supabase/migrations/00000000000027_billing.sql) (NEW)

```sql
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  asaas_customer_id text,
  asaas_subscription_id text unique,
  status text not null check (status in ('pending','active','past_due','cancelled','expired')),
  plan text not null default 'pro',
  payment_method text check (payment_method in ('credit_card','pix')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_user_idx on subscriptions(user_id);

-- billing_webhook_events: idempotency + audit log
create table billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  asaas_event_id text not null unique,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);
create index billing_webhook_events_unprocessed on billing_webhook_events(created_at desc)
  where processed_at is null;

-- RLS: user lê só a própria sub; service-role faz tudo via getServerSupabase
alter table subscriptions enable row level security;
create policy subscriptions_own_select on subscriptions
  for select using (user_id = auth.uid());

alter table billing_webhook_events enable row level security;
-- Sem policies — só service-role acessa (mesmo padrão de rate_limit_events)
```

## Camada de libs (NEW)

[lib/billing/asaas.ts](lib/billing/asaas.ts) — wrapper REST Asaas:
- `getAsaasClient()` singleton (lê `ASAAS_API_KEY`, `ASAAS_API_URL`)
- `createCustomer({ name, email, cpfCnpj })` → `{ id }`. **CPF é obrigatório** pela API do Asaas — coletamos no /pricing form antes do checkout. Não persistido no nosso DB (passa direto pra Asaas).
- `createSubscription({ customerId, billingType, value, cycle, description })` → `{ id, invoiceUrl }`. v1 envia `billingType: 'UNDEFINED'` — Asaas hosted checkout mostra cartão **e** Pix pro user escolher na hora (1 fluxo cobre os 2 métodos).
- `cancelSubscription(subId)` → void
- `getSubscription(subId)` → state sync (force-refresh em casos de webhook lost)

[lib/validators/cpf.ts](lib/validators/cpf.ts) (NEW, ~30 LOC):
- `isValidCpf(cpf: string): boolean` — checksum oficial (módulo 11) + formato
- `formatCpf(cpf: string): string` — normaliza pra dígitos puros (`12345678901`)
- Usado no `/api/billing/checkout` body validation

[lib/billing/subscription.ts](lib/billing/subscription.ts):
- `getActiveSubscription(userId): Promise<Subscription | null>` (service-role; checa status='active' E current_period_end > now)
- `isPro(userId): Promise<boolean>`
- Cache request-scoped via AsyncLocalStorage (mesmo pattern do `withUser` do sub-projeto 23) pra evitar 5 queries no mesmo request

[lib/billing/quota.ts](lib/billing/quota.ts):
- `getAssistantQuotaUsed(userId, type): Promise<number>` — count `assistant_runs where user_id = ? and assistant_type = ?`
- `canUseAssistant(userId, type): Promise<boolean>` — `isPro || quotaUsed === 0`
- Free quota = 1 execução **lifetime** por tipo. Sem reset mensal — count permanente.

## Endpoints novos (Node runtime)

[app/api/billing/checkout/route.ts](app/api/billing/checkout/route.ts) (NEW)
- `requireUser()` → 401
- Body zod: `{ name: string, cpf: string }` (CPF validado via `isValidCpf`; nome cobrado no form pra Asaas customer)
- Race protection: se user já tem subscription `status in ('pending','active')` → 409 (com invoiceUrl recente se pending <1h)
- Cria Asaas customer se primeiro upgrade (passa name + email + cpfCnpj). Se já tem subscription cancelled, reusa `asaas_customer_id`.
- Cria Asaas subscription (`value: 99.00`, `cycle: 'MONTHLY'`, `billingType: 'UNDEFINED'` — user escolhe cartão/Pix no checkout)
- Insert subscription row (status='pending')
- Retorna `{ checkoutUrl: invoiceUrl }`

[app/api/billing/webhook/asaas/route.ts](app/api/billing/webhook/asaas/route.ts) (NEW)
- **Sem requireUser** — chamado pelo Asaas
- Verify header `asaas-access-token === ASAAS_WEBHOOK_TOKEN` → 401 se falhar
- Body: Asaas event `{ id, event, payment: { subscription, ... } }`
- Idempotency: `insert into billing_webhook_events(asaas_event_id, ...) on conflict do nothing` → se 0 rows → já processado → 200
- Switch:
  - `PAYMENT_CREATED` → noop (insert do row)
  - `PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED` → status='active', `current_period_end = paymentDate + 1 month`
  - `PAYMENT_OVERDUE` → status='past_due'
  - `PAYMENT_REFUNDED` / `PAYMENT_DELETED` → status='cancelled', `cancelled_at = now()`
  - `SUBSCRIPTION_DELETED` → status='cancelled'
- Marca event `processed_at = now()` no billing_webhook_events
- Retorna 200

[app/api/billing/cancel/route.ts](app/api/billing/cancel/route.ts) (NEW)
- `requireUser()` → 401
- Lê active subscription do user
- Se não tem → 404
- Chama Asaas `cancelSubscription`
- Update local: `cancel_at_period_end = true` (mantém status='active' até webhook PAYMENT_DELETED)
- Retorna `{ ok: true, accessUntil: current_period_end }`

## Enforcement — paywall do free tier

[lib/assistants/handler.ts](lib/assistants/handler.ts) (EDIT):
Adicionar antes do `createRun`:
```ts
if (!(await canUseAssistant(user.id, config.type))) {
  return Response.json({ error: 'paywall', plan: 'free' }, { status: 402 });
}
```

[app/api/assistants/negotiation/strategy/route.ts](app/api/assistants/negotiation/strategy/route.ts) (EDIT):
- Mesmo check antes de `generateStrategy`

[app/api/chat/route.ts](app/api/chat/route.ts): **SEM mudança** — chat é free ilimitado.

Cliente trata 402: hook em SignupForm e nas action handlers dos assistant pages mostra `<PaywallModal>` quando recebe `error: 'paywall'`.

## UI

[app/pricing/page.tsx](app/pricing/page.tsx) (NEW)
- Public (sem requireUser); se logado, lê isPro pra ajustar CTAs
- `<PricingTable>` componente: 2 colunas Free vs Pro
- Free: chat ilimitado · 1 execução de cada assistente (lifetime) · suporte comunidade
- Pro (R$ 99/mês): chat ilimitado · assistentes ilimitados · suporte por email
- CTA "Assinar Pro" → abre modal `<CheckoutForm>` com campos **Nome completo** + **CPF** (mask + validação client-side via `isValidCpf`) → submit → POST /api/billing/checkout → redirect pro Asaas
- Se anônimo: CTA redireciona pra `/login?next=/pricing`
- Se já é Pro: card "Você já é Pro · Gerencie em /account/billing"

[app/account/billing/page.tsx](app/account/billing/page.tsx) (NEW)
- `requireUser()` redirect-protected
- Server component: lê subscription via service-role
- Mostra: status (badge color-coded), payment method, next charge date, cancellation status
- Se Pro ativo: botão "Cancelar assinatura" → confirm modal → POST /api/billing/cancel
- Se cancelled com period futuro: "Acesso até DD/MM" + "Reativar" (cria nova checkout)
- Se free: CTA "Upgrade pra Pro"

[components/billing/PaywallModal.tsx](components/billing/PaywallModal.tsx) (NEW)
- Trigger: chamada 402 do client em assistant pages
- Conteúdo: "Você já usou seu RFP grátis. Pro = R$ 99/mês — RFP ilimitado + 6 outros assistentes."
- Botão "Ver planos" → `/pricing`

[components/auth/UserRow.tsx](components/auth/UserRow.tsx) (EDIT)
- Adicionar item "Assinatura" antes de "Excluir minha conta"
- Badge "Pro" no email se `isPro` (chamada client-side ao mount)

[components/billing/PricingTable.tsx](components/billing/PricingTable.tsx) (NEW) e [SubscriptionPanel.tsx](components/billing/SubscriptionPanel.tsx) (NEW) — encapsulam UI do `/pricing` e `/account/billing` respectivamente.

## Asaas webhook setup (operacional)

- Painel Asaas → Webhooks → adicionar URL: `https://progpt-production.up.railway.app/api/billing/webhook/asaas`
- Eventos a habilitar: `PAYMENT_CREATED`, `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_REFUNDED`, `PAYMENT_DELETED`, `SUBSCRIPTION_DELETED`
- Access token: gerar no Asaas, configurar em `ASAAS_WEBHOOK_TOKEN`
- Sandbox primeiro (`https://sandbox.asaas.com/api/v3`); só vira `https://www.asaas.com/api/v3` após smoke completo

## Env vars novas

| Var | Tipo | Setup |
|---|---|---|
| `ASAAS_API_KEY` | server | Painel Asaas → API Integration → Token |
| `ASAAS_API_URL` | server | Sandbox: `https://sandbox.asaas.com/api/v3` · Prod: `https://www.asaas.com/api/v3` |
| `ASAAS_WEBHOOK_TOKEN` | server | Asaas → Webhooks → access token |
| `NEXT_PUBLIC_PRO_PRICE_BRL` | client | `99.00` — fonte única da verdade pra UI |

## Reuso explícito

- [lib/db/supabase.ts](lib/db/supabase.ts) `getServerSupabase()` em todos os endpoints novos
- [lib/auth.ts](lib/auth.ts) `requireUser()`
- [lib/observability/user-context.ts](lib/observability/user-context.ts) `withUser` pattern pra propagar Pro-status caching (sub-projeto 23)
- [lib/observability/api-usage.ts](lib/observability/api-usage.ts) `recordApiUsage` — tracker das chamadas Asaas (novo provider `asaas`)
- Migration pattern + `apply_migration_NNNN.py` (sub-projeto 25/26)
- Padrão de teste de endpoints (sub-projeto 25): mock `verifyTurnstileToken`, mock `getServerSupabase`

## Não modifica

- /api/chat e demais endpoints autenticados
- Cascades de FK (subscriptions cascadeia com auth.users)
- Schema de `assistant_runs` (já tem user_id + assistant_type — basta count)

## Arquivos a criar / modificar

| Path | Tipo | LOC aprox |
|---|---|---|
| supabase/migrations/00000000000027_billing.sql | NEW | ~70 |
| scripts/apply_migration_0027.py | NEW | ~50 |
| lib/billing/asaas.ts | NEW | ~150 |
| lib/billing/subscription.ts | NEW | ~80 |
| lib/billing/quota.ts | NEW | ~50 |
| lib/validators/cpf.ts | NEW | ~30 |
| app/api/billing/checkout/route.ts | NEW | ~120 |
| app/api/billing/webhook/asaas/route.ts | NEW | ~150 |
| app/api/billing/cancel/route.ts | NEW | ~60 |
| app/pricing/page.tsx | NEW | ~40 |
| app/account/billing/page.tsx | NEW | ~50 |
| components/billing/PricingTable.tsx | NEW | ~120 |
| components/billing/SubscriptionPanel.tsx | NEW | ~100 |
| components/billing/PaywallModal.tsx | NEW | ~80 |
| lib/assistants/handler.ts | EDIT | +10 |
| app/api/assistants/negotiation/strategy/route.ts | EDIT | +10 |
| components/auth/UserRow.tsx | EDIT | +15 |
| Tests (~25) | NEW | ~600 |
| CLAUDE.md | EDIT | +15 |

**Total**: 14 arquivos novos, 3 editados, ~25 testes novos.

## Tests novos

- `lib/billing/asaas.test.ts` — mock fetch, test cada função do client (createCustomer/Subscription/cancel/get)
- `lib/billing/subscription.test.ts` — getActiveSubscription com diferentes estados
- `lib/billing/quota.test.ts` — canUseAssistant em todos os cenários (free com 0 runs / free com 1 / pro)
- `tests/api/billing/checkout.test.ts` — 401, body inválido, race protection, sucesso
- `tests/api/billing/webhook.test.ts` — HMAC inválido, idempotency, cada event type
- `tests/api/billing/cancel.test.ts` — 401, sem subscription, sucesso
- `tests/api/assistants/paywall.test.ts` — 402 quando free quota usada, 200 quando Pro

## Verification

1. **Migration 0027 em prod** (mesma pattern do 0025/0026 — usuário cola SQL no Supabase editor)
2. **Env vars** Asaas configuradas no Railway (sandbox primeiro)
3. **Webhook URL** registrada no painel Asaas
4. `npm run typecheck` zero erros
5. `npx vitest run` — ~771 testes verdes (746 atuais + 25 novos)
6. **Smoke sandbox** (Asaas sandbox env):
   - User free executa 1 RFP → sucesso
   - Tenta 2ª RFP → 402 + PaywallModal aparece
   - Click "Ver planos" → /pricing
   - "Assinar Pro" → checkout do Asaas → cartão teste 4242... → confirma
   - Webhook chega → `PAYMENT_CONFIRMED` → status='active'
   - Retry RFP → sucesso (sem paywall)
   - /account/billing mostra "Pro · Próxima cobrança DD/MM"
   - "Cancelar" → confirm → cancel_at_period_end=true → "Acesso até DD/MM"
7. **Smoke webhook PAYMENT_OVERDUE** (forçar via Asaas dashboard):
   - status='past_due' → próxima tentativa de assistente retorna 402
8. **Switch pra prod** (após sandbox 100% verde):
   - Trocar `ASAAS_API_URL` + `ASAAS_API_KEY` + `ASAAS_WEBHOOK_TOKEN`
   - Smoke real com cobrança de R$ 1 (criar plan temporário) ou R$ 99 + estorno

## Risks & mitigations

1. **Webhook não chega / atraso**: Asaas tem retry built-in (3 tentativas em 1h). Adicionar admin endpoint `/api/admin/billing/sync/[subId]` pra force-sync via `getSubscription` em caso emergência.
2. **Customer Asaas órfão** (user cancela, depois quer voltar): reusar `asaas_customer_id` no row antigo da subscription — passa pra `createSubscription`. Não cria customer duplicado.
3. **Race: 2 checkouts simultâneos**: gating no `/api/billing/checkout` — se já tem subscription `pending`, retorna a `invoiceUrl` existente em vez de criar nova.
4. **Test card vazado em prod**: validar no startup que `ASAAS_API_URL` aponta pra prod quando `APP_ENV='production'` — quebra build/health-check se errado.
5. **User cancela cartão na operadora antes do fim do ciclo**: Asaas dispara `PAYMENT_OVERDUE`, status='past_due', paywall ativa.
6. **CPF coletado mas não persistido**: Asaas API exige `cpfCnpj` em `createCustomer` (verificado nos docs). Coletamos no form de /pricing antes do checkout, validamos checksum local, enviamos pro Asaas e descartamos. Não armazenamos em nosso DB — Asaas guarda como parte do customer record dele. Reduz superfície LGPD.
7. **Cobrança em fuso horário**: Asaas usa America/Sao_Paulo. Nosso `current_period_end` deve respeitar — calcular via `paymentDate + interval '1 month'` no DB (não no Node).
8. **LGPD account-delete (sub-projeto 25) durante Pro ativo**: `auth.admin.deleteUser` cascateia subscription (CASCADE). Mas Asaas não sabe — refusar delete se subscription ativa, ou disparar `cancelSubscription` antes do delete user. **TODO**: editar `/api/account/delete` pra chamar cancelSubscription primeiro se existir.

## Esforço

**~5-7 dias dev:**

- **Dia 1**: migration + lib/billing (asaas client + subscription + quota helpers) + tests
- **Dia 2**: 3 endpoints (checkout, webhook, cancel) + tests
- **Dia 3**: paywall enforcement em assistants handler + negotiation/strategy + tests
- **Dia 4**: UI (/pricing, /account/billing, PaywallModal, UserRow updates) + smoke local
- **Dia 5**: smoke Asaas sandbox + ajustes de webhook + webhook setup no painel
- **Dia 6**: smoke Asaas prod com R$ 1 + buffer pra bugs
- **Dia 7**: CLAUDE.md, docs, PR final

## Próxima fase (backlog)

Após este merge, item #3 (Termos de Uso + Política de Privacidade + Política de Cookies) vira o próximo bloqueador. Faz sentido emparelhar com este PR já que cobertura legal de cobrança recorrente exige cláusulas específicas em termos.
