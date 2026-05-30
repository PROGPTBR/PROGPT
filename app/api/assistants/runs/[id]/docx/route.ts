import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getRunForOwner } from '@/lib/assistants/runs';
import { mdToDocxBuffer } from '@/lib/assistants/docx';
import { getUserLogoBuffer } from '@/lib/db/user-logos';
import { getUserCompany } from '@/lib/db/user-company';
import { classifyItems } from '@/lib/assistants/kraljic';
import { renderKraljicChartPng } from '@/lib/assistants/kraljic-chart';
import type {
  RfpParams,
  KraljicParams,
  PorterParams,
  FinancialParams,
  AbcParams,
  NegotiationStrategyParams,
  NegotiationTranscriptTurn,
  ScorecardParams,
} from '@/lib/assistants/types';
import { classifyAbc } from '@/lib/assistants/abc';
import { renderAbcChartPng } from '@/lib/assistants/abc-chart';
import { scoreSuppliers } from '@/lib/assistants/scorecard';
import { renderScorecardChartPng } from '@/lib/assistants/scorecard-chart';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/assistants/runs/[id]/docx — download the generated RFP as .docx.
// Renders on-demand from output_md (source of truth); no blob persisted.
//
// Owner-gated: getRunForOwner() filters by user_id. Non-owners receive 404
// (not 403) to avoid revealing run existence.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const run = await getRunForOwner(params.id, user.id);
  if (!run) return new NextResponse('Not Found', { status: 404 });
  if (run.status !== 'done' || !run.output_md) {
    return NextResponse.json({ error: 'not_ready', status: run.status }, { status: 409 });
  }

  const [logo, company] = await Promise.all([
    getUserLogoBuffer(user.id),
    getUserCompany(user.id),
  ]);

  let titleSafe: string;
  let categoryForCover: string | null | undefined;
  let kraljicChartPng: Buffer | undefined;
  let abcChartPng: Buffer | undefined;
  let scorecardChartPng: Buffer | undefined;

  if (run.assistant_type === 'kraljic') {
    const kp = run.params as KraljicParams;
    titleSafe = `Análise Kraljic - ${kp.portfolioName}`.slice(0, 120);
    categoryForCover = 'Análise de portfólio (Kraljic)';
    try {
      const classified = classifyItems(kp.items);
      kraljicChartPng = await renderKraljicChartPng(classified);
    } catch (err) {
      console.warn('[docx] kraljic chart render failed:', err);
    }
  } else if (run.assistant_type === 'porter') {
    const pp = run.params as PorterParams;
    titleSafe = `5 Forças de Porter - ${pp.categoria}`.slice(0, 120);
    categoryForCover = pp.segmento || pp.categoria;
  } else if (run.assistant_type === 'financial') {
    const fp = run.params as FinancialParams;
    titleSafe = `Análise Financeira - ${fp.supplierName}`.slice(0, 120);
    categoryForCover = fp.referenceYear
      ? `Análise financeira ${fp.referenceYear}`
      : 'Análise financeira de fornecedor';
  } else if (run.assistant_type === 'abc') {
    const ap = run.params as AbcParams;
    titleSafe = `Análise ABC - ${ap.analysisName}`.slice(0, 120);
    categoryForCover = ap.analysisPeriod
      ? `Análise ABC ${ap.analysisPeriod}`
      : 'Análise ABC / Curva de Pareto';
    try {
      const analysis = classifyAbc(ap);
      abcChartPng = await renderAbcChartPng(analysis);
    } catch (err) {
      console.warn('[docx] abc chart render failed:', err);
    }
  } else if (run.assistant_type === 'scorecard') {
    const sp = run.params as unknown as ScorecardParams;
    titleSafe = `Scorecard de Fornecedores - ${sp.scorecardName}`.slice(0, 120);
    categoryForCover = 'Scorecard de fornecedores';
    try {
      scorecardChartPng = await renderScorecardChartPng(scoreSuppliers(sp), sp.thresholds);
    } catch (err) {
      console.warn('[docx] scorecard chart render failed:', err);
    }
  } else if (run.assistant_type === 'negotiation') {
    const np = run.params as NegotiationStrategyParams;
    titleSafe = `Estratégia de Negociação - ${np.supplierName}`.slice(0, 120);
    categoryForCover = np.category;
  } else {
    const rfpParams = run.params as RfpParams;
    const scope = rfpParams.scope ?? 'RFP';
    titleSafe = `RFP - ${scope}`.slice(0, 120);
    categoryForCover = rfpParams.category;
  }

  // Para negociação: append do transcript no final do output_md (se existir).
  // Mantém output_md no DB intocado — só concatena pra renderização.
  let bodyMd = run.output_md;
  if (run.assistant_type === 'negotiation' && run.transcript) {
    const transcript = run.transcript as NegotiationTranscriptTurn[];
    if (transcript.length > 0) {
      const np = run.params as NegotiationStrategyParams;
      const transcriptLines: string[] = [
        '',
        '---',
        '',
        '## Transcript da Simulação',
        '',
        `Conversação registrada entre o comprador (você) e a IA personificando ${np.supplierName}.`,
        '',
      ];
      for (let i = 0; i < transcript.length; i++) {
        const t = transcript[i]!;
        const speaker = t.role === 'user' ? 'Comprador' : np.supplierName;
        transcriptLines.push(`**[${i + 1}] ${speaker}:**`);
        transcriptLines.push('');
        transcriptLines.push(t.content);
        transcriptLines.push('');
      }
      bodyMd = bodyMd + '\n' + transcriptLines.join('\n');
    }
  }

  const buf = await mdToDocxBuffer(bodyMd, titleSafe, {
    logo: logo ?? undefined,
    cover: {
      title: titleSafe,
      category: categoryForCover,
      company,
    },
    kraljicChartPng,
    abcChartPng,
    scorecardChartPng,
  });

  // Filename derived from run id (no PII), browser saves it as a .docx.
  const filename = `${run.assistant_type}-${run.id.slice(0, 8)}.docx`;
  return new NextResponse(buf as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buf.length),
    },
  });
}
