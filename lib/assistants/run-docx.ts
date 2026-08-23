import type { AssistantRunRow } from '@/lib/assistants/types';
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
import { renderSpendParetoPng } from '@/lib/assistants/spend-chart';
import { renderSwotChartPng } from '@/lib/assistants/negotiation/swot-chart';
import { listInvoicesByRun } from '@/lib/spend/db';
import { buildCubeFromRows } from '@/lib/spend/from-rows';
import type { SpendAnalysisParams } from '@/lib/assistants/types';

// Montagem do .docx de um run — extraída da rota GET .../docx (backlog do
// diretor 2026-08-19, Batch I) porque o .eml precisa do MESMO documento como
// anexo. Um só lugar decide título, capa, gráficos e transcript; as duas
// rotas só embrulham o resultado.
//
// NÃO faz gate de dono: quem chama já resolveu o run via getRunForOwner.

export type RunDocx = { buffer: Buffer; filename: string; title: string };

export async function buildRunDocx(
  run: AssistantRunRow,
  userId: string,
): Promise<RunDocx> {
  if (!run.output_md) throw new Error('run has no output_md');

  const [logo, company] = await Promise.all([
    getUserLogoBuffer(userId),
    getUserCompany(userId),
  ]);

  let titleSafe: string;
  let categoryForCover: string | null | undefined;
  let kraljicChartPng: Buffer | undefined;
  let abcChartPng: Buffer | undefined;
  let scorecardChartPng: Buffer | undefined;
  let spendChartPng: Buffer | undefined;
  let swotChartPng: Buffer | undefined;

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
  } else if (run.assistant_type === 'spend_analysis') {
    const sp = run.params as SpendAnalysisParams;
    titleSafe = `Análise de Gastos - ${sp.analysisName}`.slice(0, 120);
    categoryForCover = sp.period ? `Análise de gastos ${sp.period}` : 'Análise de gastos (Spend Analysis)';
    try {
      const rows = await listInvoicesByRun(run.id);
      const cube = buildCubeFromRows(rows, (sp.referenceCurrency ?? 'BRL').toUpperCase());
      spendChartPng = await renderSpendParetoPng(cube);
    } catch (err) {
      console.warn('[docx] spend chart render failed:', err);
    }
  } else if (run.assistant_type === 'negotiation') {
    const np = run.params as NegotiationStrategyParams;
    titleSafe = `Estratégia de Negociação - ${np.supplierName}`.slice(0, 120);
    categoryForCover = np.category;
    // Matriz SWOT 2x2 no relatório (backlog do diretor 2026-08-19, Batch H).
    // Fail-soft como os demais gráficos: sem estratégia ou erro de render, o
    // .docx sai sem a imagem, com os bullets da SWOT intactos no texto.
    if (run.strategy?.swot) {
      try {
        swotChartPng = await renderSwotChartPng(run.strategy.swot);
      } catch (err) {
        console.warn('[docx] swot chart render failed:', err);
      }
    }
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
    spendChartPng,
    swotChartPng,
  });

  // Filename derivado do id do run (sem PII).
  const filename = `${run.assistant_type}-${run.id.slice(0, 8)}.docx`;
  return { buffer: buf, filename, title: titleSafe };
}
