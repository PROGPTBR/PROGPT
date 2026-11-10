import {
  PRODUCT_NAME,
  COMPANY_NAME,
  COMPANY_CNPJ,
  LEGAL_CONTACT_EMAIL,
  LEGAL_CONTACT_PHONE,
} from '@/lib/legal/constants';
import { UPDATE_CATEGORY_LABELS, type UpdateCategory } from '@/lib/updates/types';
import { getAppUrl } from './client';

// Sub-projeto 30 — templates HTML inline pra emails transacionais.
//
// Inline porque (a) email clients são chatos com CSS externo, (b) zero
// deps novas (React Email seria 200KB+), (c) PT-BR plain.
// Estilos minimalistas: emails legíveis em dark e light mode.

const BRAND_COLOR = '#19c5f5';
const TEXT_PRIMARY = '#ffffff';
const TEXT_MUTED = '#b8c2d3';
const BG = '#08101f';
const BG_ACCENT = '#050b18';
const BG_PANEL = '#0d1829';
const BORDER_COLOR = '#14304d';
const LOGO_URL =
  'https://yxpxibmqdazyhpyohwqa.supabase.co/storage/v1/object/public/user-logos/progpt-logo-neon.png';

function shell(content: string, preheader: string): string {
  // `preheader` aparece na lista de inbox antes do user abrir.
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${PRODUCT_NAME}</title>
<style>
@media only screen and (max-width: 620px) {
  .email-outer { padding: 16px 10px !important; }
  .email-card { width: 100% !important; border-radius: 12px !important; }
  .email-header { padding: 30px 22px 16px !important; }
  .email-logo { width: 190px !important; max-width: 80% !important; }
  .email-content { padding: 22px !important; }
  .email-footer { padding: 22px !important; }
  .email-button { display: block !important; padding: 15px 20px !important; text-align: center !important; }
}
</style>
</head>
<body style="margin:0;padding:0;background:${BG_ACCENT};font-family:Arial,Helvetica,sans-serif;color:${TEXT_PRIMARY};">
<span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;font-size:1px;line-height:1px;color:${BG_ACCENT};">
${preheader}
</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BG_ACCENT};">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="email-outer" style="background:${BG_ACCENT};padding:40px 20px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="email-card" style="background:${BG};border:1px solid ${BORDER_COLOR};border-radius:16px;overflow:hidden;max-width:600px;width:100%;">
<tr><td align="center" class="email-header" style="padding:40px 30px 20px;">
<img src="${LOGO_URL}" alt="PROGPT" width="220" class="email-logo" style="display:block;border:0;max-width:100%;height:auto;" />
</td></tr>
<tr><td class="email-content" style="padding:24px 40px 40px;">
${content}
</td></tr>
<tr><td align="center" class="email-footer" style="padding:25px 40px;border-top:1px solid ${BORDER_COLOR};font-size:12px;color:#7d8aa1;line-height:1.8;">
<div>${COMPANY_NAME} · CNPJ ${COMPANY_CNPJ}</div>
<div>Dúvidas? <a href="mailto:${LEGAL_CONTACT_EMAIL}" style="color:${BRAND_COLOR};text-decoration:none;">${LEGAL_CONTACT_EMAIL}</a> · ${LEGAL_CONTACT_PHONE}</div>
</td></tr>
</table>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" class="email-button" style="display:inline-block;background:${BRAND_COLOR};color:#04111f;font-weight:700;text-decoration:none;padding:15px 32px;border-radius:999px;font-size:15px;line-height:20px;">${label}</a>`;
}

function p(text: string): string {
  return `<p style="font-size:16px;line-height:1.625;color:${TEXT_MUTED};margin:0 0 18px 0;">${text}</p>`;
}

function h(text: string): string {
  return `<h1 style="font-size:28px;line-height:1.25;font-weight:700;color:${TEXT_PRIMARY};margin:0 0 20px 0;text-align:center;">${text}</h1>`;
}

const MONO_FONT = "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace";

// Cartão estilo "status de sistema" (fundo escuro + mono) — mostra a conta
// (e-mail) de forma explícita, num visual mais "tech"/dashboard do que uma
// frase solta em prosa.
function accountCard(email: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BG_PANEL};border:1px solid ${BORDER_COLOR};border-radius:10px;margin:20px 0;">
<tr><td style="padding:16px 20px;">
<div style="color:#34d399;font-size:11px;font-family:${MONO_FONT};letter-spacing:0.08em;text-transform:uppercase;">● conta ativa</div>
<div style="color:#e5e7eb;font-size:13px;font-family:${MONO_FONT};margin-top:6px;word-break:break-all;">usuário: <span style="color:${BRAND_COLOR};">${email}</span></div>
</td></tr>
</table>`;
}

// ─── Aviso de nova atualização (somente prévia nesta etapa) ──────────────

export function buildUpdateAnnouncementEmail(args: {
  title: string;
  summary: string;
  slug: string;
  category: UpdateCategory;
}): { subject: string; html: string } {
  const title = args.title.trim().replace(/[\r\n]+/g, ' ');
  const summary = args.summary.trim();
  const categoryLabel = UPDATE_CATEGORY_LABELS[args.category].toLocaleUpperCase('pt-BR');
  const href = `${getAppUrl()}/atualizacoes#${encodeURIComponent(args.slug)}`;
  const content = `
<div style="margin:0 0 16px;text-align:center;color:${BRAND_COLOR};font-size:12px;line-height:18px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;white-space:normal;overflow-wrap:anywhere;">ATUALIZAÇÃO DO SISTEMA — ${categoryLabel}</div>
${h(esc(title))}
${p(esc(summary).replace(/\r?\n/g, '<br/>'))}
<div style="text-align:center;margin:24px 0 8px;">
${button(href, 'Ver atualização')}
</div>
`;

  return {
    subject: `Novidade no PROGPT: ${title}`,
    html: shell(content, esc(summary)),
  };
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
<div style="background:${BG_PANEL};border:1px solid ${BORDER_COLOR};border-radius:10px;padding:16px;margin:18px 0;font-size:14px;line-height:1.6;color:${TEXT_PRIMARY};">
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
<div style="background:#241b0b;border:1px solid #6b4c12;border-left:4px solid #f59e0b;border-radius:8px;padding:14px 16px;margin:18px 0;font-size:14px;line-height:1.6;color:#f8e8bd;">
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
<div style="background:${BG_PANEL};border:1px solid ${BORDER_COLOR};border-radius:10px;padding:16px;margin:18px 0;font-size:14px;line-height:1.6;color:${TEXT_PRIMARY};">
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
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BG_PANEL};border:1px solid ${BORDER_COLOR};border-radius:10px;margin:18px 0;padding:10px 16px;">${rows}</table>`;
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

// ─── Recebimento de NF (sub-projeto 95) ──────────────────────────────────
//
// Nomes, pedido e fornecedor vêm digitados pelo cliente: sempre escapados.

const RECEBIMENTO_PAPEL: Record<'fornecedor' | 'almoxarifado' | 'financeiro', { titulo: string; texto: string; botao: string }> = {
  fornecedor: {
    titulo: 'Anexe a nota fiscal deste pedido',
    texto: 'Quando emitir a nota de saída do material, anexe o XML (ou o PDF) pelo link abaixo. Se houver nota de entrega e nota de faturamento separadas, anexe as duas. Você não precisa criar conta.',
    botao: 'Anexar a nota',
  },
  almoxarifado: {
    titulo: 'Confira o recebimento deste pedido',
    texto: 'Quando o material chegar, abra o link, informe a quantidade recebida de cada item e registre qualquer ressalva. Com tudo entregue, é você quem dá o OK para o pagamento. Você não precisa criar conta.',
    botao: 'Conferir o recebimento',
  },
  financeiro: {
    titulo: 'Acompanhe a nota financeira deste pedido',
    texto: 'Pelo link você vê a nota financeira, a conferência dela contra o pedido (preço, impostos e NCM) e se o almoxarifado já liberou o pagamento. Você não precisa criar conta.',
    botao: 'Ver a nota financeira',
  },
};

export function buildRecebimentoLinkEmail(args: {
  papel: 'fornecedor' | 'almoxarifado' | 'financeiro';
  nome: string;
  compradorNome: string;
  pedido: string;
  fornecedor: string;
  link: string;
}): { subject: string; html: string } {
  const t = RECEBIMENTO_PAPEL[args.papel];
  const ola = args.nome.trim() ? `Olá, ${esc(args.nome.trim().split(/\s+/)[0]!)}` : 'Olá';
  const linhas: Array<[string, string]> = [
    ['Pedido', args.pedido],
    ['Fornecedor', args.fornecedor],
  ];
  if (args.compradorNome.trim()) linhas.push(['Comprador', args.compradorNome.trim()]);
  const content = `
${h(`${ola}. ${esc(t.titulo)}`)}
${quadro(linhas)}
${p(esc(t.texto))}
<div style="text-align:center;margin:24px 0;">
${button(args.link, t.botao)}
</div>
${p(`<span style="color:${TEXT_MUTED};font-size:12px;">Não encaminhe este e-mail: quem tiver o link pode agir neste pedido.</span>`)}
`;
  return { subject: `${t.titulo}: ${args.pedido}`, html: shell(content, esc(`${t.titulo}: ${args.pedido}.`)) };
}

export function buildRecebimentoAvisoEmail(args: {
  nome: string;
  assunto: string;
  titulo: string;
  texto: string;
  link: string;
  botao: string;
}): { subject: string; html: string } {
  const ola = args.nome.trim() ? `Olá, ${esc(args.nome.trim().split(/\s+/)[0]!)}` : 'Olá';
  const content = `
${h(`${ola}. ${esc(args.titulo)}`)}
${p(esc(args.texto))}
<div style="text-align:center;margin:24px 0;">
${button(args.link, args.botao)}
</div>
`;
  return { subject: args.assunto, html: shell(content, esc(args.titulo)) };
}
