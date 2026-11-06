import { NextResponse } from 'next/server';

import { requireUser, NotAuthenticated } from '@/lib/auth';
import { NotaInvalida, type ArquivoNota } from './service';
import type { FinalidadeNota } from './types';

// Pedaços comuns das rotas do Recebimento de NF (sub-projeto 95).

export async function usuarioOu401(): Promise<{ id: string; email?: string | null } | NextResponse> {
  try {
    return await requireUser();
  } catch (err) {
    if (err instanceof NotAuthenticated) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    throw err;
  }
}

const FINALIDADES = new Set<FinalidadeNota | 'auto'>(['auto', 'entrega', 'financeira', 'unica']);

/** Lê o multipart com o arquivo da nota e a finalidade escolhida. */
export async function lerUploadDaNota(
  req: Request,
): Promise<{ arquivo: ArquivoNota; finalidade: FinalidadeNota | 'auto' } | NextResponse> {
  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return NextResponse.json({ error: 'invalid_form', message: 'Envio inválido.' }, { status: 400 });
  }
  const f = fd.get('file');
  if (!(f instanceof File) || f.size === 0) {
    return NextResponse.json({ error: 'missing_file', message: 'Escolha o arquivo da nota.' }, { status: 400 });
  }
  const fin = String(fd.get('finalidade') ?? 'auto') as FinalidadeNota | 'auto';
  return {
    arquivo: { buf: Buffer.from(await f.arrayBuffer()), nome: f.name || 'nota', mime: f.type },
    finalidade: FINALIDADES.has(fin) ? fin : 'auto',
  };
}

export function respostaDeErroDaNota(err: unknown): NextResponse {
  if (err instanceof NotaInvalida) {
    return NextResponse.json({ error: 'nota_invalida', message: err.message }, { status: 400 });
  }
  console.error('[recebimento] registrar nota falhou:', err);
  return NextResponse.json(
    { error: 'falhou', message: 'Não foi possível ler a nota agora. Tente de novo em instantes.' },
    { status: 500 },
  );
}
