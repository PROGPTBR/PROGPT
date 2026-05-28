import {
  PRODUCT_NAME,
  COMPANY_NAME,
  COMPANY_CNPJ,
  LEGAL_CONTACT_EMAIL,
  LEGAL_CONTACT_PHONE,
} from '@/lib/legal/constants';
import { getAppUrl } from './client';

// Sub-projeto 30 — templates HTML inline pra emails transacionais.
//
// Inline porque (a) email clients são chatos com CSS externo, (b) zero
// deps novas (React Email seria 200KB+), (c) PT-BR plain.
// Estilos minimalistas: emails legíveis em dark e light mode.

const BRAND_COLOR = '#0ed1e0';
const TEXT_PRIMARY = '#0d0d0d';
const TEXT_MUTED = '#6b7280';
const BG = '#ffffff';
const BG_ACCENT = '#f3f4f6';

function shell(content: string, preheader: string): string {
  // `preheader` aparece na lista de inbox antes do user abrir.
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${PRODUCT_NAME}</title>
</head>
<body style="margin:0;padding:0;background:${BG_ACCENT};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:${TEXT_PRIMARY};">
<span style="display:none;visibility:hidden;opacity:0;height:0;width:0;font-size:0;">
${preheader}
</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BG_ACCENT};padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="background:${BG};border-radius:12px;overflow:hidden;max-width:560px;width:100%;">
<tr><td style="padding:32px 32px 24px;border-bottom:1px solid #e5e7eb;">
<div style="font-size:24px;font-weight:600;color:${TEXT_PRIMARY};">PROGPT<span style="color:${BRAND_COLOR};">.</span></div>
<div style="font-size:12px;color:${TEXT_MUTED};margin-top:4px;">uma plataforma 2B Supply</div>
</td></tr>
<tr><td style="padding:32px;">
${content}
</td></tr>
<tr><td style="padding:24px 32px;background:${BG_ACCENT};border-top:1px solid #e5e7eb;font-size:11px;color:${TEXT_MUTED};line-height:1.6;">
${COMPANY_NAME} · CNPJ ${COMPANY_CNPJ}<br/>
Dúvidas? <a href="mailto:${LEGAL_CONTACT_EMAIL}" style="color:${BRAND_COLOR};text-decoration:none;">${LEGAL_CONTACT_EMAIL}</a> · ${LEGAL_CONTACT_PHONE}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:${BRAND_COLOR};color:${TEXT_PRIMARY};font-weight:600;text-decoration:none;padding:12px 24px;border-radius:9999px;font-size:14px;">${label}</a>`;
}

function p(text: string): string {
  return `<p style="font-size:14px;line-height:1.6;color:${TEXT_PRIMARY};margin:0 0 16px 0;">${text}</p>`;
}

function h(text: string): string {
  return `<h1 style="font-size:20px;font-weight:600;color:${TEXT_PRIMARY};margin:0 0 16px 0;">${text}</h1>`;
}

// ─── 1. Welcome (pós primeira entrada confirmada) ────────────────────────

export function buildWelcomeEmail(args: { email: string }): {
  subject: string;
  html: string;
} {
  const subject = 'Bem-vindo ao PROGPT';
  const content = `
${h(`Bem-vindo, ${args.email.split('@')[0]} 👋`)}
${p('Sua conta no PROGPT está pronta. Você já pode usar o chat ilimitadamente e tem 1 execução grátis de cada um dos 7 assistentes (lifetime) — RFP, Kraljic, Porter, ABC, Negociação, Análise Financeira e Perfil de Categoria.')}
${p('Comece pelo chat — pergunte como faria pra um colega sênior. Ou vá direto pra um assistente se quiser um artefato pronto em .docx/.xlsx.')}
<div style="text-align:center;margin:24px 0;">
${button(`${getAppUrl()}/chat`, 'Abrir PROGPT')}
</div>
${p(`Precisa de ajuda? Responda este email ou escreva pra <a href="mailto:${LEGAL_CONTACT_EMAIL}" style="color:${BRAND_COLOR};">${LEGAL_CONTACT_EMAIL}</a>.`)}
`;
  return { subject, html: shell(content, 'Sua conta no PROGPT está pronta.') };
}

// ─── 2. Recibo de pagamento (pós PAYMENT_CONFIRMED) ──────────────────────

export function buildPaymentConfirmedEmail(args: {
  email: string;
  amountBrl: number;
  nextDueDate: string;
}): {
  subject: string;
  html: string;
} {
  const amount = args.amountBrl.toFixed(2).replace('.', ',');
  const subject = `Pagamento confirmado — R$ ${amount}`;
  const content = `
${h('Pagamento recebido com sucesso ✅')}
${p(`Obrigado! Confirmamos o recebimento de <strong>R$ ${amount}</strong> referente à sua assinatura Pro do PROGPT.`)}
<div style="background:${BG_ACCENT};border-radius:8px;padding:16px;margin:16px 0;font-size:13px;color:${TEXT_PRIMARY};">
<div><strong>Plano:</strong> Pro · R$ ${amount}/mês</div>
<div style="margin-top:4px;"><strong>Próxima cobrança:</strong> ${args.nextDueDate}</div>
</div>
${p('Você tem acesso ilimitado aos 7 assistentes durante todo o ciclo. A nota fiscal será emitida pela Asaas (nosso processador de pagamento) e enviada separadamente.')}
<div style="text-align:center;margin:24px 0;">
${button(`${getAppUrl()}/account/billing`, 'Ver assinatura')}
</div>
`;
  return { subject, html: shell(content, `R$ ${amount} confirmado · próxima em ${args.nextDueDate}`) };
}

// ─── 3. Cobrança em atraso (pós PAYMENT_OVERDUE) ─────────────────────────

export function buildPaymentOverdueEmail(args: {
  email: string;
  accessUntil: string;
}): {
  subject: string;
  html: string;
} {
  const subject = 'Atualize seu pagamento — PROGPT';
  const content = `
${h('Não conseguimos cobrar sua assinatura ⚠️')}
${p('Tentamos processar a cobrança mensal da sua assinatura Pro mas não foi possível — pode ser cartão recusado, limite excedido ou problema com Pix.')}
<div style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:4px;padding:12px 16px;margin:16px 0;font-size:13px;color:${TEXT_PRIMARY};">
Você mantém acesso Pro até <strong>${args.accessUntil}</strong>. Após essa data, sua conta volta pro plano Free se o pagamento não for resolvido.
</div>
${p('Pra resolver: acesse sua assinatura e atualize o método de pagamento. Se foi falha do cartão, geralmente uma nova tentativa em 24-48h resolve.')}
<div style="text-align:center;margin:24px 0;">
${button(`${getAppUrl()}/account/billing`, 'Atualizar pagamento')}
</div>
${p(`Precisa de ajuda? Responda este email ou escreva pra <a href="mailto:${LEGAL_CONTACT_EMAIL}" style="color:${BRAND_COLOR};">${LEGAL_CONTACT_EMAIL}</a>.`)}
`;
  return {
    subject,
    html: shell(content, `Sua próxima cobrança falhou. Acesso até ${args.accessUntil}.`),
  };
}

// ─── 4. Confirmação de cancelamento (pós POST /api/billing/cancel) ───────

export function buildSubscriptionCancelledEmail(args: {
  email: string;
  accessUntil: string;
}): {
  subject: string;
  html: string;
} {
  const subject = 'Assinatura cancelada — acesso até ' + args.accessUntil;
  const content = `
${h('Cancelamento confirmado')}
${p('Confirmamos o cancelamento da sua assinatura Pro do PROGPT. Pena perder você 😢')}
<div style="background:${BG_ACCENT};border-radius:8px;padding:16px;margin:16px 0;font-size:13px;color:${TEXT_PRIMARY};">
<strong>Acesso Pro até:</strong> ${args.accessUntil}<br/>
<span style="color:${TEXT_MUTED};font-size:12px;">Depois dessa data, sua conta volta pro plano Free (chat ilimitado, mas sem assistentes adicionais).</span>
</div>
${p('Mudou de ideia? Você pode reativar a assinatura a qualquer momento — basta retornar ao painel de billing.')}
<div style="text-align:center;margin:24px 0;">
${button(`${getAppUrl()}/pricing`, 'Reativar Pro')}
</div>
${p(`Se quiser nos contar por que cancelou, responda este email — feedback ajuda muito a melhorar o produto.`)}
`;
  return {
    subject,
    html: shell(content, `Acesso até ${args.accessUntil}. Reative quando quiser.`),
  };
}
