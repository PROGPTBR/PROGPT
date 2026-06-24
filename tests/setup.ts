// Setup global de testes.
//
// Sub-projeto 36.1 — o gate de billing (cadastro de cartão) é ligado por padrão
// em produção (BILLING_ENFORCE !== '0'). Nos testes de rota que não exercitam o
// billing, desligamos o gate aqui pra não exigir mock de Supabase/assinatura em
// cada suite. A lógica de acesso (hasAccess/grandfather) tem teste dedicado em
// tests/lib/billing/access-gate.test.ts.
process.env.BILLING_ENFORCE = '0';
