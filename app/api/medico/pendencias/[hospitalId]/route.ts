import { NextResponse } from 'next/server';

import { medicoOuErro } from '@/lib/medico/acesso-servidor';
import { paraCobrar } from '@/lib/medico/conciliacao';
import { nomeDoArquivo, planilhaDePendencias } from '@/lib/medico/planilha-pendencias';
import { carregarEstado, registrarCobranca } from '@/lib/medico/service';
import { hojeEmBrasilia } from '@/lib/vitrine/datas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/medico/pendencias/{hospitalId}: a planilha de pendências do
// hospital, no modelo que ele exige, para baixar.
export async function GET(_req: Request, { params }: { params: { hospitalId: string } }) {
  const u = await medicoOuErro();
  if (u instanceof NextResponse) return u;
  const hoje = hojeEmBrasilia();
  const estado = await carregarEstado(u.id);
  const hospital = estado.hospitais.find((h) => h.id === params.hospitalId);
  const abertas = paraCobrar(estado.cirurgias, estado.demonstrativos, params.hospitalId, hoje);
  if (!hospital || abertas.length === 0) return NextResponse.json({ error: 'not_found', message: 'Não há pendências nesse hospital.' }, { status: 404 });

  const buf = await planilhaDePendencias(abertas, estado.config);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nomeDoArquivo(hospital, estado.config, hoje)}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

// POST /api/medico/pendencias/{hospitalId}: o médico mandou a planilha por
// conta própria; registra a cobrança de hoje em cada pendência do hospital.
export async function POST(_req: Request, { params }: { params: { hospitalId: string } }) {
  const u = await medicoOuErro();
  if (u instanceof NextResponse) return u;
  const hoje = hojeEmBrasilia();
  const estado = await carregarEstado(u.id);
  const abertas = paraCobrar(estado.cirurgias, estado.demonstrativos, params.hospitalId, hoje);
  if (abertas.length === 0) return NextResponse.json({ error: 'not_found', message: 'Não há pendências nesse hospital.' }, { status: 404 });
  await registrarCobranca(u.id, abertas, hoje);
  return NextResponse.json({ ok: true, cobradas: abertas.length });
}
