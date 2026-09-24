import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireUser, NotAuthenticated } from '@/lib/auth';
import { cidadesNoRaio, MAX_CIDADES } from '@/lib/suppliers/proximity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Cidades dentro de um raio da obra. O cálculo roda no servidor porque a
// tabela de coordenadas dos 5.570 municípios (417 KB) não deve ir pro bundle
// do navegador. Não toca banco nenhum — é lookup em memória.

const Query = z.object({
  uf: z.string().trim().length(2),
  cidade: z.string().trim().min(1).max(150),
  raio: z.coerce.number().int().min(0).max(500),
});

export async function GET(req: Request) {
  try {
    await requireUser();
  } catch (err) {
    if (err instanceof NotAuthenticated) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    throw err;
  }

  const url = new URL(req.url);
  const parsed = Query.safeParse({
    uf: url.searchParams.get('uf') ?? '',
    cidade: url.searchParams.get('cidade') ?? '',
    raio: url.searchParams.get('raio') ?? '0',
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_query', message: 'Informe estado, cidade e raio.' },
      { status: 400 },
    );
  }

  const cidades = cidadesNoRaio({
    uf: parsed.data.uf,
    cidade: parsed.data.cidade,
    raioKm: parsed.data.raio,
    limite: MAX_CIDADES,
  });

  if (cidades.length === 0) {
    return NextResponse.json(
      {
        error: 'cidade_desconhecida',
        message: 'Não encontramos essa cidade na base do IBGE.',
        cidades: [],
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    origem: { uf: parsed.data.uf.toUpperCase(), cidade: cidades[0]!.nome },
    raioKm: parsed.data.raio,
    // `limitado` avisa a UI que o raio pegou mais cidades do que cabe.
    limitado: cidades.length >= MAX_CIDADES,
    cidades: cidades.map((c) => ({
      // `id` é o código IBGE — mesmo identificador que a lista de cidades
      // da UI usa, então dá pra mesclar na seleção sem duplicar.
      id: c.id,
      nome: c.nome,
      uf: c.uf,
      distanciaKm: c.distanciaKm,
    })),
  });
}
