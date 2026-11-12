import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getCurrentUser } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { sugerirClassificacao } from '@/lib/reforma/servidor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Para cada NCM, testa no motor oficial em quais reduções (anexos da LC 214)
// ele se enquadra. Cache por NCM no servidor.
const Body = z.object({ ncms: z.array(z.string().regex(/^\d{4}\.?\d{2}\.?\d{2}$/)).min(1).max(20) });

export async function POST(req: Request) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const rate = await checkChatRateLimit();
  if (!rate.allowed) return NextResponse.json({ error: 'rate_limited', message: 'Muitas consultas seguidas. Aguarde um minuto.' }, { status: 429 });

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body', message: 'Informe NCMs com 8 dígitos.' }, { status: 400 });
  }
  try {
    const unicos = [...new Set(body.ncms.map((n) => n.replace(/\D/g, '')))];
    const sugestoes = [];
    for (const n of unicos) sugestoes.push(await sugerirClassificacao(n));
    return NextResponse.json({ sugestoes });
  } catch (err) {
    console.error('[reforma] sugerir falhou:', err);
    return NextResponse.json({ error: 'indisponivel', message: 'A calculadora oficial não respondeu agora.' }, { status: 502 });
  }
}
