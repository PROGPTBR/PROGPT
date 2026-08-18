import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser, NotAuthenticated } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Espelho servidor do Simulador Tributário (SN x Reforma).
//
// O simulador (bundle React em /simulador-sn-reforma.html) guarda as simulações
// em localStorage (chave `statos.simulador.local.v1`) como um array de clientes:
//   [{ id, nome, cnpj, versoes: [{ id, versao, dados, criadoEm }] }]
//
// O script-ponte (public/simulador-bridge.js) usa estes DOIS caminhos, que o
// fetch-mock do bundle NÃO intercepta (namespace /api/simulador/*):
//   - GET  /api/simulador/sync  → devolve o array (na forma do localStorage)
//                                  para hidratar o navegador ao abrir.
//   - POST /api/simulador/sync  → recebe o array inteiro e substitui o conjunto
//                                  do usuário (upsert + apaga o que sumiu).
//
// Owner-scoped: service-role + filtro user_id explícito (defesa em profundidade
// sobre a RLS owner-only da migration 0046).

const VersaoSchema = z
  .object({
    id: z.string().min(1),
    versao: z.number(),
    dados: z.unknown(),
    criadoEm: z.string(),
  })
  .passthrough();

const ClienteSchema = z
  .object({
    id: z.string().min(1),
    nome: z.string().min(1).max(200),
    cnpj: z.union([z.string(), z.null()]).optional(),
    versoes: z.array(VersaoSchema).max(200),
  })
  .passthrough();

const BodySchema = z.array(ClienteSchema).max(500);

function onlyDigits(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const d = v.replace(/\D/g, '');
  return d ? d.slice(0, 14) : null;
}

export async function GET() {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof NotAuthenticated) {
      return NextResponse.json({ erro: 'não autenticado' }, { status: 401 });
    }
    throw err;
  }

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('simulador_simulacoes')
    .select('cliente_id, nome, cnpj, versoes')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    return NextResponse.json({ erro: 'falha ao ler simulações' }, { status: 500 });
  }

  // Reconstrói exatamente a forma que o bundle espera no localStorage.
  const clientes = (data ?? []).map((row) => ({
    id: row.cliente_id,
    nome: row.nome,
    cnpj: row.cnpj ?? null,
    versoes: Array.isArray(row.versoes) ? row.versoes : [],
  }));

  return NextResponse.json(clientes);
}

export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof NotAuthenticated) {
      return NextResponse.json({ erro: 'não autenticado' }, { status: 401 });
    }
    throw err;
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ erro: 'json inválido' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ erro: 'formato inválido' }, { status: 400 });
  }
  const clientes = parsed.data;

  const supabase = getServerSupabase();

  // Substitui o conjunto do usuário: upsert dos presentes + apaga os ausentes.
  const now = new Date().toISOString();
  const rows = clientes.map((c) => ({
    user_id: user.id,
    cliente_id: c.id,
    nome: c.nome,
    cnpj: onlyDigits(c.cnpj ?? null),
    versoes: c.versoes,
    updated_at: now,
  }));

  if (rows.length > 0) {
    const { error: upErr } = await supabase
      .from('simulador_simulacoes')
      .upsert(rows, { onConflict: 'user_id,cliente_id' });
    if (upErr) {
      return NextResponse.json({ erro: 'falha ao salvar' }, { status: 500 });
    }
  }

  // Apaga clientes que o usuário removeu (não vieram no array).
  const keepIds = clientes.map((c) => c.id);
  let delQuery = supabase
    .from('simulador_simulacoes')
    .delete()
    .eq('user_id', user.id);
  if (keepIds.length > 0) {
    // PostgREST: not-in com lista entre parênteses.
    delQuery = delQuery.not(
      'cliente_id',
      'in',
      `(${keepIds.map((id) => `"${id.replace(/"/g, '')}"`).join(',')})`,
    );
  }
  const { error: delErr } = await delQuery;
  if (delErr) {
    return NextResponse.json({ erro: 'falha ao sincronizar remoções' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, count: rows.length });
}
