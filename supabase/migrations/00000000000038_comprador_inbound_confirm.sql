-- Robô Comprador — guarda o código/link de confirmação de encaminhamento do
-- Gmail (forwarding-noreply@google.com) pra exibir ao usuário, já que esse
-- e-mail cai no alias (webhook) e não na caixa pessoal dele.
alter table comprador_settings add column if not exists inbound_confirm text;
