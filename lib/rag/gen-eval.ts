import { z } from 'zod';
import { getOpenAI } from '@/lib/llm/openai';

// ── Generation-quality eval ──────────────────────────────────────────────────
//
// The CI gate (`npm run rag:eval`, recall@5) measures RETRIEVAL only — whether
// the right chunks surface. It says nothing about the quality of the generated
// answer. This module is the missing half: an offline LLM-as-judge harness that
// scores generated answers against a rubric, so a model flip (or a prompt edit)
// can be validated instead of trusted on faith.
//
// Deliberately NOT a CI gate: it calls live generation + a judge model per case
// (real $), and the answer depends on the generation model under test. Run it
// manually via `npm run eval:gen` to A/B models before promoting a tier.
//
// Judge model MUST differ from the model under test (self-preference bias).

export const GEN_DIMENSIONS = {
  framework_coverage:
    'Cobertura completa do framework: quando o tema tem N elementos nomeados (4 quadrantes Kraljic, 5 forças Porter, 7 etapas Monczka), aborda TODOS — não seleciona só os óbvios.',
  authorship:
    'Cita autor + ano quando o tema central é um framework canônico (Kraljic/HBR 1983, Porter 1979, Ellram 1993, Cox 1996, Williamson 1985).',
  practical_depth:
    'Aplicação prática com substância: threshold mensurável, ferramenta concreta, cadência de revisão e/ou armadilha a evitar — não generalidades vazias do tipo "mapeie suas categorias".',
  structure:
    'Markdown estruturado adequado: tabela ou bullets com **bold** para frameworks 2D e enumerações; prosa para conceitos abstratos. Nunca enumeração enterrada em prosa corrida.',
  instruction_following:
    'Segue as regras do produto: PEDE o material faltante quando o usuário referencia algo que não foi colado; redireciona para a ferramenta /assistants/* quando o pedido é de artefato pronto; NÃO recusa ("Não tenho fonte") e responde no mesmo fôlego; não inventa fonte/autor/teoria.',
} as const;

export type GenDimension = keyof typeof GEN_DIMENSIONS;

export type GenGoldenCase = {
  id: string;
  question: string;
  language: 'pt' | 'en';
  intent: string;
  /** Which rubric dimensions apply to this case (subset of GEN_DIMENSIONS). */
  dimensions: GenDimension[];
  /** Binary, case-specific checks the answer must satisfy to pass. */
  mustChecks: string[];
  /** Optional extra guidance shown to the judge. */
  notes?: string;
};

/** Holistic 1–5 floor for a passing answer (combined with all-checks-pass). */
export const GEN_PASS_OVERALL = 3.5;

export const JudgeResultSchema = z.object({
  dimensionScores: z.array(
    z.object({
      key: z.string(),
      score: z.number().min(1).max(5),
      reason: z.string(),
    }),
  ),
  checks: z.array(z.object({ check: z.string(), pass: z.boolean() })),
  overall: z.number().min(1).max(5),
});
export type GenJudgeResult = z.infer<typeof JudgeResultSchema>;

export type GenEvalRow = {
  id: string;
  question: string;
  answer: string;
  judge: GenJudgeResult;
  verdict: 'pass' | 'fail';
};

export type GenEvalSummary = {
  total: number;
  passed: number;
  passRate: number;
  avgOverall: number;
  /** Average score per dimension key across the cases that exercised it. */
  byDimension: Record<string, number>;
  /** Fraction of all must-checks (across all cases) that passed. */
  checkPassRate: number;
};

export const JUDGE_SYSTEM = `Você é um avaliador sênior e RIGOROSO de respostas sobre procurement (compras corporativas), com formação acadêmica clássica (Kraljic, Porter, Monczka, Cox, Ellram, Williamson). Sua tarefa é PONTUAR a resposta de um assistente de IA contra uma rubrica, NÃO reescrevê-la.

Regras:
- Pontue cada dimensão aplicável de 1 a 5 (1 = falha grave, 3 = aceitável, 5 = excelente nível expert). Seja crítico: uma resposta "de textbook B-grade", correta mas genérica, não passa de 3.
- Avalie cada "must-check" como pass=true SOMENTE se a resposta o satisfaz claramente; na dúvida, pass=false.
- Dê uma nota "overall" holística de 1 a 5 que reflita se um gestor de compras sênior consideraria a resposta de alta qualidade.
- Responda SEMPRE com JSON estrito conforme o schema; sem texto fora do JSON. Em "reason" seja conciso (1 frase).`;

export function buildJudgePrompt(
  c: GenGoldenCase,
  answer: string,
): { system: string; user: string } {
  const dimLines = c.dimensions
    .map((d) => `- **${d}**: ${GEN_DIMENSIONS[d]}`)
    .join('\n');
  const checkLines = c.mustChecks.map((m) => `- ${m}`).join('\n');

  const user = `## Pergunta do usuário
${c.question}

## Resposta do assistente (a ser avaliada)
${answer}

## Dimensões a pontuar (1-5 cada)
${dimLines}

## Must-checks (pass/fail — repita o texto EXATO de cada um no campo "check")
${checkLines}
${c.notes ? `\n## Observação para o avaliador\n${c.notes}\n` : ''}
## Formato de saída (JSON estrito)
{
  "dimensionScores": [{ "key": "<chave da dimensão>", "score": <1-5>, "reason": "<1 frase>" }],
  "checks": [{ "check": "<texto exato do must-check>", "pass": <true|false> }],
  "overall": <1-5>
}`;

  return { system: JUDGE_SYSTEM, user };
}

export function deriveVerdict(
  j: Pick<GenJudgeResult, 'overall' | 'checks'>,
  threshold: number = GEN_PASS_OVERALL,
): 'pass' | 'fail' {
  const allChecksPass = j.checks.every((c) => c.pass);
  return j.overall >= threshold && allChecksPass ? 'pass' : 'fail';
}

export function aggregate(rows: GenEvalRow[]): GenEvalSummary {
  const total = rows.length;
  const passed = rows.filter((r) => r.verdict === 'pass').length;

  const overalls = rows.map((r) => r.judge.overall);
  const avgOverall =
    overalls.length > 0 ? overalls.reduce((a, b) => a + b, 0) / overalls.length : 0;

  // Per-dimension average across the rows that scored that dimension.
  const dimSum: Record<string, number> = {};
  const dimCount: Record<string, number> = {};
  for (const r of rows) {
    for (const d of r.judge.dimensionScores) {
      dimSum[d.key] = (dimSum[d.key] ?? 0) + d.score;
      dimCount[d.key] = (dimCount[d.key] ?? 0) + 1;
    }
  }
  const byDimension: Record<string, number> = {};
  for (const key of Object.keys(dimSum)) {
    const sum = dimSum[key] ?? 0;
    const cnt = dimCount[key] ?? 0;
    byDimension[key] = cnt > 0 ? sum / cnt : 0;
  }

  const allChecks = rows.flatMap((r) => r.judge.checks);
  const checkPassRate =
    allChecks.length > 0
      ? allChecks.filter((c) => c.pass).length / allChecks.length
      : 1;

  return {
    total,
    passed,
    passRate: total > 0 ? passed / total : 0,
    avgOverall,
    byDimension,
    checkPassRate,
  };
}

export async function judgeAnswer(
  c: GenGoldenCase,
  answer: string,
  opts: { judgeModel: string },
): Promise<GenJudgeResult> {
  const ai = getOpenAI();
  const { system, user } = buildJudgePrompt(c, answer);
  const res = await ai.chat.completions.create({
    model: opts.judgeModel,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    response_format: { type: 'json_object' },
    max_completion_tokens: 1024,
  });
  const text = res.choices[0]?.message?.content ?? '';
  return JudgeResultSchema.parse(JSON.parse(text));
}
