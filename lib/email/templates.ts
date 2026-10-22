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
<div style="font-size:12px;color:${TEXT_MUTED};margin-top:4px;">uma plataforma 2BSUPPLY</div>
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

const MONO_FONT = "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace";

// Cartão estilo "status de sistema" (fundo escuro + mono) — mostra a conta
// (e-mail) de forma explícita, num visual mais "tech"/dashboard do que uma
// frase solta em prosa.
function accountCard(email: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0b0f19;border-radius:10px;margin:20px 0;">
<tr><td style="padding:16px 20px;">
<div style="color:#34d399;font-size:11px;font-family:${MONO_FONT};letter-spacing:0.08em;text-transform:uppercase;">● conta ativa</div>
<div style="color:#e5e7eb;font-size:13px;font-family:${MONO_FONT};margin-top:6px;word-break:break-all;">usuário: <span style="color:${BRAND_COLOR};">${email}</span></div>
</td></tr>
</table>`;
}

// ─── 1. Welcome (pós primeira entrada confirmada) ────────────────────────

export function buildWelcomeEmail(args: { email: string; magicLink?: string | null }): {
  subject: string;
  html: string;
} {
  const subject = 'Bem-vindo ao PROGPT';
  // Com magic link: CTA principal já entra logado, sem digitar nada — "compra
  // assertiva, sem burocracia". Sem magic link (geração falhou — fail-soft),
  // cai no botão antigo pro /chat (login normal se a sessão já expirou).
  const primaryHref = args.magicLink ?? `${getAppUrl()}/chat`;
  const primaryLabel = args.magicLink ? 'Entrar automaticamente' : 'Abrir PROGPT';
  const content = `
${h(`Bem-vindo, ${args.email.split('@')[0]} 👋`)}
${p('Sua conta no PROGPT está pronta. Você já pode usar o chat ilimitadamente e tem 1 execução grátis de cada uma das dezenas de assistentes (lifetime) — RFP, Kraljic, Porter, ABC, Negociação, Análise Financeira e Perfil de Categoria.')}
${accountCard(args.email)}
${p('Comece pelo chat — pergunte como faria pra um colega sênior. Ou vá direto pra um assistente se quiser um artefato pronto em .docx/.xlsx.')}
<div style="text-align:center;margin:24px 0;">
${button(primaryHref, primaryLabel)}
</div>
${p(`Prefere entrar com e-mail e senha? <a href="${getAppUrl()}/login" style="color:${BRAND_COLOR};">Acesse o login</a> · Esqueceu ou ainda não tem uma senha? <a href="${getAppUrl()}/forgot-password" style="color:${BRAND_COLOR};">Redefinir senha</a>.`)}
${p(`Precisa de ajuda? Responda este email ou escreva pra <a href="mailto:${LEGAL_CONTACT_EMAIL}" style="color:${BRAND_COLOR};">${LEGAL_CONTACT_EMAIL}</a>.`)}
`;
  return { subject, html: shell(content, 'Sua conta no PROGPT está pronta.') };
}

// ─── 1b. Definir senha (onboarding card-first, pós cartão) ───────────────

export function buildSetPasswordEmail(args: { name: string; link: string }): {
  subject: string;
  html: string;
} {
  const first = (args.name || '').trim().split(/\s+/)[0] || 'Olá';
  const subject = 'Cartão cadastrado — defina sua senha e acesse o PROGPT';
  const content = `
${h(`Tudo certo, ${first}! 🎉`)}
${p('Seu cartão foi cadastrado com sucesso e seus <strong>3 dias grátis</strong> já estão liberados — sem nenhuma cobrança agora.')}
${p('Falta só um passo: defina sua senha para acessar a plataforma.')}
<div style="text-align:center;margin:24px 0;">
${button(args.link, 'Definir senha e acessar')}
</div>
${p('Por segurança, este link expira em 1 hora. Se expirar, use "Esqueci minha senha" na tela de login que reenviamos.')}
${p(`Qualquer dúvida, responda este email ou escreva pra <a href="mailto:${LEGAL_CONTACT_EMAIL}" style="color:${BRAND_COLOR};">${LEGAL_CONTACT_EMAIL}</a>.`)}
`;
  return { subject, html: shell(content, 'Cartão cadastrado. Defina sua senha para acessar.') };
}

// ─── 1c. Convite de licença (assinatura multi-usuário, sub-projeto 64) ───

export function buildSeatInviteEmail(args: {
  inviterName: string | null;
  inviterEmail: string | null;
  link: string;
}): { subject: string; html: string } {
  const who =
    (args.inviterName || '').trim() ||
    (args.inviterEmail || '').trim() ||
    'Alguém da sua empresa';

  const subject = `${who} liberou seu acesso ao PROGPT`;

  const content = `
${h('Seu acesso ao PROGPT está pronto 🎉')}
${p(`<strong>${who}</strong> contratou o PROGPT para a equipe e reservou um acesso para você.`)}
${p('Você terá sua própria conta — com login, histórico de conversas e assistentes separados. O pagamento é da assinatura da empresa; você não precisa cadastrar cartão.')}
<div style="text-align:center;margin:24px 0;">
${button(args.link, 'Criar minha senha e entrar')}
</div>
${p('Se você já tem conta no PROGPT com este e-mail, o acesso é vinculado automaticamente — é só entrar normalmente depois de abrir o link.')}
${p(`Dúvidas? Responda este email ou escreva pra <a href="mailto:${LEGAL_CONTACT_EMAIL}" style="color:${BRAND_COLOR};">${LEGAL_CONTACT_EMAIL}</a>.`)}
`;

  return { subject, html: shell(content, `${who} reservou um acesso ao PROGPT para você.`) };
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
${p('Você tem acesso ilimitado às dezenas de assistentes durante todo o ciclo. A nota fiscal será emitida pela Asaas (nosso processador de pagamento) e enviada separadamente.')}
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

// ─── Fluxo de Compras: acompanhamento e aprovação (sub-projeto 90) ───────
//
// Título da compra, nomes e comentários vêm digitados pelo cliente: sempre
// escapados antes de entrar no HTML.

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function quadro(linhas: Array<[string, string]>): string {
  const rows = linhas
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 0;font-size:12px;color:${TEXT_MUTED};width:40%;vertical-align:top;">${esc(k)}</td><td style="padding:6px 0;font-size:14px;color:${TEXT_PRIMARY};">${esc(v)}</td></tr>`,
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BG_ACCENT};border-radius:10px;margin:16px 0;padding:8px 16px;">${rows}</table>`;
}

/** Para o gestor: pedido de aprovação com o link seguro (sem conta). */
export function buildFluxoAprovacaoEmail(args: {
  aprovadorNome: string;
  compradorNome: string;
  tituloCompra: string;
  etapaLabel: string;
  resumo: string;
  link: string;
  expiraEm: string;
}): { subject: string; html: string } {
  const quem = args.compradorNome.trim() || 'O comprador';
  const subject = `Aprovação pedida: ${args.tituloCompra}`;
  const ola = args.aprovadorNome.trim() ? `Olá, ${esc(args.aprovadorNome.trim().split(/\s+/)[0]!)}` : 'Olá';
  const content = `
${h(`${ola}, sua aprovação é necessária`)}
${p(`<strong>${esc(quem)}</strong> pediu a sua aprovação nesta compra, pelo PROGPT.`)}
${quadro([
  ['Compra', args.tituloCompra],
  ['Etapa', args.etapaLabel],
  ['Resumo', args.resumo],
])}
${p('Abra o link para ver os detalhes e aprovar ou reprovar. Você não precisa criar conta.')}
<div style="text-align:center;margin:24px 0;">
${button(args.link, 'Ver e decidir')}
</div>
${p(`<span style="color:${TEXT_MUTED};font-size:12px;">O link vale até ${esc(args.expiraEm)} e só pode ser usado uma vez. Não encaminhe este e-mail: quem abrir o link pode decidir em seu nome.</span>`)}
`;
  return { subject, html: shell(content, esc(`${quem} pediu a sua aprovação: ${args.tituloCompra}.`)) };
}

/** Para quem pediu a compra: link de acompanhamento ou aviso de etapa. */
export function buildFluxoAndamentoEmail(args: {
  solicitanteNome: string;
  tituloCompra: string;
  link: string;
  /** Sem etapa: é o primeiro envio do link. */
  etapaConcluida?: string | null;
  proximaEtapa?: string | null;
  concluido?: boolean;
}): { subject: string; html: string } {
  const ola = args.solicitanteNome.trim() ? `Olá, ${esc(args.solicitanteNome.trim().split(/\s+/)[0]!)}` : 'Olá';
  let subject: string;
  let titulo: string;
  let corpo: string;

  if (args.concluido) {
    subject = `Compra concluída: ${args.tituloCompra}`;
    titulo = 'Sua compra foi concluída';
    corpo = 'Todas as etapas foram finalizadas, incluindo o recebimento.';
  } else if (args.etapaConcluida) {
    subject = `Sua compra avançou: ${args.tituloCompra}`;
    titulo = 'Sua compra avançou de etapa';
    corpo = `A etapa <strong>${esc(args.etapaConcluida)}</strong> foi concluída.${
      args.proximaEtapa ? ` Agora está em <strong>${esc(args.proximaEtapa)}</strong>.` : ''
    }`;
  } else {
    subject = `Acompanhe sua compra: ${args.tituloCompra}`;
    titulo = 'Acompanhe o seu pedido de compra';
    corpo = 'O seu pedido entrou no processo de compras. Pelo link abaixo você vê em que etapa ele está, a qualquer hora, sem precisar perguntar a ninguém.';
  }

  const content = `
${h(`${ola}. ${titulo}`)}
${quadro([['Compra', args.tituloCompra]])}
${p(corpo)}
<div style="text-align:center;margin:24px 0;">
${button(args.link, 'Como está meu pedido?')}
</div>
${p(`<span style="color:${TEXT_MUTED};font-size:12px;">Você recebe um aviso a cada etapa concluída. O link mostra só o andamento, sem preços nem propostas.</span>`)}
`;
  return { subject, html: shell(content, esc(`${titulo}: ${args.tituloCompra}.`)) };
}

/** Para o comprador: o gestor decidiu pelo e-mail. */
export function buildFluxoDecisaoGestorEmail(args: {
  aprovadorNome: string;
  aprovadorEmail: string;
  tituloCompra: string;
  etapaLabel: string;
  aprovado: boolean;
  comentario: string;
  link: string;
}): { subject: string; html: string } {
  const quem = args.aprovadorNome.trim() || args.aprovadorEmail;
  const subject = `${args.aprovado ? 'Aprovado' : 'Reprovado'} por ${quem}: ${args.tituloCompra}`;
  const linhas: Array<[string, string]> = [
    ['Compra', args.tituloCompra],
    ['Etapa', args.etapaLabel],
    ['Decisão', args.aprovado ? 'Aprovado' : 'Reprovado'],
  ];
  if (args.comentario.trim()) linhas.push(['Comentário', args.comentario.trim()]);
  const content = `
${h(args.aprovado ? 'O gestor aprovou' : 'O gestor reprovou')}
${p(`<strong>${esc(quem)}</strong> ${args.aprovado ? 'aprovou' : 'reprovou'} a etapa pelo link do e-mail.`)}
${quadro(linhas)}
${p(
  args.aprovado
    ? 'A compra já seguiu para a próxima etapa no PROGPT.'
    : 'A etapa voltou para ajuste com o motivo acima. Rode a etapa de novo para a IA refazer.',
)}
<div style="text-align:center;margin:24px 0;">
${button(args.link, 'Abrir o processo')}
</div>
`;
  return { subject, html: shell(content, esc(`${quem} ${args.aprovado ? 'aprovou' : 'reprovou'}: ${args.tituloCompra}.`)) };
}
