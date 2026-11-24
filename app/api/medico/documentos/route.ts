import { NextResponse } from 'next/server';

import { medicoOuErro } from '@/lib/medico/acesso-servidor';
import { guardarDocumento } from '@/lib/medico/documentos';
import { RegraMedica } from '@/lib/medico/service';
import type { TipoDeDocumento } from '@/lib/medico/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/medico/documentos (multipart): guarda um documento do médico
// (nota, demonstrativo, comprovante...), solto ou ligado a um recebimento.
export async function POST(req: Request) {
  const u = await medicoOuErro();
  if (u instanceof NextResponse) return u;
  const fd = await req.formData().catch(() => null);
  const f = fd?.get('arquivo');
  if (!fd || !(f instanceof File)) return NextResponse.json({ error: 'invalid_body', message: 'Escolha o arquivo.' }, { status: 400 });
  const demonstrativoId = String(fd.get('demonstrativo_id') ?? '');
  try {
    const documento = await guardarDocumento(
      u.id,
      { nome: f.name || 'arquivo', buf: Buffer.from(await f.arrayBuffer()), mime: f.type },
      String(fd.get('tipo') ?? 'outro') as TipoDeDocumento,
      /^[0-9a-f-]{36}$/i.test(demonstrativoId) ? demonstrativoId : null,
    );
    return NextResponse.json({ documento });
  } catch (err) {
    if (err instanceof RegraMedica) return NextResponse.json({ error: 'invalid_body', message: err.message }, { status: 400 });
    console.error('[medico/documentos]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'persist_failed', message: 'Não foi possível guardar o arquivo agora.' }, { status: 500 });
  }
}
