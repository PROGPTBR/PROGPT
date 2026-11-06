import { randomBytes, randomUUID } from 'crypto';

import { configuredAppUrl } from '@/lib/app-url';
import { getServerSupabase } from '@/lib/db/supabase';
import { parseChatAttachment } from '@/lib/chat-attachments';
import { sendEmail } from '@/lib/email/client';
import { buildRecebimentoAvisoEmail, buildRecebimentoLinkEmail } from '@/lib/email/templates';

import {
  apontamentosSemValores,
  conferirNota,
  ladoEntrega,
  ladoFinanceiro,
  podeAtestar,
  saldoDoPedido,
  statusDoPedido,
  validarEntrada,
  valorDoPedido,
  type SaldoItem,
} from './conferencia';
import { extrairNotaDoTexto } from './extrair';
import { finalidadeDaNota, lerNfeXml, pareceNfe } from './nfe-xml';
import {
  FINALIDADE_LABEL,
  type Apontamento,
  type EntradaItem,
  type FinalidadeNota,
  type NotaLida,
  type PedidoInput,
  type RecebimentoEntrada,
  type RecebimentoNota,
  type RecebimentoPedido,
} from './types';

// Serviço do Recebimento de NF (sub-projeto 95).
//
// Tudo passa por service-role. Nas rotas do comprador, o filtro
// `.eq('user_id')` EXPLÍCITO é o que segura o isolamento entre clientes; nas
// páginas públicas, o token (32 bytes) é a credencial. Remover qualquer um
// dos dois vaza pedido de uma empresa para outra.

export const BUCKET_NOTAS = 'recebimento-notas';
export type Papel = 'fornecedor' | 'almoxarifado' | 'financeiro';

const TOKEN_COLUNA: Record<Papel, 'fornecedor_token' | 'almoxarifado_token' | 'financeiro_token'> = {
  fornecedor: 'fornecedor_token',
  almoxarifado: 'almoxarifado_token',
  financeiro: 'financeiro_token',
};

function svc() {
  return getServerSupabase();
}

export function novoToken(): string {
  return randomBytes(32).toString('base64url');
}

export function linkDoPapel(papel: Papel, token: string): string {
  return `${configuredAppUrl()}/portal/${papel}/${token}`;
}

export function linkDoComprador(pedidoId: string): string {
  return `${configuredAppUrl()}/recebimento/${pedidoId}`;
}

export function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function rotuloDoPedido(p: Pick<RecebimentoPedido, 'numero' | 'titulo' | 'fornecedor_nome'>): string {
  if (p.numero) return `Pedido ${p.numero}${p.titulo ? ` · ${p.titulo}` : ''}`;
  return p.titulo || `Pedido de ${p.fornecedor_nome}`;
}

export type PedidoCompleto = {
  pedido: RecebimentoPedido;
  notas: RecebimentoNota[];
  entradas: RecebimentoEntrada[];
  saldo: SaldoItem[];
};

function normalizarPedido(row: Record<string, unknown>): RecebimentoPedido {
  return { ...(row as RecebimentoPedido), valor_total: Number(row.valor_total ?? 0) };
}

function normalizarNota(row: Record<string, unknown>): RecebimentoNota {
  return { ...(row as RecebimentoNota), valor_total: row.valor_total == null ? null : Number(row.valor_total) };
}

// --- Leitura ----------------------------------------------------------------

export async function listarPedidos(userId: string, limite = 100): Promise<RecebimentoPedido[]> {
  const { data, error } = await svc()
    .from('recebimento_pedidos')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(limite);
  if (error) {
    console.error('[recebimento] listar falhou:', error.message);
    return [];
  }
  return (data ?? []).map(normalizarPedido);
}

async function completar(pedido: RecebimentoPedido): Promise<PedidoCompleto> {
  const [{ data: notas }, { data: entradas }] = await Promise.all([
    svc()
      .from('recebimento_notas')
      .select('*')
      .eq('pedido_id', pedido.id)
      .eq('user_id', pedido.user_id)
      .order('created_at', { ascending: true }),
    svc()
      .from('recebimento_entradas')
      .select('*')
      .eq('pedido_id', pedido.id)
      .eq('user_id', pedido.user_id)
      .order('created_at', { ascending: true }),
  ]);
  const ents = (entradas ?? []) as RecebimentoEntrada[];
  return {
    pedido,
    notas: (notas ?? []).map(normalizarNota),
    entradas: ents,
    saldo: saldoDoPedido(pedido.itens, ents),
  };
}

export async function getPedido(userId: string, pedidoId: string): Promise<PedidoCompleto | null> {
  const { data } = await svc()
    .from('recebimento_pedidos')
    .select('*')
    .eq('id', pedidoId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!data) return null;
  return completar(normalizarPedido(data));
}

export async function getPedidoPorToken(papel: Papel, token: string): Promise<PedidoCompleto | null> {
  if (!token || token.length < 20) return null;
  const { data } = await svc()
    .from('recebimento_pedidos')
    .select('*')
    .eq(TOKEN_COLUNA[papel], token)
    .maybeSingle();
  if (!data) return null;
  return completar(normalizarPedido(data));
}

// --- Visões por papel (o que cada um pode ver) -------------------------------

export type NotaSemValores = {
  id: string;
  numero: string;
  serie: string;
  data_emissao: string;
  finalidade: FinalidadeNota;
  itens: Array<{ descricao: string; unidade: string; quantidade: number | null }>;
  apontamentos: Apontamento[];
  created_at: string;
};

export type VisaoAlmoxarifado = {
  rotulo: string;
  fornecedor: string;
  status: RecebimentoPedido['status'];
  itens: Array<{ codigo: string; descricao: string; unidade: string; quantidade: number }>;
  notasEntrega: NotaSemValores[];
  saldo: SaldoItem[];
  entradas: Array<{ id: string; responsavel: string; observacao: string; created_at: string; itens: EntradaItem[] }>;
  pagamentoLiberadoEm: string | null;
  pagamentoLiberadoPor: string | null;
};

/** O almoxarifado não vê valor nenhum: nem preço, nem total, nem imposto,
 *  nem a nota financeira (pedido explícito do processo). */
export function visaoAlmoxarifado(c: PedidoCompleto): VisaoAlmoxarifado {
  return {
    rotulo: rotuloDoPedido(c.pedido),
    fornecedor: c.pedido.fornecedor_nome,
    status: c.pedido.status,
    itens: c.pedido.itens.map((i) => ({ codigo: i.codigo, descricao: i.descricao, unidade: i.unidade, quantidade: i.quantidade })),
    notasEntrega: c.notas
      .filter((n) => ladoEntrega(n.finalidade))
      .map((n) => ({
        id: n.id,
        numero: n.numero,
        serie: n.serie,
        data_emissao: n.data_emissao,
        finalidade: n.finalidade,
        itens: n.itens.map((i) => ({ descricao: i.descricao, unidade: i.unidade, quantidade: i.quantidade })),
        apontamentos: apontamentosSemValores(n.conferencia),
        created_at: n.created_at,
      })),
    saldo: c.saldo,
    entradas: c.entradas.map((e) => ({
      id: e.id,
      responsavel: e.responsavel,
      observacao: e.observacao,
      created_at: e.created_at,
      itens: e.itens,
    })),
    pagamentoLiberadoEm: c.pedido.pagamento_liberado_em,
    pagamentoLiberadoPor: c.pedido.pagamento_liberado_por,
  };
}

export type VisaoFornecedor = {
  rotulo: string;
  fornecedor: string;
  comprador: string;
  status: RecebimentoPedido['status'];
  itens: Array<{ codigo: string; descricao: string; ncm: string; unidade: string; quantidade: number; valor_unitario: number }>;
  notas: Array<{ id: string; numero: string; finalidade: FinalidadeNota; created_at: string }>;
  saldo: SaldoItem[];
};

/** O fornecedor vê o pedido dele e o que ainda falta entregar, mas não a
 *  conferência interna nem as ressalvas do almoxarifado. */
export function visaoFornecedor(c: PedidoCompleto, comprador: string): VisaoFornecedor {
  return {
    rotulo: rotuloDoPedido(c.pedido),
    fornecedor: c.pedido.fornecedor_nome,
    comprador,
    status: c.pedido.status,
    itens: c.pedido.itens.map((i) => ({
      codigo: i.codigo,
      descricao: i.descricao,
      ncm: i.ncm,
      unidade: i.unidade,
      quantidade: i.quantidade,
      valor_unitario: i.valor_unitario,
    })),
    notas: c.notas.map((n) => ({ id: n.id, numero: n.numero, finalidade: n.finalidade, created_at: n.created_at })),
    saldo: c.saldo.map((s) => ({ ...s, ressalvas: [] })),
  };
}

// --- Escrita ----------------------------------------------------------------

export async function criarPedido(userId: string, input: PedidoInput): Promise<RecebimentoPedido | null> {
  const { data, error } = await svc()
    .from('recebimento_pedidos')
    .insert({
      user_id: userId,
      numero: input.numero,
      titulo: input.titulo,
      fornecedor_nome: input.fornecedor_nome,
      fornecedor_cnpj: input.fornecedor_cnpj,
      fornecedor_email: input.fornecedor_email,
      almoxarifado_nome: input.almoxarifado_nome,
      almoxarifado_email: input.almoxarifado_email,
      financeiro_nome: input.financeiro_nome,
      financeiro_email: input.financeiro_email,
      condicoes: input.condicoes,
      itens: input.itens,
      valor_total: valorDoPedido(input.itens),
      status: 'aguardando_nota',
      fornecedor_token: novoToken(),
      almoxarifado_token: novoToken(),
      financeiro_token: novoToken(),
    })
    .select('*')
    .single();
  if (error || !data) {
    console.error('[recebimento] criar falhou:', error?.message);
    return null;
  }
  return normalizarPedido(data);
}

export async function cancelarPedido(userId: string, pedidoId: string): Promise<boolean> {
  const { error, count } = await svc()
    .from('recebimento_pedidos')
    .update({ status: 'cancelado', updated_at: new Date().toISOString() }, { count: 'exact' })
    .eq('id', pedidoId)
    .eq('user_id', userId)
    .neq('status', 'pagamento_liberado');
  return !error && (count ?? 0) > 0;
}

async function atualizarStatus(pedidoId: string, userId: string): Promise<PedidoCompleto | null> {
  const c = await getPedido(userId, pedidoId);
  if (!c) return null;
  const status = statusDoPedido({
    cancelado: c.pedido.status === 'cancelado',
    pagamentoLiberado: !!c.pedido.pagamento_liberado_em,
    temNota: c.notas.length > 0,
    saldo: c.saldo,
  });
  await svc()
    .from('recebimento_pedidos')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', pedidoId)
    .eq('user_id', userId);
  c.pedido.status = status;
  return c;
}

// --- Notas ------------------------------------------------------------------

const LIMITE_BYTES: Record<string, number> = {
  xml: 2 * 1024 * 1024,
  pdf: 15 * 1024 * 1024,
  imagem: 10 * 1024 * 1024,
};

export type ArquivoNota = { buf: Buffer; nome: string; mime: string };

function tipoDoArquivo(a: ArquivoNota): 'xml' | 'pdf' | 'imagem' | null {
  const nome = a.nome.toLowerCase();
  if (nome.endsWith('.xml') || a.mime === 'text/xml' || a.mime === 'application/xml') return 'xml';
  if (nome.endsWith('.pdf') || a.mime === 'application/pdf') return 'pdf';
  if (/\.(png|jpe?g)$/.test(nome) || a.mime === 'image/png' || a.mime === 'image/jpeg') return 'imagem';
  return null;
}

export class NotaInvalida extends Error {}

/** Lê o arquivo da nota: XML pela estrutura oficial, PDF/foto pela IA. */
export async function lerArquivoNota(a: ArquivoNota, userId: string): Promise<{ nota: NotaLida; origem: 'xml' | 'pdf' }> {
  const tipo = tipoDoArquivo(a);
  if (!tipo) throw new NotaInvalida('Envie o XML da nota (recomendado), o PDF do DANFE ou uma foto (PNG ou JPG).');
  if (a.buf.length > LIMITE_BYTES[tipo]!) {
    throw new NotaInvalida(`Arquivo grande demais (máximo ${Math.round(LIMITE_BYTES[tipo]! / 1024 / 1024)} MB).`);
  }

  if (tipo === 'xml') {
    const texto = a.buf.toString('utf8');
    if (!pareceNfe(texto)) throw new NotaInvalida('Este XML não é de uma NF-e. Envie o XML da nota fiscal eletrônica.');
    const nota = lerNfeXml(texto);
    if (nota.itens.length === 0) throw new NotaInvalida('O XML não tem nenhum item.');
    return { nota, origem: 'xml' };
  }

  const mime = tipo === 'pdf' ? 'application/pdf' : a.nome.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
  let texto: string;
  try {
    const parsed = await parseChatAttachment({ buf: a.buf, mime, filename: a.nome, maxChars: 60_000 });
    texto = parsed.parsedText;
  } catch {
    throw new NotaInvalida('Não foi possível ler este arquivo. Se tiver, envie o XML da nota.');
  }
  const nota = await extrairNotaDoTexto(texto, userId);
  if (nota.itens.length === 0) {
    throw new NotaInvalida('Não encontramos os itens da nota neste arquivo. Envie o XML da nota ou um PDF mais legível.');
  }
  return { nota, origem: 'pdf' };
}

function nomeSeguro(nome: string): string {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80) || 'nota';
}

export async function registrarNota(args: {
  completo: PedidoCompleto;
  arquivo: ArquivoNota;
  finalidade: FinalidadeNota | 'auto';
  enviadoPor: 'fornecedor' | 'comprador';
}): Promise<{ nota: RecebimentoNota; completo: PedidoCompleto }> {
  const { completo, arquivo, enviadoPor } = args;
  const { pedido } = completo;
  if (pedido.status === 'cancelado') throw new NotaInvalida('Este pedido foi cancelado pelo comprador.');
  if (pedido.pagamento_liberado_em) throw new NotaInvalida('Este pedido já foi recebido e teve o pagamento liberado.');

  const { nota, origem } = await lerArquivoNota(arquivo, pedido.user_id);
  const finalidade = args.finalidade === 'auto' ? finalidadeDaNota(nota) : args.finalidade;

  const conferencia = conferirNota({
    pedido: { itens: pedido.itens, fornecedor_cnpj: pedido.fornecedor_cnpj },
    nota,
    finalidade,
    anteriores: completo.notas.map((n) => ({
      numero: n.numero,
      serie: n.serie,
      chave: n.chave,
      itens: n.itens,
      finalidade: n.finalidade,
      casamento: n.conferencia?.casamento ?? [],
    })),
  });

  const path = `${pedido.user_id}/${pedido.id}/${randomUUID()}-${nomeSeguro(arquivo.nome)}`;
  const up = await svc()
    .storage.from(BUCKET_NOTAS)
    .upload(path, arquivo.buf, { contentType: arquivo.mime || 'application/octet-stream', upsert: false });
  const arquivoPath = up.error ? null : path;
  if (up.error) console.warn('[recebimento] arquivo da nota não foi guardado:', up.error.message);

  const { data, error } = await svc()
    .from('recebimento_notas')
    .insert({
      pedido_id: pedido.id,
      user_id: pedido.user_id,
      finalidade,
      numero: nota.numero,
      serie: nota.serie,
      chave: nota.chave,
      emitente_nome: nota.emitente_nome,
      emitente_cnpj: nota.emitente_cnpj,
      data_emissao: nota.data_emissao,
      natureza: nota.natureza,
      valor_total: nota.valor_total,
      itens: nota.itens,
      origem,
      enviado_por: enviadoPor,
      conferencia,
      arquivo_nome: arquivo.nome.slice(0, 200),
      arquivo_path: arquivoPath,
    })
    .select('*')
    .single();
  if (error || !data) {
    if (arquivoPath) await svc().storage.from(BUCKET_NOTAS).remove([arquivoPath]);
    throw new Error(`não foi possível gravar a nota: ${error?.message}`);
  }

  const registrada = normalizarNota(data);
  const atualizado = (await atualizarStatus(pedido.id, pedido.user_id)) ?? completo;
  void avisarNotaRecebida(atualizado, registrada);
  return { nota: registrada, completo: atualizado };
}

export async function urlDoArquivo(path: string): Promise<string | null> {
  const { data } = await svc().storage.from(BUCKET_NOTAS).createSignedUrl(path, 120);
  return data?.signedUrl ?? null;
}

// --- Almoxarifado -----------------------------------------------------------

export async function registrarEntrada(args: {
  completo: PedidoCompleto;
  itens: EntradaItem[];
  responsavel: string;
  observacao: string;
  notaId: string | null;
}): Promise<{ ok: true; completo: PedidoCompleto } | { ok: false; erro: string }> {
  const { completo } = args;
  const { pedido } = completo;
  if (pedido.status === 'cancelado') return { ok: false, erro: 'Este pedido foi cancelado.' };
  if (pedido.pagamento_liberado_em) return { ok: false, erro: 'Este pedido já teve o pagamento liberado.' };

  const itens = args.itens
    .filter((i) => i.quantidade > 0 || i.ressalva.trim())
    .map((i) => ({ item: i.item, quantidade: Math.max(0, i.quantidade), ressalva: i.ressalva.trim().slice(0, 500) }));
  const erro = validarEntrada(completo.saldo, itens);
  if (erro) return { ok: false, erro };

  const notaId = args.notaId && completo.notas.some((n) => n.id === args.notaId && ladoEntrega(n.finalidade)) ? args.notaId : null;

  const { error } = await svc().from('recebimento_entradas').insert({
    pedido_id: pedido.id,
    user_id: pedido.user_id,
    nota_id: notaId,
    itens,
    responsavel: args.responsavel.trim().slice(0, 120),
    observacao: args.observacao.trim().slice(0, 2000),
  });
  if (error) return { ok: false, erro: 'Não foi possível registrar agora. Tente de novo.' };

  const atualizado = (await atualizarStatus(pedido.id, pedido.user_id)) ?? completo;
  void avisarEntrada(atualizado);
  return { ok: true, completo: atualizado };
}

/** OK do almoxarifado: atesta que tudo o que foi pedido chegou, e libera o
 *  pagamento. Só é aceito sem pendência. */
export async function atestarRecebimento(args: {
  completo: PedidoCompleto;
  responsavel: string;
}): Promise<{ ok: true; completo: PedidoCompleto } | { ok: false; erro: string }> {
  const { completo } = args;
  const { pedido } = completo;
  if (pedido.pagamento_liberado_em) return { ok: false, erro: 'O pagamento já foi liberado.' };
  if (pedido.status === 'cancelado') return { ok: false, erro: 'Este pedido foi cancelado.' };
  if (!podeAtestar(completo.saldo)) {
    return { ok: false, erro: 'Ainda há itens pendentes. O OK para pagamento só vale com tudo entregue.' };
  }
  const responsavel = args.responsavel.trim().slice(0, 120);
  if (!responsavel) return { ok: false, erro: 'Informe o seu nome para registrar o OK.' };

  const { error, count } = await svc()
    .from('recebimento_pedidos')
    .update(
      {
        pagamento_liberado_em: new Date().toISOString(),
        pagamento_liberado_por: responsavel,
        status: 'pagamento_liberado',
        updated_at: new Date().toISOString(),
      },
      { count: 'exact' },
    )
    .eq('id', pedido.id)
    .eq('user_id', pedido.user_id)
    .is('pagamento_liberado_em', null);
  if (error || !count) return { ok: false, erro: 'Não foi possível registrar o OK agora.' };

  const atualizado = (await getPedido(pedido.user_id, pedido.id)) ?? completo;
  void avisarPagamentoLiberado(atualizado);
  return { ok: true, completo: atualizado };
}

// --- E-mails (fail-soft: e-mail que não sai nunca derruba a ação) -------------

async function emailDoComprador(userId: string): Promise<{ email: string; nome: string } | null> {
  try {
    const { data } = await svc().auth.admin.getUserById(userId);
    const email = data.user?.email;
    if (!email) return null;
    const { data: perfil } = await svc().from('profiles').select('full_name').eq('id', userId).maybeSingle();
    return { email, nome: (perfil as { full_name?: string } | null)?.full_name ?? '' };
  } catch {
    return null;
  }
}

async function enviar(to: string, montado: { subject: string; html: string }): Promise<boolean> {
  if (!to || !emailValido(to)) return false;
  try {
    const r = await sendEmail({ to, subject: montado.subject, html: montado.html });
    return r.ok;
  } catch (err) {
    console.warn('[recebimento] e-mail falhou:', err);
    return false;
  }
}

/** Envia os links de cada papel (o comprador escolhe quais). */
export async function enviarLinks(c: PedidoCompleto, papeis: Papel[]): Promise<Record<Papel, boolean>> {
  const comprador = await emailDoComprador(c.pedido.user_id);
  const out: Record<Papel, boolean> = { fornecedor: false, almoxarifado: false, financeiro: false };
  const contato: Record<Papel, { email: string; nome: string }> = {
    fornecedor: { email: c.pedido.fornecedor_email, nome: c.pedido.fornecedor_nome },
    almoxarifado: { email: c.pedido.almoxarifado_email, nome: c.pedido.almoxarifado_nome },
    financeiro: { email: c.pedido.financeiro_email, nome: c.pedido.financeiro_nome },
  };
  for (const papel of papeis) {
    out[papel] = await enviar(
      contato[papel].email,
      buildRecebimentoLinkEmail({
        papel,
        nome: contato[papel].nome,
        compradorNome: comprador?.nome || comprador?.email || '',
        pedido: rotuloDoPedido(c.pedido),
        fornecedor: c.pedido.fornecedor_nome,
        link: linkDoPapel(papel, c.pedido[TOKEN_COLUNA[papel]]),
      }),
    );
  }
  return out;
}

async function avisarNotaRecebida(c: PedidoCompleto, nota: RecebimentoNota): Promise<void> {
  const rotulo = rotuloDoPedido(c.pedido);
  const graves = nota.conferencia.apontamentos.filter((a) => a.severidade !== 'info').length;
  const comprador = await emailDoComprador(c.pedido.user_id);
  if (comprador) {
    await enviar(
      comprador.email,
      buildRecebimentoAvisoEmail({
        nome: comprador.nome,
        assunto: `Nota ${nota.numero || ''} recebida: ${rotulo}`,
        titulo: 'Chegou uma nota do fornecedor',
        texto: `${FINALIDADE_LABEL[nota.finalidade]} ${nota.numero ? `nº ${nota.numero} ` : ''}anexada ao ${rotulo}. ${
          graves ? `A conferência encontrou ${graves} divergência(s) com o pedido.` : 'A conferência não encontrou divergência com o pedido.'
        }`,
        link: linkDoComprador(c.pedido.id),
        botao: 'Ver a conferência',
      }),
    );
  }
  if (ladoEntrega(nota.finalidade)) {
    await enviar(
      c.pedido.almoxarifado_email,
      buildRecebimentoAvisoEmail({
        nome: c.pedido.almoxarifado_nome,
        assunto: `Material a caminho: ${rotulo}`,
        titulo: 'O fornecedor emitiu a nota de entrega',
        texto: `A nota de entrega ${nota.numero ? `nº ${nota.numero} ` : ''}do ${rotulo} (${c.pedido.fornecedor_nome}) foi emitida. Quando o material chegar, confira pelo link e registre o que foi recebido.`,
        link: linkDoPapel('almoxarifado', c.pedido.almoxarifado_token),
        botao: 'Conferir o recebimento',
      }),
    );
  }
  if (ladoFinanceiro(nota.finalidade)) {
    await enviar(
      c.pedido.financeiro_email,
      buildRecebimentoAvisoEmail({
        nome: c.pedido.financeiro_nome,
        assunto: `Nota financeira recebida: ${rotulo}`,
        titulo: 'Chegou a nota financeira',
        texto: `A nota ${nota.numero ? `nº ${nota.numero} ` : ''}do ${rotulo} (${c.pedido.fornecedor_nome}) foi conferida contra o pedido${
          graves ? `, com ${graves} divergência(s)` : ', sem divergência'
        }. O pagamento só fica liberado depois do OK do almoxarifado.`,
        link: linkDoPapel('financeiro', c.pedido.financeiro_token),
        botao: 'Ver a nota e a conferência',
      }),
    );
  }
}

async function avisarEntrada(c: PedidoCompleto): Promise<void> {
  const comprador = await emailDoComprador(c.pedido.user_id);
  if (!comprador) return;
  const pendentes = c.saldo.filter((s) => s.pendente > 0);
  await enviar(
    comprador.email,
    buildRecebimentoAvisoEmail({
      nome: comprador.nome,
      assunto: `Recebimento registrado: ${rotuloDoPedido(c.pedido)}`,
      titulo: pendentes.length ? 'Entrega parcial registrada' : 'Tudo entregue',
      texto: pendentes.length
        ? `O almoxarifado registrou um recebimento. Ainda faltam ${pendentes.length} item(ns), que ficaram como pendência com o fornecedor.`
        : 'O almoxarifado registrou o recebimento de todos os itens. Falta só o OK dele para liberar o pagamento.',
      link: linkDoComprador(c.pedido.id),
      botao: 'Ver o pedido',
    }),
  );
}

async function avisarPagamentoLiberado(c: PedidoCompleto): Promise<void> {
  const rotulo = rotuloDoPedido(c.pedido);
  const texto = `${c.pedido.pagamento_liberado_por ?? 'O almoxarifado'} atestou que todos os itens do ${rotulo} (${c.pedido.fornecedor_nome}) foram entregues. O pagamento está liberado.`;
  await enviar(
    c.pedido.financeiro_email,
    buildRecebimentoAvisoEmail({
      nome: c.pedido.financeiro_nome,
      assunto: `Pagamento liberado: ${rotulo}`,
      titulo: 'Pagamento liberado pelo almoxarifado',
      texto,
      link: linkDoPapel('financeiro', c.pedido.financeiro_token),
      botao: 'Ver a nota financeira',
    }),
  );
  const comprador = await emailDoComprador(c.pedido.user_id);
  if (comprador) {
    await enviar(
      comprador.email,
      buildRecebimentoAvisoEmail({
        nome: comprador.nome,
        assunto: `Pagamento liberado: ${rotulo}`,
        titulo: 'Recebimento concluído',
        texto,
        link: linkDoComprador(c.pedido.id),
        botao: 'Ver o pedido',
      }),
    );
  }
}

/** Nome da empresa compradora (para o fornecedor saber de quem é o pedido). */
export async function nomeDaEmpresa(userId: string): Promise<string> {
  const { data } = await svc().from('profiles').select('company_name').eq('id', userId).maybeSingle();
  return ((data as { company_name?: string | null } | null)?.company_name ?? '').trim();
}
