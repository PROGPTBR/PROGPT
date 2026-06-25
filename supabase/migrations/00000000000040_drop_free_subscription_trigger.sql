-- Sub-projeto 36.1 — remove o auto-grant de acesso no cadastro.
--
-- Havia um trigger `on_auth_user_created_subscription` em auth.users que
-- inseria uma assinatura `plan='Free'`, `status='active'` com 3 dias e SEM
-- cartão a cada novo usuário. Isso liberava a plataforma sem cadastro de
-- cartão, contradizendo o modelo card-first (trial exige cartão no Asaas).
--
-- O trigger/função nunca esteve numa migration versionada (foi criado direto
-- no banco). Esta migration o remove de forma idempotente pra evitar que ele
-- ressurja ao reaplicar migrations. Novos usuários passam a ter acesso só via
-- assinatura/trial reais (hasAccess) — ver lib/billing/subscription.ts.
drop trigger if exists on_auth_user_created_subscription on auth.users;
drop function if exists public.create_free_subscription();

-- Limpa assinaturas "Free" auto-criadas (sem vínculo no Asaas) que existiam
-- antes da remoção. Assinaturas pagas reais (com asaas_subscription_id) ficam.
delete from public.subscriptions
where plan = 'Free' and asaas_subscription_id is null;
