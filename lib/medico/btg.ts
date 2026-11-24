import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';

import { getServerSupabase } from '@/lib/db/supabase';

import { etapaDe } from './conciliacao';
import { sugerirPagamentos, type Credito } from './extrato';
import { carregarEstado } from './service';

// Ligação com o BTG Empresas (sub-projeto 102). Server-only. Escrito em cima
// da documentação oficial (developers.empresas.btgpactual.com, lida em
// 2026-11-24):
//  - autorização: GET https://id.btgpactual.com/oauth2/authorize (Authorization
//    Code), troca em POST /oauth2/token com Basic client_id:client_secret;
//  - access token vale 24 h; refresh token vale 10 dias e renova a cada uso;
//  - escopos: openid + empresas.btgpactual.com/accounts.readonly (saldo,
//    extrato e recebimento de webhooks). É só LEITURA: o sistema não
//    movimenta a conta;
//  - webhook: POST com Authorization: Bearer <segredo do webhook>, corpo
//    { webhookId, event, data }, eventos transactions.credit / .debit;
//  - o banco só manda eventos de contas que passaram por um fluxo de token,
//    então o refresh token é renovado todo dia para o consentimento não cair.

const HOST_ID = 'https://id.btgpactual.com';
export const ESCOPOS_BTG = 'openid empresas.btgpactual.com/accounts.readonly';

export function btgConfigurado(): boolean {
  return !!(process.env.BTG_CLIENT_ID && process.env.BTG_CLIENT_SECRET && process.env.BTG_WEBHOOK_SECRET);
}

export function redirectUri(): string {
  return process.env.BTG_REDIRECT_URI?.trim() || 'https://2bsupply.ia.br/api/medico/btg/callback';
}

function segredo(uso: string): Buffer {
  const base = process.env.APP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!base) throw new Error('APP_SECRET ausente');
  return createHash('sha256').update(`${base}:area-medica:btg:${uso}`).digest();
}

// --- cifra do refresh token ------------------------------------------------

export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', segredo('token'), iv);
  const dados = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), dados].map((b) => b.toString('base64url')).join('.');
}

export function decifrar(cifrado: string): string {
  const [iv, tag, dados] = cifrado.split('.').map((p) => Buffer.from(p, 'base64url'));
  const d = createDecipheriv('aes-256-gcm', segredo('token'), iv!);
  d.setAuthTag(tag!);
  return Buffer.concat([d.update(dados!), d.final()]).toString('utf8');
}

// --- state do OAuth: quem pediu e para qual CNPJ, assinado, com validade ---

const VALIDADE_STATE_MS = 15 * 60 * 1000;

export function criarState(userId: string, cnpj: string, agora = Date.now()): string {
  const corpo = Buffer.from(JSON.stringify({ u: userId, c: cnpj, e: agora + VALIDADE_STATE_MS, n: randomBytes(8).toString('hex') })).toString('base64url');
  const assinatura = createHmac('sha256', segredo('state')).update(corpo).digest('base64url');
  return `${corpo}.${assinatura}`;
}

export function lerState(state: string | null, agora = Date.now()): { userId: string; cnpj: string } | null {
  const [corpo, assinatura] = (state ?? '').split('.');
  if (!corpo || !assinatura) return null;
  const esperada = createHmac('sha256', segredo('state')).update(corpo).digest('base64url');
  if (assinatura.length !== esperada.length || !timingSafeEqual(Buffer.from(assinatura), Buffer.from(esperada))) return null;
  try {
    const d = JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8')) as { u: string; c: string; e: number };
    return d.e > agora && /^\d{14}$/.test(d.c) ? { userId: d.u, cnpj: d.c } : null;
  } catch {
    return null;
  }
}

/** CNPJ só com dígitos e dígitos verificadores certos, ou null. */
export function cnpjLimpo(v: string): string | null {
  const d = (v ?? '').replace(/\D/g, '');
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return null;
  const dv = (base: string) => {
    let peso = base.length - 7;
    let soma = 0;
    for (const ch of base) {
      soma += Number(ch) * peso;
      peso = peso === 2 ? 9 : peso - 1;
    }
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(d.slice(0, 12));
  return d1 === Number(d[12]) && dv(d.slice(0, 12) + d1) === Number(d[13]) ? d : null;
}

export function urlDeAutorizacao(state: string): string {
  const q = new URLSearchParams({
    client_id: process.env.BTG_CLIENT_ID ?? '',
    response_type: 'code',
    redirect_uri: redirectUri(),
    scope: ESCOPOS_BTG,
    prompt: 'login',
    state,
  });
  return `${HOST_ID}/oauth2/authorize?${q.toString()}`;
}

type Tokens = { access_token: string; refresh_token?: string; id_token?: string };

async function pedirToken(corpo: Record<string, string>): Promise<Tokens> {
  const basic = Buffer.from(`${process.env.BTG_CLIENT_ID}:${process.env.BTG_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${HOST_ID}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${basic}` },
    body: new URLSearchParams(corpo).toString(),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`BTG token ${res.status}`);
  return (await res.json()) as Tokens;
}

/** CNPJs que aparecem nas declarações de um JWT (sem validar assinatura: é só conferência do que o próprio banco devolveu). */
export function cnpjsDoJwt(jwt: string | undefined): string[] {
  try {
    const claims = Buffer.from((jwt ?? '').split('.')[1] ?? '', 'base64url').toString('utf8');
    return [...new Set(claims.match(/\d{14}/g) ?? [])].filter((c) => cnpjLimpo(c));
  } catch {
    return [];
  }
}

export class BtgErro extends Error {}

/** Conclui a autorização: troca o código, confere o CNPJ e guarda o refresh token cifrado. */
export async function concluirConexao(userId: string, cnpj: string, code: string): Promise<void> {
  const t = await pedirToken({ code, redirect_uri: redirectUri(), grant_type: 'authorization_code' });
  if (!t.refresh_token) throw new BtgErro('O BTG não devolveu a autorização de renovação.');

  // Se o banco informa as empresas do login, a conta digitada precisa ser uma delas.
  const doToken = [...cnpjsDoJwt(t.id_token), ...cnpjsDoJwt(t.access_token)];
  if (doToken.length > 0 && !doToken.includes(cnpj)) {
    throw new BtgErro('O CNPJ informado não é o da conta autorizada no BTG.');
  }

  const db = getServerSupabase();
  const { data: outro } = await db.from('medico_banco').select('user_id').eq('cnpj', cnpj).neq('user_id', userId).maybeSingle();
  if (outro) throw new BtgErro('Esse CNPJ já está ligado a outra conta da Área Médica.');
  const { error } = await db.from('medico_banco').upsert({
    user_id: userId,
    banco: 'btg',
    cnpj,
    refresh_token_cifrado: cifrar(t.refresh_token),
    renovado_em: new Date().toISOString(),
    conectado_em: new Date().toISOString(),
    erro: '',
  });
  if (error) throw new Error(`[medico/btg] gravar conexão falhou: ${error.message}`);
}

export async function desconectarBanco(userId: string): Promise<void> {
  await getServerSupabase().from('medico_banco').delete().eq('user_id', userId);
}

/** Renova os refresh tokens que não são renovados há mais de 20 h (valem 10 dias). */
export async function renovarConexoes(): Promise<{ renovadas: number; falhas: number }> {
  if (!btgConfigurado()) return { renovadas: 0, falhas: 0 };
  const db = getServerSupabase();
  const limite = new Date(Date.now() - 20 * 3600 * 1000).toISOString();
  const { data } = await db.from('medico_banco').select('user_id, refresh_token_cifrado').lt('renovado_em', limite).eq('erro', '').limit(200);
  let renovadas = 0;
  let falhas = 0;
  for (const linha of data ?? []) {
    try {
      const t = await pedirToken({ grant_type: 'refresh_token', refresh_token: decifrar(linha.refresh_token_cifrado as string) });
      await db
        .from('medico_banco')
        .update({ renovado_em: new Date().toISOString(), ...(t.refresh_token ? { refresh_token_cifrado: cifrar(t.refresh_token) } : {}) })
        .eq('user_id', linha.user_id);
      renovadas += 1;
    } catch (err) {
      falhas += 1;
      const mensagem = err instanceof Error ? err.message : 'erro';
      // 400/401 = autorização caiu de vez; o resto pode ser instabilidade e tenta de novo.
      if (/BTG token 4\d\d/.test(mensagem)) await db.from('medico_banco').update({ erro: 'A autorização do BTG expirou. Conecte de novo.' }).eq('user_id', linha.user_id);
      console.error('[medico/btg] renovação falhou:', mensagem);
    }
  }
  return { renovadas, falhas };
}

// --- webhook ---------------------------------------------------------------

export function segredoDoWebhookConfere(authorization: string | null): boolean {
  const esperado = `Bearer ${process.env.BTG_WEBHOOK_SECRET ?? ''}`;
  if (!process.env.BTG_WEBHOOK_SECRET || !authorization || authorization.length !== esperado.length) return false;
  return timingSafeEqual(Buffer.from(authorization), Buffer.from(esperado));
}

export type Movimento = {
  cnpj: string;
  transacao_id: string;
  data: string;
  sentido: 'entrada' | 'saida';
  valor: number;
  forma: string;
  descricao: string;
  contraparte: string;
};

/** Um evento transactions.credit / transactions.debit do BTG → movimento. Null para os outros eventos. */
export function movimentoDoEvento(corpo: unknown): Movimento | null {
  const c = corpo as { event?: string; data?: Record<string, unknown> } | null;
  const d = c?.data;
  if (!d || (c?.event !== 'transactions.credit' && c?.event !== 'transactions.debit')) return null;
  const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  // accountId começa com o CNPJ ("25257331000132-208-50-003633854"); na agência 1 vem também taxId.
  const cnpj = s(d.taxId).replace(/\D/g, '') || s(d.accountId).split('-')[0]!.replace(/\D/g, '');
  const valor = Number(d.amount);
  const id = s(d.transactionId) || String(d.transactionId ?? '');
  const data = new Date(s(d.date));
  if (cnpj.length !== 14 || !id || !Number.isFinite(valor) || valor < 0 || Number.isNaN(data.getTime())) return null;
  const parte = (d.relatedParty ?? {}) as Record<string, unknown>;
  return {
    cnpj,
    transacao_id: id.slice(0, 120),
    data: data.toISOString(),
    // O evento manda; o indicador do corpo confirma (a doc tem exemplo de débito com texto de crédito).
    sentido: c.event === 'transactions.credit' ? 'entrada' : 'saida',
    valor: Math.round(valor * 100) / 100,
    forma: s(d.type).slice(0, 40),
    descricao: s(d.description).slice(0, 300),
    contraparte: s(parte.name).slice(0, 160),
  };
}

function diaEmBrasilia(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

export function creditoDoMovimento(m: Pick<Movimento, 'data' | 'valor' | 'descricao' | 'contraparte'>): Credito {
  return { data: diaEmBrasilia(m.data), valor: m.valor, descricao: `${m.descricao} ${m.contraparte}`.trim() };
}

/**
 * Grava o movimento do médico dono do CNPJ. Crédito com valor IGUAL ao de uma
 * nota em aberto marca o pagamento sozinho; valor diferente fica como
 * sugestão para ele confirmar na tela.
 */
export async function registrarMovimento(m: Movimento): Promise<'sem_conta' | 'repetido' | 'gravado' | 'pagamento_marcado'> {
  const db = getServerSupabase();
  const { data: conta } = await db.from('medico_banco').select('user_id').eq('cnpj', m.cnpj).maybeSingle();
  if (!conta) return 'sem_conta';
  const userId = conta.user_id as string;

  const { data: novo, error } = await db
    .from('medico_movimentos')
    .upsert(
      { user_id: userId, origem: 'btg', transacao_id: m.transacao_id, data: m.data, sentido: m.sentido, valor: m.valor, forma: m.forma, descricao: m.descricao, contraparte: m.contraparte },
      { onConflict: 'user_id,origem,transacao_id,sentido', ignoreDuplicates: true },
    )
    .select('id');
  if (error) throw new Error(`[medico/btg] gravar movimento falhou: ${error.message}`);
  if (!novo || novo.length === 0) return 'repetido';
  if (m.sentido !== 'entrada') return 'gravado';

  const estado = await carregarEstado(userId);
  const [sugestao] = sugerirPagamentos([creditoDoMovimento(m)], estado.demonstrativos, estado.hospitais);
  if (!sugestao || sugestao.confianca !== 'certa') return 'gravado';
  const d = estado.demonstrativos.find((x) => x.id === sugestao.demonstrativo_id)!;
  const dia = diaEmBrasilia(m.data);
  await db
    .from('medico_demonstrativos')
    .update({ pago_em: dia, valor_pago: m.valor, ...(etapaDe(d) === 'nota_emitida' ? { nota_enviada_em: dia } : {}) })
    .eq('user_id', userId)
    .eq('id', d.id);
  await db.from('medico_movimentos').update({ demonstrativo_id: d.id }).eq('user_id', userId).eq('id', novo[0]!.id);
  return 'pagamento_marcado';
}
