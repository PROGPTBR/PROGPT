# Supplier Scorecard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Supplier Scorecard" assistant (Strategic Sourcing step 8) that scores/ranks suppliers across weighted criteria, classifies each into estratégico/desenvolvimento/saída by score band, and produces a ranking chart + multi-sheet `.xlsx` + narrative `.docx`.

**Architecture:** Mirror the Kraljic archetype — `buildAssistantHandler` with a deterministic `classify` step (`scoreSuppliers`) feeding an LLM narrative, plus a `@napi-rs/canvas` ranking chart, ExcelJS import/export, and a 4-phase UI (choice→form→generating→done). All shared infra (auth, paywall, rate-limit, retrieval+rerank, trace, run persistence, `mdToDocxBuffer`, refine chat) is reused.

**Tech Stack:** Next.js 14 (Node routes), TypeScript strict, Zod, ExcelJS, `@napi-rs/canvas`, `docx`, OpenAI via Vercel AI SDK, vitest, psycopg (template seed).

**Naming contract (use these exact names in every task):**
- `scoreSuppliers(params: ScorecardParams): ClassifiedSupplier[]`
- Types: `ScorecardCriterion`, `ScorecardSupplier`, `ScorecardParams`, `ScorecardParamsSchema`, `ScorecardRequestSchema`, `ClassifiedSupplier`, `DEFAULT_SCORECARD_CRITERIA`, `SCORECARD_BAND_LABELS`, `SCORECARD_DEFAULT_THRESHOLDS`, `ScorecardBand = 'estrategico'|'desenvolvimento'|'saida'`
- `buildScorecardPrompt(params, classified, template, chunks, company)`, `SCORECARD_SYSTEM_PROMPT`
- `renderScorecardChartPng(classified): Promise<Buffer>`
- `parseScorecardXlsx(buffer): Promise<{ criteria: ScorecardCriterion[]; suppliers: ScorecardSupplier[]; warnings: string[] }>`
- `buildScorecardXlsxBuffer(params, classified, opts): Promise<Buffer>`
- `buildScorecardRefineSystem(outputMd, params, chunks): string`
- generateOp string: `'assistant-scorecard-generate'`

**Scoring contract:** weights normalized so `Σw = 1`; `weightedScore = Σ((score_i/10) × normWeight_i) × 100`, rounded to 1 decimal (0–100). Rank desc, stable on ties. Band: `score ≥ thresholds.strategic (70)` → estrategico; `≥ thresholds.development (40)` → desenvolvimento; else saida.

---

## File Structure

**New files:**
- `lib/assistants/scorecard.ts` — scoring (`scoreSuppliers`) + prompt (`buildScorecardPrompt`)
- `lib/assistants/scorecard-chart.ts` — `renderScorecardChartPng` (horizontal bars)
- `lib/assistants/scorecard-import.ts` — `parseScorecardXlsx`
- `lib/assistants/scorecard-xlsx.ts` — `buildScorecardXlsxBuffer`
- `app/api/assistants/scorecard/route.ts` — main handler
- `app/api/assistants/scorecard/import/route.ts` — xlsx import endpoint
- `app/assistants/scorecard/page.tsx` + `components/assistants/Scorecard{Assistant,Form,SupplierTable,ImportDialog,Result}.tsx`
- `supabase/migrations/00000000000031_scorecard_assistant_type.sql` + `scripts/insert_template_scorecard.py` + `docs/product/templates/scorecard-padrao.md`
- Tests: `tests/lib/assistants/scorecard.test.ts`, `tests/lib/assistants/scorecard-import.test.ts`, `tests/lib/assistants/scorecard-xlsx.test.ts`, `tests/api/assistants/scorecard.test.ts`

**Modified files:**
- `lib/assistants/types.ts` — add types + `'scorecard'` to `AssistantType` union (L12-19) & `ASSISTANT_TYPES` array
- `lib/assistants/refine.ts` — `buildRefineSystemForType` scorecard case + `buildScorecardRefineSystem`
- `lib/assistants/docx.ts` — `scorecardChartPng?: Buffer` opt + embed after h2 matching `/scorecard|avalia/i`
- `app/api/assistants/runs/[id]/{chart,xlsx,docx}/route.ts` — `scorecard` dispatch cases
- `components/assistants/AssistantsHub.tsx` — Scorecard card

---

## Task 1: Types & default criteria

**Files:**
- Modify: `lib/assistants/types.ts` (union L12-19 + array; append schemas near the Kraljic section ~L115-168)
- Test: `tests/lib/assistants/scorecard.test.ts`

- [ ] **Step 1: Write failing test for `scoreSuppliers`**

```typescript
// tests/lib/assistants/scorecard.test.ts
import { describe, expect, it } from 'vitest';
import { scoreSuppliers } from '@/lib/assistants/scorecard';
import { DEFAULT_SCORECARD_CRITERIA, SCORECARD_DEFAULT_THRESHOLDS } from '@/lib/assistants/types';
import type { ScorecardParams } from '@/lib/assistants/types';

function params(overrides: Partial<ScorecardParams> = {}): ScorecardParams {
  return {
    scorecardName: 'Aço plano',
    period: '',
    notes: '',
    thresholds: SCORECARD_DEFAULT_THRESHOLDS,
    criteria: [
      { id: 'qualidade', label: 'Qualidade', weight: 50 },
      { id: 'preco', label: 'Preço', weight: 50 },
    ],
    suppliers: [
      { name: 'Forn A', segment: '', scores: { qualidade: 10, preco: 10 } },
      { name: 'Forn B', segment: '', scores: { qualidade: 5, preco: 5 } },
      { name: 'Forn C', segment: '', scores: { qualidade: 2, preco: 2 } },
    ],
    ...overrides,
  };
}

describe('scoreSuppliers', () => {
  it('computes weighted score 0-100 and ranks desc', () => {
    const out = scoreSuppliers(params());
    expect(out).toHaveLength(3);
    expect(out[0]!.name).toBe('Forn A');
    expect(out[0]!.weightedScore).toBe(100);
    expect(out[0]!.rank).toBe(1);
    expect(out[1]!.weightedScore).toBe(50);
    expect(out[2]!.weightedScore).toBe(20);
  });

  it('normalizes weights that do not sum to 100', () => {
    const out = scoreSuppliers(params({
      criteria: [
        { id: 'qualidade', label: 'Qualidade', weight: 3 },
        { id: 'preco', label: 'Preço', weight: 1 },
      ],
      suppliers: [{ name: 'X', segment: '', scores: { qualidade: 10, preco: 0 } }],
    }));
    // 10/10*0.75 + 0/10*0.25 = 0.75 -> 75
    expect(out[0]!.weightedScore).toBe(75);
  });

  it('assigns bands by threshold (>=70 estrategico, >=40 desenvolvimento, else saida)', () => {
    const out = scoreSuppliers(params());
    expect(out.find((s) => s.name === 'Forn A')!.band).toBe('estrategico');
    expect(out.find((s) => s.name === 'Forn B')!.band).toBe('desenvolvimento');
    expect(out.find((s) => s.name === 'Forn C')!.band).toBe('saida');
  });

  it('is stable on ties (input order preserved within equal scores)', () => {
    const out = scoreSuppliers(params({
      suppliers: [
        { name: 'First', segment: '', scores: { qualidade: 5, preco: 5 } },
        { name: 'Second', segment: '', scores: { qualidade: 5, preco: 5 } },
      ],
    }));
    expect(out.map((s) => s.name)).toEqual(['First', 'Second']);
    expect(out[0]!.rank).toBe(1);
    expect(out[1]!.rank).toBe(2);
  });

  it('ships 6 default criteria summing to 100', () => {
    expect(DEFAULT_SCORECARD_CRITERIA).toHaveLength(6);
    expect(DEFAULT_SCORECARD_CRITERIA.reduce((a, c) => a + c.weight, 0)).toBe(100);
  });
});
```

- [ ] **Step 2: Run, verify it fails** — `npx vitest run tests/lib/assistants/scorecard.test.ts` → FAIL (`scoreSuppliers` / types not found).

- [ ] **Step 3: Add types to `lib/assistants/types.ts`**

Add `'scorecard'` to the `AssistantType` union (after `'negotiation'`, L19) and to the `ASSISTANT_TYPES` array. Then append:

```typescript
// ── Supplier Scorecard (Strategic Sourcing step 8) ───────────────────────
export type ScorecardBand = 'estrategico' | 'desenvolvimento' | 'saida';

export const SCORECARD_BAND_LABELS: Record<ScorecardBand, string> = {
  estrategico: 'Estratégico',
  desenvolvimento: 'Desenvolvimento',
  saida: 'Saída / substituição',
};

export const SCORECARD_DEFAULT_THRESHOLDS = { strategic: 70, development: 40 } as const;

export const DEFAULT_SCORECARD_CRITERIA = [
  { id: 'qualidade', label: 'Qualidade', weight: 25 },
  { id: 'prazo', label: 'Prazo de entrega', weight: 20 },
  { id: 'preco', label: 'Preço/competitividade', weight: 20 },
  { id: 'atendimento', label: 'Atendimento/relacionamento', weight: 15 },
  { id: 'inovacao', label: 'Inovação', weight: 10 },
  { id: 'esg', label: 'ESG/sustentabilidade', weight: 10 },
] as const;

export const ScorecardCriterionSchema = z.object({
  id: z.string().trim().min(1).max(60),
  label: z.string().trim().min(1).max(80),
  weight: z.number().min(0.01).max(100),
});
export type ScorecardCriterion = z.infer<typeof ScorecardCriterionSchema>;

export const ScorecardSupplierSchema = z.object({
  name: z.string().trim().min(1).max(120),
  segment: z.string().trim().max(120).optional().default(''),
  scores: z.record(z.string(), z.number().min(0).max(10)),
});
export type ScorecardSupplier = z.infer<typeof ScorecardSupplierSchema>;

export const ScorecardParamsSchema = z
  .object({
    scorecardName: z.string().trim().min(1).max(200),
    period: z.string().trim().max(120).optional().default(''),
    notes: z.string().trim().max(2000).optional().default(''),
    criteria: z.array(ScorecardCriterionSchema).min(1).max(15),
    suppliers: z.array(ScorecardSupplierSchema).min(1).max(100),
    thresholds: z
      .object({ strategic: z.number().min(1).max(100), development: z.number().min(0).max(99) })
      .default(SCORECARD_DEFAULT_THRESHOLDS)
      .refine((t) => t.strategic > t.development, { message: 'strategic must be > development' }),
  })
  .refine(
    (p) => p.suppliers.every((s) => p.criteria.every((c) => typeof s.scores[c.id] === 'number')),
    { message: 'every supplier must have a score for every criterion' },
  );
export type ScorecardParams = z.infer<typeof ScorecardParamsSchema>;

export const ScorecardRequestSchema = z.object({
  templateId: z.string().uuid(),
  params: ScorecardParamsSchema,
});
export type ScorecardRequest = z.infer<typeof ScorecardRequestSchema>;

export type ClassifiedSupplier = ScorecardSupplier & {
  weightedScore: number; // 0–100
  rank: number; // 1 = best
  band: ScorecardBand;
};
```

(`z` is already imported at the top of `types.ts`.)

- [ ] **Step 4: Create `lib/assistants/scorecard.ts` with `scoreSuppliers`** (prompt added in Task 2)

```typescript
import type { ScorecardParams, ClassifiedSupplier, ScorecardBand } from './types';

export function scoreSuppliers(params: ScorecardParams): ClassifiedSupplier[] {
  const totalWeight = params.criteria.reduce((a, c) => a + c.weight, 0) || 1;
  const scored = params.suppliers.map((s) => {
    const weighted = params.criteria.reduce((acc, c) => {
      const raw = s.scores[c.id] ?? 0;
      return acc + (raw / 10) * (c.weight / totalWeight);
    }, 0);
    const weightedScore = Number((weighted * 100).toFixed(1));
    return { supplier: s, weightedScore };
  });

  // Stable sort desc by score (preserve input order on ties).
  const ordered = scored
    .map((x, i) => ({ ...x, i }))
    .sort((a, b) => b.weightedScore - a.weightedScore || a.i - b.i);

  const { strategic, development } = params.thresholds;
  return ordered.map((x, idx) => ({
    ...x.supplier,
    weightedScore: x.weightedScore,
    rank: idx + 1,
    band: bandFor(x.weightedScore, strategic, development),
  }));
}

function bandFor(score: number, strategic: number, development: number): ScorecardBand {
  if (score >= strategic) return 'estrategico';
  if (score >= development) return 'desenvolvimento';
  return 'saida';
}
```

- [ ] **Step 5: Run tests** — `npx vitest run tests/lib/assistants/scorecard.test.ts` → PASS.

- [ ] **Step 6: Commit** — `git add lib/assistants/types.ts lib/assistants/scorecard.ts tests/lib/assistants/scorecard.test.ts && git commit -m "feat(scorecard): types + deterministic scoreSuppliers"`

---

## Task 2: Prompt builder

**Files:** Modify `lib/assistants/scorecard.ts`; Test in `tests/lib/assistants/scorecard.test.ts`.

- [ ] **Step 1: Add failing test** (append to the test file)

```typescript
import { buildScorecardPrompt, SCORECARD_SYSTEM_PROMPT } from '@/lib/assistants/scorecard';
import type { TemplateRow } from '@/lib/assistants/types';

const tpl: TemplateRow = {
  id: 't', assistant_type: 'scorecard', name: 'Padrão', description: null,
  body_md: '# Head\n\nTail.', created_by: null, created_at: '', updated_at: '',
};

describe('buildScorecardPrompt', () => {
  it('passes classification as INPUT (ranking + band per supplier) and keeps system byte-stable', () => {
    const classified = scoreSuppliers(params());
    const { system, user } = buildScorecardPrompt(params(), classified, tpl, [], null);
    expect(system).toBe(SCORECARD_SYSTEM_PROMPT);
    expect(user).toContain('Forn A');
    expect(user).toContain('Estratégico');
    expect(user).toMatch(/classifica|ranking/i);
  });
});
```

- [ ] **Step 2: Run, verify FAIL** — `npx vitest run tests/lib/assistants/scorecard.test.ts`.

- [ ] **Step 3: Append prompt builder to `lib/assistants/scorecard.ts`**

Mirror `buildKraljicPrompt` ([lib/assistants/kraljic.ts:142-274](../../../lib/assistants/kraljic.ts)). Reuse `splitTemplateBody`, `renderPlaceholders` from `./template-assembly` and `CompanyData` from `@/lib/db/user-company`. System prompt is a senior SRM persona; rules: (1) classification is INPUT — do not reclassify; (2) per band → Estratégico = parceria/QBR/co-desenvolvimento; Desenvolvimento = plano de melhoria com metas SMART + cadência; Saída = dual-sourcing/substituição com mitigação; (3) senior depth (threshold + ferramenta + cadência); (4) no source citations; (5) clean markdown. The user message builds: a criteria+weights block, a ranking table (rank, supplier, score, band via `SCORECARD_BAND_LABELS`), the buyer company block, the rendered template head (use `renderPlaceholders` with `{ client: company?.company_name ?? '', scope: params.scorecardName, category: 'Scorecard de fornecedores', deadline:'', budget:'', criteria:[], notes: params.notes }`), the chunks block (`c.content.slice(0,800)`), and a task instruction ("gere comparativo + plano de ação por fornecedor; NÃO recrie o gráfico, será inserido como imagem").

```typescript
export const SCORECARD_SYSTEM_PROMPT = `Você é um especialista sênior em Strategic Sourcing e SRM (Supplier Relationship Management) com 20 anos de experiência. Sua tarefa é INTERPRETAR um scorecard de fornecedores já pontuado e ranqueado, e produzir um relatório executivo em português brasileiro.

## Regras
1. **Classificação é INPUT, não output.** Cada fornecedor já vem com score ponderado (0–100), posição no ranking e faixa (Estratégico, Desenvolvimento, Saída). NÃO recalcule scores nem reclassifique.
2. **Template já chega com placeholders resolvidos.** Não preencha {{...}}.
3. **Plano de ação por faixa:**
   - **Estratégico**: parceria de longo prazo, QBR, co-desenvolvimento, joint roadmap, contrato plurianual com governança.
   - **Desenvolvimento**: plano de melhoria com metas SMART, cadência de revisão, suporte técnico, gatilhos de escalonamento.
   - **Saída**: dual-sourcing, plano de substituição, desmobilização com mitigação de risco de suprimento.
4. **Profundidade sênior**: threshold numérico, ferramenta concreta, cadência. Evite generalidades.
5. **Sem preâmbulo conversacional**; comece pelo título.
6. **Não invente dados de fornecedor**; quando faltar fundamento, use "o comprador definirá".
7. **Use a base de conhecimento (SRM, Cousins, supplier segmentation)** para fundamentar, sem citar autores/IDs.
8. **Markdown limpo**: headings, tabelas markdown, **bold** para valores críticos.`;
```

Keep `SCORECARD_SYSTEM_PROMPT` byte-stable thereafter (prefix cache).

- [ ] **Step 4: Run tests** → PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(scorecard): senior SRM prompt builder"`

---

## Task 3: Ranking chart

**Files:** Create `lib/assistants/scorecard-chart.ts`; Test: append to `tests/lib/assistants/scorecard.test.ts`.

- [ ] **Step 1: Failing test**

```typescript
import { renderScorecardChartPng } from '@/lib/assistants/scorecard-chart';

describe('renderScorecardChartPng', () => {
  it('returns a PNG buffer', async () => {
    const buf = await renderScorecardChartPng(scoreSuppliers(params()));
    expect(Buffer.isBuffer(buf)).toBe(true);
    // PNG magic bytes
    expect(buf.subarray(0, 4).toString('hex')).toBe('89504e47');
  });
});
```

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Implement `lib/assistants/scorecard-chart.ts`** — horizontal bars, mirror `kraljic-chart.ts` ([lib/assistants/kraljic-chart.ts](../../../lib/assistants/kraljic-chart.ts)) canvas setup. One bar per supplier (sorted by rank asc = score desc), bar length ∝ weightedScore (0–100 axis), color by band (`estrategico` navy `#1f4e79`, `desenvolvimento` green `#2e7d32`, `saida` orange `#e65100`), dashed vertical lines at the two thresholds, supplier name + score label per bar, title "Scorecard de Fornecedores". Use `import { createCanvas } from '@napi-rs/canvas'` and `return canvas.toBuffer('image/png')`. Height scales with supplier count (`60 + n*42`, min 300).

- [ ] **Step 4: Run tests** → PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(scorecard): ranking bar chart (napi-rs/canvas)"`

---

## Task 4: XLSX import parser

**Files:** Create `lib/assistants/scorecard-import.ts`; Test: `tests/lib/assistants/scorecard-import.test.ts`.

- [ ] **Step 1: Failing test** (in-memory ExcelJS fixture; mirror `tests/lib/assistants/kraljic-import.test.ts`)

```typescript
import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { parseScorecardXlsx } from '@/lib/assistants/scorecard-import';

async function buf(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Scorecard');
  ws.addRow(['Fornecedor', 'Qualidade', 'Preço', 'Prazo']);
  ws.addRow(['Forn A', 9, 7, 8]);
  ws.addRow(['Forn B', '5,5', 6, 4]);
  return Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);
}

describe('parseScorecardXlsx', () => {
  it('derives criteria from headers and suppliers with 0-10 scores', async () => {
    const { criteria, suppliers, warnings } = await parseScorecardXlsx(await buf());
    expect(criteria.map((c) => c.label)).toEqual(['Qualidade', 'Preço', 'Prazo']);
    expect(criteria.every((c) => c.weight > 0)).toBe(true);
    expect(suppliers).toHaveLength(2);
    expect(suppliers[0]!.name).toBe('Forn A');
    expect(suppliers[0]!.scores[criteria[0]!.id]).toBe(9);
    expect(suppliers[1]!.scores[criteria[0]!.id]).toBeCloseTo(5.5); // pt-BR comma
    expect(warnings).toEqual([]);
  });

  it('clamps out-of-range scores to 0-10 and warns', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Scorecard');
    ws.addRow(['Fornecedor', 'Qualidade']);
    ws.addRow(['X', 99]);
    const b = Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);
    const { suppliers, warnings } = await parseScorecardXlsx(b);
    expect(suppliers[0]!.scores[Object.keys(suppliers[0]!.scores)[0]!]).toBe(10);
    expect(warnings.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Implement `lib/assistants/scorecard-import.ts`**

Use `import ExcelJS from 'exceljs'`. First row = headers: col 1 = supplier name label (ignored), cols 2..n = criterion labels → build `ScorecardCriterion[]` with `id = slug(label)` (NFD/strip-accents/lowercase/`[^a-z0-9]+`→`-`) and equal default weights `round(100/n)` (last criterion absorbs remainder so Σ=100). For each subsequent row: col 1 = supplier name (skip blank); cells → `coerceNumber(value, 0)` (pt-BR: strip non-numeric, `,`→`.`), clamp to [0,10] (push a warning when clamped), build `scores` keyed by criterion id. Return `{ criteria, suppliers, warnings }`. Reuse the `normalize`/`coerceNumber` style from `lib/assistants/kraljic-import.ts:39-62`.

- [ ] **Step 4: Run tests** → PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(scorecard): xlsx import parser"`

---

## Task 5: XLSX export builder

**Files:** Create `lib/assistants/scorecard-xlsx.ts`; Test: `tests/lib/assistants/scorecard-xlsx.test.ts`.

- [ ] **Step 1: Failing test**

```typescript
import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { buildScorecardXlsxBuffer } from '@/lib/assistants/scorecard-xlsx';
import { scoreSuppliers } from '@/lib/assistants/scorecard';
import { SCORECARD_DEFAULT_THRESHOLDS } from '@/lib/assistants/types';

const p = {
  scorecardName: 'Aço', period: '', notes: '', thresholds: SCORECARD_DEFAULT_THRESHOLDS,
  criteria: [{ id: 'q', label: 'Qualidade', weight: 60 }, { id: 'p', label: 'Preço', weight: 40 }],
  suppliers: [{ name: 'A', segment: '', scores: { q: 9, p: 7 } }, { name: 'B', segment: '', scores: { q: 4, p: 5 } }],
};

describe('buildScorecardXlsxBuffer', () => {
  it('produces a Scorecard sheet and a Ranking sheet', async () => {
    const buf = await buildScorecardXlsxBuffer(p as never, scoreSuppliers(p as never));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    expect(wb.getWorksheet('Scorecard')).toBeTruthy();
    expect(wb.getWorksheet('Ranking')).toBeTruthy();
    expect(wb.creator).toBe('PROGPT');
  });
});
```

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Implement `lib/assistants/scorecard-xlsx.ts`**

Mirror `lib/assistants/kraljic-xlsx.ts`. Signature `buildScorecardXlsxBuffer(params: ScorecardParams, classified: ClassifiedSupplier[], opts: { logo?: XlsxLogo; chartPng?: Buffer } = {}): Promise<Buffer>` (import the `XlsxLogo` type from the existing xlsx lib if exported; otherwise type `{ buffer: Buffer; extension: 'png'|'jpeg' }`). Set `wb.creator='PROGPT'; wb.created=new Date()`. **Sheet "Scorecard"**: header row = `['Fornecedor', ...criteria labels with weight %, 'Score', 'Rank', 'Faixa']`, one row per supplier (raw 0–10 per criterion + weightedScore + rank + `SCORECARD_BAND_LABELS[band]`); bold navy header (`FF1F4E78`), column widths. **Sheet "Ranking"**: sorted by rank — `['Rank','Fornecedor','Score','Faixa','Recomendação']` where Recomendação is a deterministic posture per band (Estratégico→"Desenvolver parceria/QBR"; Desenvolvimento→"Plano de melhoria com metas"; Saída→"Dual-sourcing/substituição"). If `opts.chartPng`, add a 3rd sheet "Gráfico" with the image via `wb.addImage({buffer, extension:'png'})` + `ws.addImage(id, {tl:{col:0,row:0}, ext:{width:680,height:...}})`. Return `Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer)`.

- [ ] **Step 4: Run tests** → PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(scorecard): multi-sheet xlsx export"`

---

## Task 6: Refine system prompt

**Files:** Modify `lib/assistants/refine.ts` (dispatcher `buildRefineSystemForType` ~L419-453); Test: append to `tests/lib/assistants/refine-dispatch.test.ts`.

- [ ] **Step 1: Failing test** — add a case asserting `buildRefineSystemForType('scorecard', md, scorecardParams, [])` returns a string containing the scorecard name and "scorecard". (Mirror the existing kraljic case in that test file.)
- [ ] **Step 2: Run, verify FAIL.**
- [ ] **Step 3: Implement** — add `| ScorecardParams` to the dispatcher's params union; add `if (assistantType === 'scorecard') return buildScorecardRefineSystem(outputMd, params as ScorecardParams, chunks);` before the final fallback; implement `buildScorecardRefineSystem(outputMd, params, chunks)` mirroring `buildKraljicRefineSystem` (system header that says the assistant refines an existing supplier scorecard report given the current `outputMd`, the params summary, and the chunks block).
- [ ] **Step 4: Run tests** → PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(scorecard): refine chat support"`

---

## Task 7: Main handler route + import route

**Files:** Create `app/api/assistants/scorecard/route.ts`, `app/api/assistants/scorecard/import/route.ts`; Test: `tests/api/assistants/scorecard.test.ts`.

- [ ] **Step 1: Failing route test** — copy `tests/api/assistants/kraljic.test.ts` verbatim, change the import path to `@/app/api/assistants/scorecard/route`, set `getTemplate` mock `assistant_type:'scorecard'`, and `validBody = { templateId: '<uuid>', params: { scorecardName:'X', criteria:[{id:'q',label:'Qualidade',weight:100}], suppliers:[{name:'A',scores:{q:8}}], thresholds:{strategic:70,development:40} } }`. Keep the 401 / 429 / 400-template_not_found / 200+x-run-id cases. (Use the exact `setupMocks` doMock set from the gather notes: auth, rate-limit, billing/quota, langfuse, api-usage, retriever, reranker, user-company, templates, runs, `ai`, `@ai-sdk/openai`, `@/lib/env`.)
- [ ] **Step 2: Run, verify FAIL** (route module missing).
- [ ] **Step 3: Implement `app/api/assistants/scorecard/route.ts`** — mirror `app/api/assistants/kraljic/route.ts`:

```typescript
import { buildAssistantHandler } from '@/lib/assistants/handler';
import { ScorecardRequestSchema } from '@/lib/assistants/types';
import { scoreSuppliers, buildScorecardPrompt } from '@/lib/assistants/scorecard';
import type { ClassifiedSupplier } from '@/lib/assistants/types';

export const runtime = 'nodejs';

export const POST = buildAssistantHandler<typeof ScorecardRequestSchema, ClassifiedSupplier[]>({
  type: 'scorecard',
  requestSchema: ScorecardRequestSchema,
  traceInput: (parsed) => ({
    templateId: parsed.templateId,
    scorecardName: parsed.params.scorecardName,
    supplierCount: parsed.params.suppliers.length,
  }),
  classify: {
    spanInput: (params) => ({ count: params.suppliers.length }),
    spanOutput: (c) => ({
      estrategico: c.filter((s) => s.band === 'estrategico').length,
      desenvolvimento: c.filter((s) => s.band === 'desenvolvimento').length,
      saida: c.filter((s) => s.band === 'saida').length,
    }),
    run: (params) => scoreSuppliers(params),
  },
  buildRetrievalQuery: (params) =>
    `Avaliação e gestão de fornecedores SRM supplier scorecard ${params.scorecardName}`,
  rerankTopN: 6,
  buildPrompt: ({ params, template, chunks, classified, company }) =>
    buildScorecardPrompt(params, classified, template, chunks, company),
  generateOp: 'assistant-scorecard-generate',
  annotation: ({ classified }) => ({ supplierCount: classified.length }),
  paramsForAssembly: (params, company) => ({
    client: company?.company_name ?? '',
    scope: params.scorecardName,
    category: 'Scorecard de fornecedores',
    deadline: '', budget: '', criteria: [], notes: params.notes ?? '',
  }),
});
```

- [ ] **Step 4: Implement `app/api/assistants/scorecard/import/route.ts`** — mirror `app/api/assistants/abc/import/route.ts` (runtime nodejs, force-dynamic, `getCurrentUser`→401, `checkChatRateLimit`→429, MIME whitelist `.xlsx/.xls/octet-stream` + ext fallback, 10 MB cap, multipart `form.get('file')`, `parseScorecardXlsx(buf)`, return `{ criteria, suppliers, warnings }`, error codes `missing_file`/`unsupported_mime`/`file_too_large`/`parse_failed`).
- [ ] **Step 5: Run route test** → PASS (`npx vitest run tests/api/assistants/scorecard.test.ts`).
- [ ] **Step 6: Commit** — `git commit -m "feat(scorecard): handler route + xlsx import route"`

---

## Task 8: Output dispatch wiring (chart / xlsx / docx)

**Files:** Modify `app/api/assistants/runs/[id]/chart/route.ts`, `.../xlsx/route.ts`, `.../docx/route.ts`, `lib/assistants/docx.ts`. (No new unit test — covered by Task 11 e2e; typecheck gates correctness.)

- [ ] **Step 1: chart route** — add an `else if (run.assistant_type === 'scorecard')` branch: `const sp = run.params as ScorecardParams; buf = await renderScorecardChartPng(scoreSuppliers(sp));` (import `renderScorecardChartPng`, `scoreSuppliers`, `ScorecardParams`).
- [ ] **Step 2: xlsx route** — add branch: compute `scoreSuppliers(sp)`, try `renderScorecardChartPng` into `chartPng` (catch+warn), `buf = await buildScorecardXlsxBuffer(sp, classified, { logo: logo ?? undefined, chartPng }); filename = \`scorecard-${run.id.slice(0,8)}.xlsx\`;`.
- [ ] **Step 3: docx route** — declare `let scorecardChartPng: Buffer | undefined;`, add branch setting `titleSafe = \`Scorecard de Fornecedores - ${sp.scorecardName}\`.slice(0,120)`, `categoryForCover = 'Scorecard de fornecedores'`, compute `scorecardChartPng = await renderScorecardChartPng(scoreSuppliers(sp))` (try/catch+warn); add `scorecardChartPng` to the `mdToDocxBuffer(...)` opts.
- [ ] **Step 4: `lib/assistants/docx.ts`** — add `scorecardChartPng?: Buffer` to `mdToDocxBuffer` opts type; after the ABC embed block, add an embed guarded by `opts.scorecardChartPng && /scorecard|fornecedor/i.test(h2[1]!.trim()) && !inserted` flag (transformation `{ width: 580, height: 360 }`, type `'png'`), mirroring the kraljic/abc embed blocks.
- [ ] **Step 5: Typecheck** — `npm run typecheck` → zero errors.
- [ ] **Step 6: Commit** — `git commit -am "feat(scorecard): wire chart/xlsx/docx dispatch"`

---

## Task 9: AssistantType migration + template seed

**Files:** Create `supabase/migrations/00000000000031_scorecard_assistant_type.sql`, `docs/product/templates/scorecard-padrao.md`, `scripts/insert_template_scorecard.py`.

- [ ] **Step 1: Migration** — `00000000000031_scorecard_assistant_type.sql`:

```sql
-- Supplier Scorecard (Strategic Sourcing step 8) — permite templates do tipo.
alter table templates drop constraint if exists templates_assistant_type_check;
alter table templates add constraint templates_assistant_type_check
  check (assistant_type in ('rfp','kraljic','porter','financial','abc','profile','negotiation','scorecard'));
```

- [ ] **Step 2: Template markdown** — `docs/product/templates/scorecard-padrao.md`: a head section structure (Resumo executivo, Ranking e leitura geral, Análise por faixa, Plano de ação por fornecedor) following the style of `docs/product/templates/kraljic-padrao.md`.
- [ ] **Step 3: Seed script** — `scripts/insert_template_scorecard.py`: mirror `scripts/insert_template_kraljic.py` but **use the shared connection helper** so it works over the pooler:

```python
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from db_connect import connect  # direct→pooler fallback

TEMPLATE_NAME = 'Scorecard Padrão'
ADMIN_USER_ID = '5efba61c-6b36-49d1-b443-b235b003ad54'
body_md = open('docs/product/templates/scorecard-padrao.md', encoding='utf-8').read()
with connect() as conn, conn.cursor() as cur:
    cur.execute("select id from templates where assistant_type='scorecard' and name=%s", (TEMPLATE_NAME,))
    row = cur.fetchone()
    if row:
        cur.execute("update templates set body_md=%s, updated_at=now() where id=%s", (body_md, row[0]))
        print('updated', row[0])
    else:
        cur.execute(
            "insert into templates (assistant_type, name, description, body_md, created_by) "
            "values ('scorecard', %s, %s, %s, %s) returning id",
            (TEMPLATE_NAME, 'Template padrão do Supplier Scorecard', body_md, ADMIN_USER_ID),
        )
        print('inserted', cur.fetchone()[0])
```

- [ ] **Step 4: Commit** (migration applied + template seeded in Task 11) — `git add supabase/migrations/00000000000031_scorecard_assistant_type.sql docs/product/templates/scorecard-padrao.md scripts/insert_template_scorecard.py && git commit -m "feat(scorecard): migration + default template seed"`

---

## Task 10: UI

**Files:** Create `app/assistants/scorecard/page.tsx`, `components/assistants/Scorecard{Assistant,Form,SupplierTable,ImportDialog,Result}.tsx`; Modify `components/assistants/AssistantsHub.tsx`.

Mirror the Kraljic components exactly, with these substitutions (no behavioral changes to the shared flow):

- [ ] **Step 1: `ScorecardAssistant.tsx`** — copy `KraljicAssistant.tsx`; 4-phase machine choice→form→generating→done; fetch `GET /api/assistants/templates?type=scorecard`; POST `/api/assistants/scorecard` with `{ templateId, params: ScorecardFormValues→ScorecardParams }`; `handlePaywallResponse(res, 'scorecard')`; read `x-run-id`; on done mount `ScorecardResult` + `RfpChatPanel(runId, onRfpUpdated)`.
- [ ] **Step 2: `ScorecardForm.tsx` + `ScorecardSupplierTable.tsx`** — copy `KraljicForm.tsx`/`KraljicItemTable.tsx`. Form fields: `scorecardName`, `period`, `notes`, an editable **criteria editor** (label + weight, add/remove, seeded from `DEFAULT_SCORECARD_CRITERIA`; show running Σweight with a hint, normalize on submit), and a **supplier grid** (rows = suppliers `{name, segment, scores: Record<criterionId,0–10>}`; columns are the current criteria; add/remove row; number inputs clamp 0–10). Import button opens `ScorecardImportDialog`. Validation: ≥1 criterion, ≥1 supplier with non-empty name, valid templateId. On import, replace criteria + suppliers with parsed result.
- [ ] **Step 3: `ScorecardImportDialog.tsx`** — copy `KraljicImportDialog.tsx`; POST `/api/assistants/scorecard/import`; on success call `onImported({ criteria, suppliers })`; surface `warnings`.
- [ ] **Step 4: `ScorecardResult.tsx`** — copy `KraljicResult.tsx`; header with scorecardName + Nova análise + Copy + download `.docx`/`.xlsx` (`/api/assistants/runs/{runId}/{docx,xlsx}`); `<img src="/api/assistants/runs/{runId}/chart">`; `<ReactMarkdown remarkPlugins={[remarkGfm]}>`; mount `RfpChatPanel`.
- [ ] **Step 5: `app/assistants/scorecard/page.tsx`** — `export const dynamic='force-dynamic'; export default function() { return <ScorecardAssistant/>; }`.
- [ ] **Step 6: `AssistantsHub.tsx`** — add a SPOTLIGHT entry: `{ step: 8, stepCategory: 'Gestão de fornecedores', href:'/assistants/scorecard', title:'Supplier Scorecard', short:'Avalia e ranqueia fornecedores por critérios ponderados, com plano de ação por faixa.', bullets:['Critérios editáveis com pesos','Ranking + faixas (estratégico/desenvolvimento/saída)','.docx + .xlsx multi-sheet'], Preview: ScorecardPreview }`. Add a small `ScorecardPreview` SVG (horizontal bars) matching the existing preview aesthetic.
- [ ] **Step 7: Typecheck + build sanity** — `npm run typecheck` → zero errors.
- [ ] **Step 8: Commit** — `git commit -m "feat(scorecard): UI (form, grid, import, result, hub card)"`

---

## Task 11: Migration apply, seed, e2e verification

- [ ] **Step 1: Apply migration 0031** — `scripts/.venv/Scripts/python.exe scripts/apply_migrations.py` (now uses the pooler fallback via `db_connect`), or a one-shot. Verify the constraint includes `'scorecard'`.
- [ ] **Step 2: Seed the template** — `scripts/.venv/Scripts/python.exe scripts/insert_template_scorecard.py` → prints inserted/updated id.
- [ ] **Step 3: Full test suite + typecheck** — `npx vitest run` (all green) and `npm run typecheck` (zero errors).
- [ ] **Step 4: Manual e2e** — `npm run dev` → `/assistants/scorecard`: enter 3 suppliers × default criteria → generate → verify ranking table, bands, chart image, `.docx` + `.xlsx` downloads open correctly. Import a sample `.xlsx` → grid fills. As a free user, a 2nd run → 402 paywall toast.
- [ ] **Step 5: Final commit / PR** — push branch, open PR, merge.

---

## Self-Review

- **Spec coverage:** criteria editable+custom (Task 1 types + Task 10 form) ✓; deterministic banding (Task 1) ✓; chart (Task 3) ✓; import (Task 4) ✓; xlsx 2 sheets + docx (Tasks 5, 8) ✓; LLM narrative+action plan (Task 2) ✓; handler+paywall+migration+template (Tasks 7, 9) ✓; UI+hub (Task 10) ✓; refine chat (Task 6) ✓; tests (Tasks 1-7) ✓; verification (Task 11) ✓.
- **Placeholder scan:** UI tasks reference exact Kraljic source files + concrete substitutions (not "TBD"); backend tasks show complete code. No `add error handling`-style vagueness.
- **Type consistency:** `scoreSuppliers`, `ClassifiedSupplier`, `ScorecardParams`, `buildScorecardXlsxBuffer`, `renderScorecardChartPng`, `'assistant-scorecard-generate'`, bands `estrategico|desenvolvimento|saida` used identically across Tasks 1-11. Import returns `{criteria, suppliers, warnings}` (Task 4) consumed by Task 7 import route + Task 10 dialog — consistent.
