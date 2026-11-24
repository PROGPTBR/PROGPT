import { randomUUID } from 'crypto';

import { getServerSupabase } from '@/lib/db/supabase';

import { RegraMedica } from './service';
import { TIPOS_DE_DOCUMENTO, type Documento, type TipoDeDocumento } from './types';

// Documentos do médico (sub-projeto 108). Bucket privado sem policy: tudo
// passa pelo servidor, com o filtro de user_id explícito. O caminho do arquivo
// começa pelo id do dono e nunca vai para o navegador.

export const BUCKET = 'medico-documentos';
export const TAMANHO_MAXIMO = 20 * 1024 * 1024;
const ACEITOS = /^(application\/pdf|image\/(jpeg|png|webp|heic|heif)|text\/xml|application\/xml|application\/vnd\.openxmlformats-officedocument\.(spreadsheetml\.sheet|wordprocessingml\.document)|application\/vnd\.ms-excel|text\/csv)$/;
const EXTENSOES = /\.(pdf|jpe?g|png|webp|heic|heif|xml|xlsx|xls|docx|csv)$/i;

const COLUNAS = 'id, demonstrativo_id, tipo, nome, mime, tamanho, created_at';

export function arquivoAceito(nome: string, mime: string): boolean {
  return ACEITOS.test(mime) || EXTENSOES.test(nome);
}

const nomeSeguro = (n: string) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80) || 'arquivo';

export async function listarDocumentos(userId: string): Promise<Documento[]> {
  const { data, error } = await getServerSupabase().from('medico_documentos').select(COLUNAS).eq('user_id', userId).order('created_at', { ascending: false }).limit(500);
  if (error) throw new Error(`[medico] ler documentos falhou: ${error.message}`);
  return (data ?? []) as Documento[];
}

export async function guardarDocumento(
  userId: string,
  arquivo: { nome: string; buf: Buffer; mime: string },
  tipo: TipoDeDocumento,
  demonstrativoId: string | null,
): Promise<Documento> {
  if (!TIPOS_DE_DOCUMENTO.includes(tipo)) throw new RegraMedica('Tipo de documento inválido.');
  if (arquivo.buf.length === 0) throw new RegraMedica('O arquivo está vazio.');
  if (arquivo.buf.length > TAMANHO_MAXIMO) throw new RegraMedica('O arquivo passa de 20 MB.');
  if (!arquivoAceito(arquivo.nome, arquivo.mime)) throw new RegraMedica('Envie PDF, foto, XML, Excel ou Word.');
  const db = getServerSupabase();
  if (demonstrativoId) {
    const { data } = await db.from('medico_demonstrativos').select('id').eq('user_id', userId).eq('id', demonstrativoId).maybeSingle();
    if (!data) throw new RegraMedica('Registro não encontrado.');
  }

  const caminho = `${userId}/${randomUUID()}-${nomeSeguro(arquivo.nome)}`;
  const up = await db.storage.from(BUCKET).upload(caminho, arquivo.buf, { contentType: arquivo.mime || 'application/octet-stream', upsert: false });
  if (up.error) throw new Error(`[medico] guardar arquivo falhou: ${up.error.message}`);

  const { data, error } = await db
    .from('medico_documentos')
    .insert({ user_id: userId, demonstrativo_id: demonstrativoId, tipo, nome: arquivo.nome.slice(0, 160), mime: arquivo.mime.slice(0, 120), tamanho: arquivo.buf.length, caminho })
    .select(COLUNAS)
    .single();
  if (error || !data) {
    await db.storage.from(BUCKET).remove([caminho]);
    throw new Error(`[medico] registrar documento falhou: ${error?.message}`);
  }
  return data as Documento;
}

/** Link assinado de 2 minutos para o dono baixar. Null se o documento não é dele. */
export async function linkDoDocumento(userId: string, id: string): Promise<string | null> {
  const db = getServerSupabase();
  const { data } = await db.from('medico_documentos').select('caminho, nome').eq('user_id', userId).eq('id', id).maybeSingle();
  if (!data) return null;
  const { data: assinado } = await db.storage.from(BUCKET).createSignedUrl(data.caminho as string, 120, { download: data.nome as string });
  return assinado?.signedUrl ?? null;
}

export async function apagarDocumento(userId: string, id: string): Promise<boolean> {
  const db = getServerSupabase();
  const { data } = await db.from('medico_documentos').select('caminho').eq('user_id', userId).eq('id', id).maybeSingle();
  if (!data) return false;
  await db.storage.from(BUCKET).remove([data.caminho as string]);
  const { error } = await db.from('medico_documentos').delete().eq('user_id', userId).eq('id', id);
  return !error;
}

/** A nota mais recente guardada num recebimento, para ir anexada no envio automático. */
export async function notaGuardada(userId: string, demonstrativoId: string): Promise<{ nome: string; buf: Buffer; mime: string } | null> {
  const db = getServerSupabase();
  const { data } = await db
    .from('medico_documentos')
    .select('caminho, nome, mime')
    .eq('user_id', userId)
    .eq('demonstrativo_id', demonstrativoId)
    .eq('tipo', 'nota')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const arquivo = await db.storage.from(BUCKET).download(data.caminho as string);
  if (arquivo.error || !arquivo.data) return null;
  return { nome: data.nome as string, buf: Buffer.from(await arquivo.data.arrayBuffer()), mime: (data.mime as string) || 'application/pdf' };
}
