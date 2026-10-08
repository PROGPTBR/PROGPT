import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Excel do relatório da Busca de Fornecedores (2026-10-08). Recebe o
// relatório já montado na tela (montarRelatorioBusca) e devolve o .xlsx:
// uma aba de resumo e uma aba por seção, com cabeçalho fixo e filtro.

const Celula = z.string().max(2000);
const BodySchema = z.object({
  nomeArquivo: z.string().max(120),
  relatorio: z.object({
    titulo: z.string().max(200),
    geradoEm: z.string().max(60),
    resumo: z.array(z.tuple([Celula, Celula])).max(20),
    secoes: z
      .array(z.object({ titulo: z.string().max(200), colunas: z.array(Celula).max(20), linhas: z.array(z.array(Celula).max(20)).max(5000) }))
      .max(5),
  }),
});

const NOME_ABA: Record<number, string> = { 0: 'Receita Federal', 1: 'Vendor list', 2: 'Internet' };

export async function POST(req: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = BodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  const { relatorio, nomeArquivo } = body.data;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'PROGPT';
  const resumo = wb.addWorksheet('Resumo');
  resumo.addRow(['PROGPT']).font = { bold: true, size: 16 };
  resumo.addRow([relatorio.titulo]).font = { bold: true, size: 13 };
  resumo.addRow([]);
  for (const [k, v] of relatorio.resumo) {
    const r = resumo.addRow([k, v]);
    r.getCell(1).font = { bold: true };
  }
  resumo.getColumn(1).width = 24;
  resumo.getColumn(2).width = 70;

  relatorio.secoes.forEach((secao, i) => {
    const nome = secao.titulo.startsWith('Na sua vendor') ? 'Vendor list' : secao.titulo.startsWith('Na internet') ? 'Internet' : NOME_ABA[i] ?? `Seção ${i + 1}`;
    const ws = wb.addWorksheet(nome, { views: [{ state: 'frozen', ySplit: 1 }] });
    const cab = ws.addRow(secao.colunas);
    cab.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cab.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E8DE1' } }; });
    for (const linha of secao.linhas) ws.addRow(linha);
    secao.colunas.forEach((col, j) => {
      const maior = Math.max(col.length, ...secao.linhas.map((l) => (l[j] ?? '').length));
      ws.getColumn(j + 1).width = Math.min(Math.max(maior + 2, 10), 60);
    });
    if (secao.linhas.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: secao.colunas.length } };
  });

  const buf = await wb.xlsx.writeBuffer();
  const arquivo = nomeArquivo.replace(/[^a-z0-9-]/gi, '') || 'relatorio-fornecedores';
  return new Response(buf as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${arquivo}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
