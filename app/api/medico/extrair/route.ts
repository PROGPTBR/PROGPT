import { NextResponse } from 'next/server';
import { z } from 'zod';

import { checkChatRateLimit } from '@/lib/rate-limit';
import { medicoOuErro } from '@/lib/medico/acesso-servidor';
import { extrairCirurgias, extrairDemonstrativo } from '@/lib/medico/extrair';
import { hojeEmBrasilia } from '@/lib/vitrine/datas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  tipo: z.enum(['cirurgias', 'demonstrativo']),
  texto: z.string().trim().min(10).max(400_000),
  hospitais: z.array(z.string().max(120)).max(50).default([]),
});

// POST /api/medico/extrair: a IA lê a lista de cirurgias (WhatsApp, anotações)
// ou o demonstrativo do hospital. Só devolve a leitura; quem grava é o médico,
// depois de conferir.
export async function POST(req: Request) {
  const u = await medicoOuErro();
  if (u instanceof NextResponse) return u;

  const limite = await checkChatRateLimit();
  if (!limite.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'Muitas leituras em pouco tempo. Aguarde um minuto e tente de novo.' },
      { status: 429 },
    );
  }

  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: 'invalid_body', message: 'Cole o texto ou importe o arquivo antes de pedir a leitura.' }, { status: 400 });
  }

  try {
    const hoje = hojeEmBrasilia();
    const { tipo, texto, hospitais } = body.data;
    const leitura =
      tipo === 'cirurgias' ? await extrairCirurgias(texto, hoje, hospitais, u.id) : await extrairDemonstrativo(texto, hoje, u.id);
    return NextResponse.json({ leitura });
  } catch (err) {
    console.error('[medico] leitura por IA falhou:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'falhou', message: 'Não foi possível ler o texto agora. Tente de novo em instantes.' },
      { status: 500 },
    );
  }
}
