/* eslint-disable @typescript-eslint/no-explicit-any -- respostas e webhooks da Evolution API não têm tipo publicado */
import { createHash } from 'crypto';

import { configuredAppUrl } from '@/lib/app-url';

// WhatsApp da Área Médica pela Evolution API (sub-projeto 101). Server-only.
//
// Cada médico conecta o PRÓPRIO WhatsApp numa instância só dele
// (`medico-<userId sem hífens>`): é por ela que o sistema lê o grupo das
// cirurgias e manda a cobrança ao paciente. Os avisos diários saem de outra
// instância, a da 2B Supply (INSTANCIA_AVISOS): mensagem que o médico manda
// para si mesmo não toca no celular.
//
// EVOLUTION_API_KEY é a chave global do servidor Evolution, que também atende
// outros sistemas: este arquivo só toca instâncias com o prefixo `medico-` e a
// de avisos. Nunca liste, altere ou apague instância de outro prefixo.

export const INSTANCIA_AVISOS = process.env.EVOLUTION_INSTANCE_AVISOS?.trim() || '2bsupply-avisos';

export function whatsappConfigurado(): boolean {
  return !!(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY);
}

export function instanciaDoMedico(userId: string): string {
  return `medico-${userId.replace(/-/g, '').toLowerCase()}`;
}

/** "medico-<32 hex>" → user_id (UUID), ou null. */
export function userIdDaInstancia(instancia: string): string | null {
  const m = /^medico-([0-9a-f]{32})$/.exec(instancia ?? '');
  if (!m) return null;
  const h = m[1]!;
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function instanciaPermitida(instancia: string): boolean {
  return instancia === INSTANCIA_AVISOS || userIdDaInstancia(instancia) !== null;
}

/** Segredo compartilhado com a Evolution (vai na URL do webhook) e com o agendador de avisos. */
export function tokenInterno(uso: 'whatsapp' | 'avisos'): string {
  const base = process.env.APP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!base) return '';
  return createHash('sha256').update(`${base}:area-medica:${uso}`).digest('hex').slice(0, 40);
}

/**
 * Endereço público do nosso webhook. `origem` é o endereço que o médico está
 * usando no navegador (o domínio certo do momento); sem ele, vale o APP_URL.
 * Nunca aponta para endereço local: a Evolution roda fora desta máquina.
 */
export function webhookUrl(origem?: string | null): string {
  const local = (u: string) => /^https?:\/\/(localhost|127\.|0\.0\.0\.0|\[::1\])/i.test(u);
  const base = origem && /^https:\/\//i.test(origem) && !local(origem) ? origem.replace(/\/$/, '') : configuredAppUrl();
  return `${base}/api/medico/whatsapp/webhook?token=${tokenInterno('whatsapp')}`;
}

/** Origem pública de um pedido atrás do proxy do Railway (o `req.url` pode trazer o host interno). */
export function origemPublica(req: Request): string | null {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (!host) return null;
  return `${req.headers.get('x-forwarded-proto') ?? 'https'}://${host.split(',')[0]!.trim()}`;
}

export class EvolutionErro extends Error {}

async function evo<T = any>(path: string, method = 'GET', body?: unknown, timeoutMs = 20_000): Promise<T> {
  const url = process.env.EVOLUTION_API_URL?.replace(/\/$/, '');
  const key = process.env.EVOLUTION_API_KEY;
  if (!url || !key) throw new EvolutionErro('WhatsApp não configurado no servidor.');
  const resp = await fetch(`${url}${path}`, {
    method,
    headers: { apikey: key, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const txt = await resp.text().catch(() => '');
  let data: unknown = {};
  try {
    data = txt ? JSON.parse(txt) : {};
  } catch {
    data = { raw: txt };
  }
  if (!resp.ok) throw new EvolutionErro(`Evolution ${resp.status} em ${path.split('?')[0]}: ${txt.slice(0, 300)}`);
  return data as T;
}

function exigir(instancia: string) {
  if (!instanciaPermitida(instancia)) throw new EvolutionErro('Instância fora da Área Médica.');
}

async function configurarWebhook(instancia: string, origem?: string | null): Promise<void> {
  const cfg = { enabled: true, url: webhookUrl(origem), events: ['MESSAGES_UPSERT'], webhookByEvents: false, base64: false };
  try {
    await evo(`/webhook/set/${instancia}`, 'POST', { webhook: cfg });
  } catch {
    await evo(`/webhook/set/${instancia}`, 'POST', cfg).catch((e) => console.error('[medico/whatsapp] webhook:', e));
  }
}

export type EstadoConexao = 'open' | 'connecting' | 'close';

export async function estadoDaInstancia(instancia: string): Promise<EstadoConexao> {
  exigir(instancia);
  try {
    const r = await evo<any>(`/instance/connectionState/${instancia}`);
    const s = String(r?.instance?.state ?? r?.state ?? '').toLowerCase();
    return s === 'open' ? 'open' : s === 'connecting' ? 'connecting' : 'close';
  } catch {
    return 'close';
  }
}

/** Cria a instância (se preciso) e devolve o QR code para o médico ler; null se já está conectada. */
export async function conectar(instancia: string, lerGrupo: boolean, origem?: string | null): Promise<{ qr: string | null }> {
  exigir(instancia);
  if ((await estadoDaInstancia(instancia)) === 'open') {
    // Já conectada: só garante que o webhook aponta para o endereço atual.
    if (lerGrupo) await configurarWebhook(instancia, origem);
    return { qr: null };
  }
  await evo('/instance/create', 'POST', { instanceName: instancia, integration: 'WHATSAPP-BAILEYS', qrcode: true }).catch(() => undefined);
  if (lerGrupo) await configurarWebhook(instancia, origem);

  // Logo depois de criar, a Evolution costuma devolver o QR vazio: tenta de novo.
  let ultimo: unknown = null;
  for (let i = 0; i < 4; i++) {
    try {
      const r = await evo<any>(`/instance/connect/${instancia}`);
      const b64: string | null = r?.base64 ?? r?.qrcode?.base64 ?? null;
      if (b64) return { qr: b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}` };
      if (String(r?.instance?.state ?? r?.state ?? '') === 'open') return { qr: null };
    } catch (e) {
      ultimo = e;
    }
    await new Promise((res) => setTimeout(res, 1500));
  }
  throw ultimo instanceof Error ? ultimo : new EvolutionErro('A Evolution não devolveu o QR code. Tente de novo em instantes.');
}

export async function desconectar(instancia: string): Promise<void> {
  exigir(instancia);
  await evo(`/instance/logout/${instancia}`, 'DELETE').catch(() => undefined);
  await evo(`/instance/delete/${instancia}`, 'DELETE').catch(() => undefined);
}

export type Grupo = { jid: string; nome: string };

export async function gruposDaInstancia(instancia: string): Promise<Grupo[]> {
  exigir(instancia);
  const r = await evo<any>(`/group/fetchAllGroups/${instancia}?getParticipants=false`, 'GET', undefined, 45_000);
  const lista: any[] = Array.isArray(r) ? r : Array.isArray(r?.groups) ? r.groups : [];
  return lista
    .map((g) => ({ jid: String(g?.id ?? ''), nome: String(g?.subject ?? '').trim() }))
    .filter((g) => g.jid.endsWith('@g.us') && g.nome)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Só dígitos, com o 55 do Brasil quando o número vem sem país. Null se não parece telefone. */
export function numeroLimpo(v: string): string | null {
  const d = (v ?? '').replace(/\D/g, '').replace(/^0+/, '');
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if (d.length >= 12 && d.length <= 15) return d;
  return null;
}

export async function enviarTexto(instancia: string, numero: string, texto: string): Promise<void> {
  exigir(instancia);
  await evo(`/message/sendText/${instancia}`, 'POST', { number: numero, text: texto });
}

export async function enviarDocumento(instancia: string, numero: string, arquivo: { nome: string; base64: string; mime: string }, legenda?: string): Promise<void> {
  exigir(instancia);
  await evo(`/message/sendMedia/${instancia}`, 'POST', {
    number: numero,
    mediatype: 'document',
    media: arquivo.base64,
    fileName: arquivo.nome,
    mimetype: arquivo.mime,
    ...(legenda ? { caption: legenda } : {}),
  }, 60_000);
}

/** Texto de uma mensagem do webhook MESSAGES_UPSERT (Baileys), ou '' se não é texto. */
export function textoDaMensagem(data: any): string {
  const m = data?.message ?? {};
  const t =
    m.conversation ??
    m.extendedTextMessage?.text ??
    m.imageMessage?.caption ??
    m.documentMessage?.caption ??
    m.ephemeralMessage?.message?.extendedTextMessage?.text ??
    m.ephemeralMessage?.message?.conversation ??
    '';
  return typeof t === 'string' ? t.trim() : '';
}
