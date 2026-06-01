#!/usr/bin/env tsx
import { config } from 'dotenv';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

config({ path: resolve(process.cwd(), '.env.local') });

import { getOpenAI, getOpenAIModel } from '@/lib/llm/openai';
import { runRag } from '@/lib/rag';
import {
  aggregate,
  deriveVerdict,
  judgeAnswer,
  type GenEvalRow,
  type GenGoldenCase,
} from '@/lib/rag/gen-eval';

// ── Generation-quality eval runner ───────────────────────────────────────────
//
// For each golden case: run the REAL chat pipeline (runRag → system+user) to
// produce an answer with the model under test, then score it with an LLM judge
// (a stronger, DIFFERENT model) against the case rubric.
//
// Usage:
//   npm run eval:gen                         # model = generation tier, judge = gpt-4o
//   npm run eval:gen -- --model gpt-4.1-mini # A/B a candidate generation model
//   npm run eval:gen -- --judge gpt-4o --limit 3
//
// NOT a CI gate: calls live generation + judge per case (real $). Run manually
// to A/B models before promoting OPENAI_MODEL_GENERATION.

function arg(name: string): string | undefined {
  const argv = process.argv.slice(2);
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  const i = argv.indexOf(`--${name}`);
  if (i >= 0) {
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) return next;
  }
  return undefined;
}

async function generate(
  genModel: string,
  system: string,
  user: string,
): Promise<string> {
  const ai = getOpenAI();
  const res = await ai.chat.completions.create({
    model: genModel,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    max_completion_tokens: 1200,
  });
  return res.choices[0]?.message?.content ?? '';
}

async function main() {
  const genModel = arg('model') ?? getOpenAIModel('generation');
  const judgeModel = arg('judge') ?? process.env.OPENAI_JUDGE_MODEL ?? 'gpt-4o';
  const limit = arg('limit') ? Number(arg('limit')) : Infinity;

  // Family-prefix check: judging a model with itself biases scores upward.
  const famGen = genModel.replace(/-\d{4}.*$/, '');
  const famJudge = judgeModel.replace(/-\d{4}.*$/, '');
  if (famGen === famJudge) {
    console.warn(
      `⚠️  judge (${judgeModel}) and model-under-test (${genModel}) share a family — self-preference bias likely. Pass --judge with a different model.`,
    );
  }

  const golden = JSON.parse(
    readFileSync(resolve(process.cwd(), 'scripts/eval/gen-golden.json'), 'utf-8'),
  ) as GenGoldenCase[];
  const cases = golden.slice(0, limit);

  console.log(
    `\nGen-quality eval — ${cases.length} cases | model=${genModel} | judge=${judgeModel}\n`,
  );

  const rows: GenEvalRow[] = [];
  for (const c of cases) {
    try {
      const rag = await runRag(c.question);
      const answer = await generate(genModel, rag.system, rag.user);
      const judge = await judgeAnswer(c, answer, { judgeModel });
      const verdict = deriveVerdict(judge);
      rows.push({ id: c.id, question: c.question, answer, judge, verdict });
      const failedChecks = judge.checks.filter((x) => !x.pass).length;
      console.log(
        `${verdict === 'pass' ? '✅' : '❌'} ${c.id.padEnd(28)} overall=${judge.overall.toFixed(1)} checks=${judge.checks.length - failedChecks}/${judge.checks.length}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`⚠️  ${c.id}: ${msg}`);
    }
  }

  const summary = aggregate(rows);
  console.log('\n── Summary ─────────────────────────────────');
  console.log(`pass rate     : ${(summary.passRate * 100).toFixed(0)}% (${summary.passed}/${summary.total})`);
  console.log(`avg overall   : ${summary.avgOverall.toFixed(2)} / 5`);
  console.log(`check pass    : ${(summary.checkPassRate * 100).toFixed(0)}%`);
  console.log('by dimension  :');
  for (const [k, v] of Object.entries(summary.byDimension)) {
    console.log(`  ${k.padEnd(22)} ${v.toFixed(2)}`);
  }

  const out = {
    ranAt: new Date().toISOString(),
    genModel,
    judgeModel,
    summary,
    rows: rows.map((r) => ({
      id: r.id,
      verdict: r.verdict,
      overall: r.judge.overall,
      checks: r.judge.checks,
      dimensionScores: r.judge.dimensionScores,
      answer: r.answer,
    })),
  };
  writeFileSync(
    resolve(process.cwd(), 'scripts/eval/gen-results.json'),
    JSON.stringify(out, null, 2),
  );
  console.log('\nWrote scripts/eval/gen-results.json');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
