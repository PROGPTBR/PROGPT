import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth';
import { lerNfeXml, pareceNfe } from '@/lib/recebimento/nfe-xml';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Lê o XML de uma NF-e para a Calculadora da Reforma: itens com NCM, valor e,
// quando a nota já traz, o CST, o cClassTrib e a CBS/IBS destacados.
export async function POST(req: Request) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  let file: File | null = null;
  try {
    const f = (await req.formData()).get('file');
    if (f instanceof File) file = f;
  } catch {
    return NextResponse.json({ error: 'invalid_form' }, { status: 400 });
  }
  if (!file) return NextResponse.json({ error: 'missing_file', message: 'Escolha o XML da nota.' }, { status: 400 });
  if (file.size > 2 * 1024 * 1024) return NextResponse.json({ error: 'too_large', message: 'XML com mais de 2 MB.' }, { status: 400 });

  const texto = Buffer.from(await file.arrayBuffer()).toString('utf8');
  if (!pareceNfe(texto)) {
    return NextResponse.json({ error: 'nao_nfe', message: 'Este arquivo não é o XML de uma NF-e.' }, { status: 400 });
  }
  try {
    const nota = lerNfeXml(texto);
    return NextResponse.json({
      nota: {
        numero: nota.numero,
        emitente: nota.emitente_nome,
        data: nota.data_emissao,
        itens: nota.itens.map((i) => ({
          descricao: i.descricao,
          ncm: i.ncm,
          valor: i.valor_total ?? (i.quantidade ?? 0) * (i.valor_unitario ?? 0),
          quantidade: i.quantidade,
          unidade: i.unidade,
          ibscbs: i.ibscbs ?? null,
        })),
      },
    });
  } catch {
    return NextResponse.json({ error: 'nao_lido', message: 'Não foi possível ler este XML.' }, { status: 400 });
  }
}
