import { NextResponse } from 'next/server';

import { medicoOuErro } from '@/lib/medico/acesso-servidor';
import { criarCirurgias, criarDemonstrativo, criarHospital, RECURSOS, RegraMedica, type Recurso } from '@/lib/medico/service';
import { CirurgiasSchema, DemonstrativoSchema, HospitalSchema } from '@/lib/medico/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const invalido = (message: string) => NextResponse.json({ error: 'invalid_body', message }, { status: 400 });

// POST /api/medico/{hospitais|cirurgias|demonstrativos}
export async function POST(req: Request, { params }: { params: { recurso: string } }) {
  const u = await medicoOuErro();
  if (u instanceof NextResponse) return u;
  if (!RECURSOS.includes(params.recurso as Recurso)) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const json = await req.json().catch(() => null);

  try {
    if (params.recurso === 'hospitais') {
      const body = HospitalSchema.safeParse(json);
      if (!body.success) return invalido('Informe o nome do hospital.');
      const hospital = await criarHospital(u.id, body.data);
      if (!hospital) return NextResponse.json({ error: 'persist_failed', message: 'Não foi possível salvar agora.' }, { status: 500 });
      return NextResponse.json({ hospital });
    }
    if (params.recurso === 'cirurgias') {
      const body = CirurgiasSchema.safeParse(json);
      if (!body.success) return invalido('Cada cirurgia precisa de hospital, data e paciente.');
      return NextResponse.json({ cirurgias: await criarCirurgias(u.id, body.data.cirurgias) });
    }
    const body = DemonstrativoSchema.safeParse(json);
    if (!body.success) return invalido('O demonstrativo precisa de hospital, data de recebimento e pelo menos uma linha com paciente.');
    return NextResponse.json(await criarDemonstrativo(u.id, body.data));
  } catch (err) {
    if (err instanceof RegraMedica) return invalido(err.message);
    console.error('[medico] gravação falhou:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'persist_failed', message: 'Não foi possível salvar agora.' }, { status: 500 });
  }
}
