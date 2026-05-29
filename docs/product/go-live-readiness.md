# PROGPT — Checklist de prontidão para go-live (B2C público pagante)

> Criado 2026-05-28 a partir de uma auditoria de prontidão (operacional, billing,
> segurança/LGPD) sobre o estado pós-sub-projeto 30. Fonte única da verdade do que
> falta pra abrir o paywall pro público geral. Atualizar conforme itens fecharem.
>
> **Legenda:** ✅ feito · 🔜 código pronto, falta setup externo · ⬜ a fazer

## Resumo executivo

Fundação é grau-de-produção: `typecheck` limpo, suíte vitest verde (828 testes),
auth gating consistente, owner-scoping sem IDOR, admin com 404-masking, validação de
upload, RLS endurecido, delete LGPD em cascata. **Segurança não é o gargalo.**

O que trava o go-live se agrupa em **dinheiro** e **cegueira operacional**, não em
segurança. Recomendação: não abrir o paywall pro público até fechar os 🔴 blockers.

---

## 🔴 Blockers (perda de dinheiro, cobrança indevida, ou operar às cegas)

| # | Item | Status | Nota |
|---|------|--------|------|
| 1 | **Account delete não cancelava a subscription no Asaas** | ✅ PR #84 | Cobrava cartão de conta deletada (chargeback + LGPD). Agora cancela no Asaas antes do `deleteUser`; 502 em erro real do provedor, 404 segue. |
| 2 | **`ASAAS_API_URL` caía no sandbox default** | ✅ PR #84 | Em prod, pagamentos reais iriam pro sandbox (receita zero, falha invisível). `getConfig` fail-fast quando `APP_ENV=production`. |
| 3 | **Sem error monitoring (Sentry/Rollbar)** | ⬜ adiado | Todo erro de prod só vira `console.error` no stdout do Railway. No dia do launch, um 500 no checkout/chat é invisível. Adiado junto com os setups externos (precisa conta + DSN). Decisão de abordagem pendente (SDK completo vs. wrapper leve). |
| 4 | **Emails transacionais + captcha não estão de fato ativos** | 🔜 | Resend sem API key (sandbox só entrega pro próprio inbox); Turnstile cai na test key que **sempre passa** (captcha é teatro). Ambos travados na compra do `2bsupply.com.br` + verificação DNS. Ver [b2c_pending_envs](../../). |

---

## 🟡 Should-fix (antes ou logo após o launch)

| # | Item | Evidência | Direção |
|---|------|-----------|---------|
| 5 | **Webhook Asaas dropava evento desconhecido em silêncio** | ✅ PR #86 | Evento fora dos buckets handled + fora da lista de benignos agora vira `console.warn` + campo `unhandled` (visível no Railway / Sentry quando ligado). Restante (cron varrendo `processed_at IS NULL` > 1h pra alertar 500s persistentes) fica pra quando houver alerting de verdade (Sentry, #3). |
| 6 | **Turn-leak no assistente de negociação** | decisão de produto | Investigado (2026-05-29): adicionar `canUseAssistant` nos turnos é **errado** — bloquearia o free de usar o simulador na própria run a que tem direito (count já é 1). Endpoints já têm auth + rate limit + owner check. Risco residual = muitos turnos numa run free ao longo do tempo; remédio correto = **cap de turnos por run free** (qual número?), não paywall. Aguarda decisão. |
| 7 | **Supabase no free tier → sem backup automático** | infra | Aceitar pagante num DB sem PITR é risco. Subir pro plano Pro ($25/mês) antes do primeiro signup pagante. |
| 8 | **Sem analytics de produto / funil de conversão** | — | Zero PostHog/GA. Launch sem visibilidade de signup→ativação→pago — exatamente o dado pra melhorar conversão. |
| 9 | **Cnae-search sem rate limit** | ✅ PR #88 | Agora tem `checkChatRateLimit` (429 + retry) espelhando `/suppliers/search` + cap de 100 chars na query. |

---

## 💡 Ideias de melhoria (crescimento & polish, pós-blocker)

- **Transparência de quota**: free só descobre o paywall depois do 402. Mostrar
  "1/1 execução usada" upfront — `getAssistantQuotaUsed()` já existe, falta expor.
- **Reativação 1-clique** em `/account/billing` pra cancelados (hoje refazem o checkout inteiro).
- **Onboarding** após o primeiro login — os 8 assistentes são muita superfície; guiar a 1ª execução.
- **Guardrails de custo** nos vetores novos de gasto: `/api/transcribe` (Whisper) e
  `/api/chat/attachments` (PDF multimodal) bufferizam o arquivo inteiro antes de medir — vetor barato de abuso.
- **CLAUDE.md está desatualizado**: para no sub-projeto 30, mas já foram entregues 8
  assistentes, suppliers/CNAE, transcrição, attachments e perfis de empresa. Vale um
  pass de doc pra o registro do projeto bater com a realidade.

---

## Setup externo gated no usuário (não-código)

| Item | Bloqueador | Onde |
|------|-----------|------|
| Domínio `2bsupply.com.br` | Comprar — destrava Resend (DNS SPF/DKIM/DMARC) + custom URL | Registro.br/Cloudflare |
| Resend (`RESEND_API_KEY`, `EMAIL_FROM`) | Conta + domínio verificado | resend.com |
| Turnstile (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`) | Conta Cloudflare → Turnstile | cloudflare.com |
| Sentry (DSN) | Conta + decisão de abordagem (#3) | sentry.io |
| Supabase Pro | Upgrade de plano (#7) | dashboard Supabase |
| Asaas prod (`ASAAS_API_URL`=www, API key prod, webhook token) | Conta prod + registrar webhook | asaas.com |

---

## Gate de launch recomendado

**Não abrir o paywall pro público** até #1–#4 fecharem. #1 e #2 ✅. Restam:
- #3 (Sentry) — decisão + ~1-2h de código quando aprovado
- #4 (Resend + Turnstile) — majoritariamente setup externo (comprar domínio → DNS → env)

#5–#9 podem ir logo após o launch, mas #7 (backup) idealmente antes do 1º pagante.
