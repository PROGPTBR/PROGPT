import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import {
  buscarNaVendorList,
  categoriasDistintas,
  equipeDoUsuario,
} from '@/lib/suppliers/busca-ampliada';
import {
  buscarFornecedoresNaWeb,
  carregarVendorListDaEquipe,
  escolherCategorias,
} from '@/lib/suppliers/busca-ampliada-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Busca ampliada (sub-projeto 73): vendor list da equipe + internet, só para
// as equipes de lib/suppliers/busca-ampliada.ts. Quem não está liberado
// recebe 404 — a rota não existe para essa pessoa.

async function equipeOu404() {
  const user = await getCurrentUser();
  if (!user) return { erro: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };
  const equipe = equipeDoUsuario(user.email);
  if (!equipe) return { erro: NextResponse.json({ error: 'not_found' }, { status: 404 }) };
  return { equipe };
}

/** Quantos fornecedores a vendor list da equipe tem (cartão da tela de busca). */
export async function GET(): Promise<Response> {
  const r = await equipeOu404();
  if (r.erro) return r.erro;
  try {
    const rows = await carregarVendorListDaEquipe(r.equipe);
    return NextResponse.json({
      equipe: r.equipe.nome,
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
  const r = await equipeOu404();
  if (r.erro) return r.erro;

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
  }

  // Vendor list e internet em paralelo; uma falhar não derruba a outra.
  const vendorListP = parte === 'web' ? Promise.resolve(null as never) : (async () => {
    try {
      const rows = await carregarVendorListDaEquipe(r.equipe);
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
}
