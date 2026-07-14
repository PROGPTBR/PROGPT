// Rota alternativa do webhook Asaas. Historicamente era um stub que só logava
// o body (PII) e respondia {received:true} SEM validar token nem persistir —
// se o painel Asaas apontasse pra cá, a assinatura nunca atualizava (trial
// nunca virava ativo).
//
// Agora delega 100% pro handler real (`/api/billing/webhook/asaas`), que valida
// `asaas-access-token`, é idempotente e é a fonte de verdade do estado da
// subscription. Assim funciona independente de qual das duas URLs esteja
// configurada no painel do Asaas. Ideal: manter só uma URL no painel; esta
// existe como rede de segurança.
export { POST, runtime, dynamic } from '@/app/api/billing/webhook/asaas/route';
