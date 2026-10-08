import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { supabaseServer } from '@/lib/db/supabase-server';
import { buscarNaVendorList, categoriasDistintas, type FornecedorVendorList } from '@/lib/suppliers/busca-ampliada';
import { escolherCategorias } from '@/lib/suppliers/busca-ampliada-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// "Perguntar à IA" na Minha base de fornecedores (2026-10-07): o comprador
// escreve como no ChatGPT ("material para alvenaria em SP") e a IA escolhe os
// grupos da PRÓPRIA base que atendem; o ranking puro ordena. Lê com o cliente
// do usuário (RLS owner-only): só a base de quem pergunta.

const BodySchema = z.object({ consulta: z.string().trim().min(2).max(300) });

export async function POST(req: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const rl = await checkChatRateLimit();
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', retry_after_secs: rl.retryAfterSecs },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSecs) } },
    );
  }

  const body = BodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  const { consulta } = body.data;

  const { data, error } = await supabaseServer()
    .from('suppliers')
    .select('id, razao_social, nome_fantasia, cnpj, categoria, municipio, uf, telefone, email, notas')
    .limit(5000);
  if (error) {
    console.error('[base-ia] leitura falhou:', error.message);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }

  type Row = { id: string; razao_social: string; nome_fantasia: string | null; cnpj: string | null; categoria: string | null; municipio: string | null; uf: string | null; telefone: string | null; email: string | null; notas: string | null };
  const rows: FornecedorVendorList[] = ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    razaoSocial: r.razao_social,
    nomeFantasia: r.nome_fantasia,
    cnpj: r.cnpj,
    categoria: r.categoria,
    municipio: r.municipio,
    uf: r.uf,
    telefone: r.telefone,
    email: r.email,
    notas: r.notas,
  }));
  const categorias = await escolherCategorias(consulta, categoriasDistintas(rows));
  const resultados = buscarNaVendorList(rows, consulta, categorias).map((r) => ({ id: r.id!, motivo: r.motivo }));
  return NextResponse.json({ consulta, categorias, resultados });
}
