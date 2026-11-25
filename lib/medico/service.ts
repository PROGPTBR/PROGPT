import { getServerSupabase } from '@/lib/db/supabase';

import { casarItens, totalDosItens } from './conciliacao';
import { dadosDeExemplo } from './exemplo';
import type { z } from 'zod';
import { CONFIG_VAZIA } from './types';
import type {
  Cirurgia,
  CirurgiaPatchSchema,
  CirurgiaSchema,
  Demonstrativo,
  DemonstrativoPatchSchema,
  DemonstrativoSchema,
  DiretoSchema,
  ContaBanco,
  Documento,
  Entrada,
  EstadoMedico,
  Indicacao,
  Hospital,
  HospitalSchema,
  ItemDemonstrativo,
  MedicoConfig,
  MovimentoBanco,
} from './types';

// Serviço da Área Médica (sub-projeto 100).
//
// Tudo passa por service-role, e o filtro `.eq('user_id')` EXPLÍCITO é o que
// segura o isolamento entre médicos. Remover o filtro vaza paciente de um
// médico para outro.

const HOSPITAL = 'id, nome, email, prazo_pagamento_dias, demonstrativo_meses, demonstrativo_dia, exemplo';
const CIRURGIA =
  'id, hospital_id, data, paciente, procedimento, convenio, valor, origem, demonstrativo_id, cobrada_em, funcao, registro, hora, cobrancas, observacao, exemplo';
const DEMONSTRATIVO =
  'id, hospital_id, referencia, recebido_em, valor_total, itens, nota_pedida_em, nota_numero, nota_emitida_em, nota_enviada_em, pago_em, valor_pago, exemplo, tipo, pagador_nome, pagador_documento, pagador_contato';
export const CONFIG =
  'medico_nome, contador_nome, contador_email, medico_email, whatsapp_numero, chave_pix, avisos_email, avisos_whatsapp, lembretes_agenda, grupo_jid, grupo_nome, empresa_nome, empresa_cnpj, crm, especialidade, contato';
const ENTRADA = 'id, canal, remetente, assunto, texto, recebido_em';

const num = (v: unknown): number | null => (v == null ? null : Number(v));

function cirurgiaDe(r: Record<string, unknown>): Cirurgia {
  return { ...(r as Cirurgia), valor: num(r.valor), cobrancas: Array.isArray(r.cobrancas) ? (r.cobrancas as string[]) : [] };
}

function demonstrativoDe(r: Record<string, unknown>): Demonstrativo {
  return {
    ...(r as Demonstrativo),
    valor_total: Number(r.valor_total ?? 0),
    valor_pago: num(r.valor_pago),
    itens: Array.isArray(r.itens) ? (r.itens as ItemDemonstrativo[]) : [],
  };
}

/** Os dados do médico, sem o que depende de quem está logado (`integracoes` é preenchido pela página e pela rota). */
export async function carregarEstado(userId: string): Promise<Omit<EstadoMedico, 'integracoes'>> {
  const db = getServerSupabase();
  const [config, hospitais, cirurgias, demonstrativos, entradas, conta, movimentos, documentos, indicacoes] = await Promise.all([
    db.from('medico_config').select(CONFIG).eq('user_id', userId).maybeSingle(),
    db.from('medico_hospitais').select(HOSPITAL).eq('user_id', userId).order('nome'),
    db.from('medico_cirurgias').select(CIRURGIA).eq('user_id', userId).order('data', { ascending: false }).limit(2000),
    db.from('medico_demonstrativos').select(DEMONSTRATIVO).eq('user_id', userId).order('recebido_em', { ascending: false }).limit(500),
    db.from('medico_entradas').select(ENTRADA).eq('user_id', userId).is('tratado_em', null).order('recebido_em').limit(400),
    // Nunca seleciona o refresh token: ele só é lido em lib/medico/btg.ts.
    db.from('medico_banco').select('cnpj, conectado_em, erro').eq('user_id', userId).maybeSingle(),
    db.from('medico_movimentos').select('id, data, sentido, valor, forma, descricao, contraparte, demonstrativo_id').eq('user_id', userId).order('data', { ascending: false }).limit(300),
    db.from('medico_documentos').select('id, demonstrativo_id, tipo, nome, mime, tamanho, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(500),
    db.from('medico_indicacoes').select('id, nome, contato, especialidade, situacao, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(300),
  ]);
  for (const r of [config, hospitais, cirurgias, demonstrativos, entradas, conta, movimentos, documentos, indicacoes]) {
    if (r.error) throw new Error(`[medico] leitura falhou: ${r.error.message}`);
  }
  return {
    config: { ...CONFIG_VAZIA, ...((config.data as Partial<MedicoConfig> | null) ?? {}) },
    hospitais: (hospitais.data ?? []) as Hospital[],
    cirurgias: (cirurgias.data ?? []).map(cirurgiaDe),
    demonstrativos: (demonstrativos.data ?? []).map(demonstrativoDe),
    entradas: (entradas.data ?? []) as Entrada[],
    conta: (conta.data as ContaBanco | null) ?? null,
    documentos: (documentos.data ?? []) as Documento[],
    indicacoes: (indicacoes.data ?? []) as Indicacao[],
    movimentos: (movimentos.data ?? []).map((m) => ({ ...(m as MovimentoBanco), valor: Number(m.valor) })),
  };
}

export async function salvarConfig(userId: string, config: Partial<MedicoConfig>): Promise<boolean> {
  const { error } = await getServerSupabase()
    .from('medico_config')
    .upsert({ user_id: userId, ...config, updated_at: new Date().toISOString() });
  return !error;
}

// ---------------------------------------------------------------------------
// Caixa de entrada: o que chegou sozinho e espera a conferência do médico.

export async function registrarEntrada(
  userId: string,
  e: { canal: 'whatsapp' | 'email'; origem_id: string; remetente: string; assunto?: string; texto: string; recebido_em?: string },
): Promise<void> {
  const { error } = await getServerSupabase()
    .from('medico_entradas')
    .upsert(
      {
        user_id: userId,
        canal: e.canal,
        origem_id: e.origem_id.slice(0, 200),
        remetente: e.remetente.slice(0, 200),
        assunto: (e.assunto ?? '').slice(0, 300),
        texto: e.texto.slice(0, 60_000),
        ...(e.recebido_em ? { recebido_em: e.recebido_em } : {}),
      },
      { onConflict: 'user_id,canal,origem_id', ignoreDuplicates: true },
    );
  if (error) console.error('[medico] registrar entrada falhou:', error.message);
}

export async function marcarEntradasTratadas(userId: string, ids: string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  const { error } = await getServerSupabase()
    .from('medico_entradas')
    .update({ tratado_em: new Date().toISOString() })
    .eq('user_id', userId)
    .in('id', ids);
  return !error;
}

/**
 * Cobrança direta (anestesista, particular): o paciente paga na hora. Grava a
 * cirurgia e o recebimento já ligados, com os dados de quem paga (o tomador
 * da nota).
 */
export async function criarDireto(userId: string, input: z.infer<typeof DiretoSchema>): Promise<string> {
  if (!(await hospitalDoUsuario(userId, input.hospital_id))) throw new RegraMedica('Escolha um hospital cadastrado.');
  const db = getServerSupabase();
  const { data: cirurgia, error: erroC } = await db
    .from('medico_cirurgias')
    .insert({ user_id: userId, hospital_id: input.hospital_id, data: input.data, paciente: input.paciente, procedimento: input.procedimento, convenio: 'Particular', valor: input.valor, origem: 'manual' })
    .select('id')
    .single();
  if (erroC || !cirurgia) throw new Error(`[medico] gravar cirurgia falhou: ${erroC?.message}`);

  const item: ItemDemonstrativo = { data: input.data, paciente: input.paciente, procedimento: input.procedimento, convenio: 'Particular', valor: input.valor, cirurgia_id: cirurgia.id as string };
  const { data: novo, error } = await db
    .from('medico_demonstrativos')
    .insert({
      user_id: userId,
      hospital_id: input.hospital_id,
      tipo: 'direto',
      referencia: input.paciente,
      recebido_em: input.data,
      valor_total: input.valor,
      itens: [item],
      pagador_nome: input.pagador_nome || input.paciente,
      pagador_documento: input.pagador_documento,
      pagador_contato: input.pagador_contato,
    })
    .select('id')
    .single();
  if (error || !novo) {
    await db.from('medico_cirurgias').delete().eq('user_id', userId).eq('id', cirurgia.id);
    throw new Error(`[medico] gravar cobrança direta falhou: ${error?.message}`);
  }
  await db.from('medico_cirurgias').update({ demonstrativo_id: novo.id }).eq('user_id', userId).eq('id', cirurgia.id);
  return novo.id as string;
}

async function hospitalDoUsuario(userId: string, hospitalId: string): Promise<boolean> {
  const { data } = await getServerSupabase()
    .from('medico_hospitais')
    .select('id')
    .eq('user_id', userId)
    .eq('id', hospitalId)
    .maybeSingle();
  return !!data;
}

export async function criarHospital(userId: string, h: z.infer<typeof HospitalSchema>): Promise<Hospital | null> {
  const { data, error } = await getServerSupabase()
    .from('medico_hospitais')
    .insert({ user_id: userId, ...h })
    .select(HOSPITAL)
    .single();
  return error ? null : (data as Hospital);
}

export async function atualizarHospital(userId: string, id: string, h: Partial<z.infer<typeof HospitalSchema>>): Promise<boolean> {
  const { error } = await getServerSupabase().from('medico_hospitais').update(h).eq('user_id', userId).eq('id', id);
  return !error;
}

/** Erro que a rota mostra ao médico como está. */
export class RegraMedica extends Error {}

export async function criarCirurgias(userId: string, lista: z.infer<typeof CirurgiaSchema>[]): Promise<Cirurgia[]> {
  const ids = [...new Set(lista.map((c) => c.hospital_id))];
  for (const id of ids) {
    if (!(await hospitalDoUsuario(userId, id))) throw new RegraMedica('Escolha um hospital cadastrado.');
  }
  const { data, error } = await getServerSupabase()
    .from('medico_cirurgias')
    .insert(lista.map((c) => ({ user_id: userId, ...c })))
    .select(CIRURGIA);
  if (error) throw new Error(`[medico] gravar cirurgias falhou: ${error.message}`);
  return (data ?? []).map(cirurgiaDe);
}

export async function atualizarCirurgia(userId: string, id: string, patch: z.infer<typeof CirurgiaPatchSchema>): Promise<boolean> {
  if (patch.hospital_id && !(await hospitalDoUsuario(userId, patch.hospital_id))) {
    throw new RegraMedica('Escolha um hospital cadastrado.');
  }
  const { error } = await getServerSupabase().from('medico_cirurgias').update(patch).eq('user_id', userId).eq('id', id);
  return !error;
}

/**
 * Grava o demonstrativo e faz o cruzamento com as cirurgias do médico:
 * cada linha que casa marca a cirurgia como incluída; linha sem cirurgia
 * correspondente vira cirurgia nova (o hospital pagou algo que o médico não
 * tinha anotado), se `criar_faltantes`.
 */
export async function criarDemonstrativo(
  userId: string,
  input: z.infer<typeof DemonstrativoSchema>,
): Promise<{ id: string; casadas: number; criadas: number; cobradas_pagas: number; cobradas_pendentes: number }> {
  if (!(await hospitalDoUsuario(userId, input.hospital_id))) throw new RegraMedica('Escolha um hospital cadastrado.');
  const db = getServerSupabase();

  const { data: abertas, error: erroAbertas } = await db
    .from('medico_cirurgias')
    .select(CIRURGIA)
    .eq('user_id', userId)
    .eq('hospital_id', input.hospital_id)
    .is('demonstrativo_id', null);
  if (erroAbertas) throw new Error(`[medico] leitura falhou: ${erroAbertas.message}`);

  const emAberto = (abertas ?? []).map(cirurgiaDe);
  const itens = casarItens(input.itens, emAberto, input.hospital_id);

  const { data: novo, error } = await db
    .from('medico_demonstrativos')
    .insert({
      user_id: userId,
      hospital_id: input.hospital_id,
      referencia: input.referencia,
      recebido_em: input.recebido_em,
      valor_total: input.valor_total ?? totalDosItens(input.itens),
      itens,
    })
    .select('id')
    .single();
  if (error || !novo) throw new Error(`[medico] gravar demonstrativo falhou: ${error?.message}`);
  const id = novo.id as string;

  const casadas = itens.filter((i) => i.cirurgia_id).map((i) => i.cirurgia_id!) as string[];
  if (casadas.length > 0) {
    await db.from('medico_cirurgias').update({ demonstrativo_id: id }).eq('user_id', userId).in('id', casadas);
  }

  let criadas = 0;
  const faltantes = itens.map((item, i) => ({ item, i })).filter(({ item }) => !item.cirurgia_id && item.data);
  if (input.criar_faltantes && faltantes.length > 0) {
    const { data: novas } = await db
      .from('medico_cirurgias')
      .insert(
        faltantes.map(({ item }) => ({
          user_id: userId,
          hospital_id: input.hospital_id,
          data: item.data,
          paciente: item.paciente,
          procedimento: item.procedimento,
          convenio: item.convenio,
          valor: item.valor,
          origem: 'demonstrativo',
          demonstrativo_id: id,
        })),
      )
      .select('id');
    if (novas && novas.length === faltantes.length) {
      faltantes.forEach(({ i }, k) => (itens[i]!.cirurgia_id = novas[k]!.id as string));
      await db.from('medico_demonstrativos').update({ itens }).eq('user_id', userId).eq('id', id);
      criadas = novas.length;
    }
  }

  // O hospital não responde às cobranças: é aqui que o médico fica sabendo o que entrou.
  const jaCobradas = emAberto.filter((c) => c.cobrancas.length > 0);
  const cobradas_pagas = jaCobradas.filter((c) => casadas.includes(c.id)).length;
  return { id, casadas: casadas.length, criadas, cobradas_pagas, cobradas_pendentes: jaCobradas.length - cobradas_pagas };
}

export async function atualizarDemonstrativo(
  userId: string,
  id: string,
  patch: z.infer<typeof DemonstrativoPatchSchema>,
): Promise<boolean> {
  const { error } = await getServerSupabase().from('medico_demonstrativos').update(patch).eq('user_id', userId).eq('id', id);
  return !error;
}

const TABELA = {
  hospitais: 'medico_hospitais',
  cirurgias: 'medico_cirurgias',
  demonstrativos: 'medico_demonstrativos',
} as const;
export type Recurso = keyof typeof TABELA;
export const RECURSOS = Object.keys(TABELA) as Recurso[];

export async function apagar(userId: string, recurso: Recurso, id: string): Promise<boolean> {
  const db = getServerSupabase();
  if (recurso === 'demonstrativos') {
    // Cirurgias que só existiam por causa deste demonstrativo saem junto; as
    // que o médico anotou voltam a ficar em aberto (o FK já zera o vínculo).
    await db.from('medico_cirurgias').delete().eq('user_id', userId).eq('demonstrativo_id', id).eq('origem', 'demonstrativo');
    const { data: d } = await db.from('medico_demonstrativos').select('tipo').eq('user_id', userId).eq('id', id).maybeSingle();
    if (d?.tipo === 'direto') await db.from('medico_cirurgias').delete().eq('user_id', userId).eq('demonstrativo_id', id);
  }
  const { error } = await db.from(TABELA[recurso]).delete().eq('user_id', userId).eq('id', id);
  return !error;
}

// ---------------------------------------------------------------------------
// Dados de exemplo: gravados na conta de quem pediu, marcados `exemplo`, para
// a apresentação. Apagar o exemplo não toca em dado real.

export async function apagarExemplo(userId: string): Promise<void> {
  // Os hospitais de exemplo levam junto cirurgias e demonstrativos (cascade).
  await getServerSupabase().from('medico_hospitais').delete().eq('user_id', userId).eq('exemplo', true);
}

export async function carregarExemplo(userId: string, hoje: string): Promise<void> {
  await apagarExemplo(userId);
  const db = getServerSupabase();
  const ex = dadosDeExemplo(hoje);

  const { data: hospitais, error } = await db
    .from('medico_hospitais')
    .insert(ex.hospitais.map((h) => ({ user_id: userId, exemplo: true, nome: h.nome, email: h.email, prazo_pagamento_dias: h.prazo })))
    .select('id, nome');
  if (error || !hospitais) throw new Error(`[medico] exemplo falhou: ${error?.message}`);
  const idDe = (chave: string) => hospitais.find((h) => h.nome === ex.hospitais.find((x) => x.chave === chave)!.nome)!.id as string;

  const { data: cirurgias, error: erroC } = await db
    .from('medico_cirurgias')
    .insert(
      ex.cirurgias.map((c) => ({
        user_id: userId,
        exemplo: true,
        hospital_id: idDe(c.hospital),
        data: c.data,
        paciente: c.paciente,
        procedimento: c.procedimento,
        convenio: c.convenio,
        valor: c.valor,
        origem: 'whatsapp',
        funcao: c.funcao,
        cobrancas: c.cobrancas,
        cobrada_em: c.cobrancas.at(-1) ?? null,
      })),
    )
    .select(CIRURGIA);
  if (erroC || !cirurgias) throw new Error(`[medico] exemplo falhou: ${erroC?.message}`);
  let abertas = cirurgias.map(cirurgiaDe);

  for (const d of ex.demonstrativos) {
    const hospital_id = idDe(d.hospital);
    const itens = casarItens(d.itens, abertas, hospital_id);
    const { data: novo } = await db
      .from('medico_demonstrativos')
      .insert({
        user_id: userId,
        exemplo: true,
        hospital_id,
        referencia: d.referencia,
        recebido_em: d.recebido_em,
        valor_total: totalDosItens(d.itens),
        itens,
        nota_pedida_em: d.nota_pedida_em,
        nota_numero: d.nota_numero,
        nota_emitida_em: d.nota_emitida_em,
        nota_enviada_em: d.nota_enviada_em,
        pago_em: d.pago_em,
        valor_pago: d.valor_pago,
      })
      .select('id')
      .single();
    if (!novo) continue;
    const ids = itens.filter((i) => i.cirurgia_id).map((i) => i.cirurgia_id!) as string[];
    if (ids.length > 0) {
      await db.from('medico_cirurgias').update({ demonstrativo_id: novo.id }).eq('user_id', userId).in('id', ids);
      abertas = abertas.map((c) => (ids.includes(c.id) ? { ...c, demonstrativo_id: novo.id as string } : c));
    }
  }

  const { data: config } = await db.from('medico_config').select('user_id').eq('user_id', userId).maybeSingle();
  if (!config) await salvarConfig(userId, ex.config);
}

/** Registra que estas cirurgias entraram numa cobrança hoje (uma data por dia, sem repetir). */
export async function registrarCobranca(userId: string, cirurgias: Cirurgia[], hoje: string): Promise<void> {
  const db = getServerSupabase();
  await Promise.all(
    cirurgias.map((c) =>
      db
        .from('medico_cirurgias')
        .update({ cobrada_em: hoje, cobrancas: c.cobrancas.includes(hoje) ? c.cobrancas : [...c.cobrancas, hoje] })
        .eq('user_id', userId)
        .eq('id', c.id),
    ),
  );
}

/** Um demonstrativo do usuário, com o hospital. Null se não é dele. */
export async function demonstrativoDoUsuario(userId: string, id: string): Promise<{ d: Demonstrativo; hospital: Hospital } | null> {
  const db = getServerSupabase();
  const { data } = await db.from('medico_demonstrativos').select(DEMONSTRATIVO).eq('user_id', userId).eq('id', id).maybeSingle();
  if (!data) return null;
  const d = demonstrativoDe(data);
  const { data: h } = await db.from('medico_hospitais').select(HOSPITAL).eq('user_id', userId).eq('id', d.hospital_id).maybeSingle();
  return h ? { d, hospital: h as Hospital } : null;
}
