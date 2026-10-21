import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { User } from '@supabase/supabase-js';
import { getCurrentUser } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { withUser } from '@/lib/observability/user-context';
import {
  LIMITE_DIARIO_BUSCA_WEB,
  buscarNaVendorList,
  categoriasDistintas,
  equipeDoUsuario,
} from '@/lib/suppliers/busca-ampliada';
import {
  buscarFornecedoresNaWeb,
  buscasWebNasUltimas24h,
  carregarVendorListDaEquipe,
  carregarVendorListDoUsuario,
  escolherCategorias,
} from '@/lib/suppliers/busca-ampliada-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Busca ampliada (sub-projeto 73): vendor list + internet. Liberada para
// todos os clientes em 2026-10-21. A vendor list é a da equipe (para quem
// está numa equipe de lib/suppliers/busca-ampliada.ts) ou a da própria
// pessoa; a internet tem limite diário por pessoa.

function vendorListDe(user: Pick<User, 'id' | 'email'>) {
  const equipe = equipeDoUsuario(user.email);
  return {
    nome: equipe?.nome ?? null,
    carregar: () => (equipe ? carregarVendorListDaEquipe(equipe) : carregarVendorListDoUsuario(user.id)),
  };
}

/** Quantos fornecedores a vendor list tem (cartão da tela de busca). */
export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const vl = vendorListDe(user);
  try {
    const rows = await vl.carregar();
    return NextResponse.json({
      equipe: vl.nome,
      total: rows.length,
      categorias: categoriasDistintas(rows).length,
    });
  } catch (err) {
    console.error('[busca-ampliada] GET:', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}

// `parte` deixa a tela pedir a vendor list e a internet separadas: a vendor
// list (rápida) aparece na hora e a internet (uns 15 s) chega depois.
const BodySchema = z.object({
  consulta: z.string().trim().min(3).max(500),
  parte: z.enum(['vendorList', 'web', 'tudo']).optional().default('tudo'),
});

export async function POST(req: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = BodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  const { consulta, parte } = body.data;

  // Só a busca na internet conta no limite: é a parte cara.
  if (parte !== 'vendorList') {
    const rl = await checkChatRateLimit();
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'rate_limited', retry_after_secs: rl.retryAfterSecs },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSecs) } },
      );
    }
    if ((await buscasWebNasUltimas24h(user.id)) >= LIMITE_DIARIO_BUSCA_WEB) {
      return NextResponse.json(
        {
          error: 'daily_limit',
          detail: `Você chegou ao limite de ${LIMITE_DIARIO_BUSCA_WEB} buscas na internet em 24 horas. A busca na Receita e na sua base continua funcionando.`,
        },
        { status: 429 },
      );
    }
  }

  // withUser grava o user_id no custo da busca web, que é o que o limite
  // diário conta.
  return withUser(user.id, async () => {
    const vl = vendorListDe(user);
    // Vendor list e internet em paralelo; uma falhar não derruba a outra.
    const vendorListP = parte === 'web' ? Promise.resolve(null as never) : (async () => {
      try {
        const rows = await vl.carregar();
        const categorias = await escolherCategorias(consulta, categoriasDistintas(rows));
        return {
          total: rows.length,
          categorias,
          resultados: buscarNaVendorList(rows, consulta, categorias),
          erro: null as string | null,
        };
      } catch (err) {
        console.error('[busca-ampliada] vendor list:', err);
        return { total: 0, categorias: [], resultados: [], erro: 'Não consegui ler a vendor list agora.' };
      }
    })();

    if (parte === 'vendorList') return NextResponse.json({ consulta, vendorList: await vendorListP });
    if (parte === 'web') return NextResponse.json({ consulta, web: await buscarFornecedoresNaWeb(consulta) });
    const [vendorList, web] = await Promise.all([vendorListP, buscarFornecedoresNaWeb(consulta)]);
    return NextResponse.json({ consulta, vendorList, web });
  });
}
