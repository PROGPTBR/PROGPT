#!/usr/bin/env tsx
// Sub-projeto 32 — importa a Biblioteca de Prompts do app-fonte (pro-ai-circle)
// para um JSON limpo e versionado (scripts/data/prompts-seed.json).
//
// Roda UMA vez (e quando precisar re-sincronizar) localmente, com a service-role
// key do projeto fonte. A key NÃO vai pro Railway nem é commitada; o JSON
// resultante (já limpo de marca) vira a fonte da verdade.
//
//   SOURCE_SUPABASE_URL=https://jzxuwziiyvyaguvcbtdw.supabase.co \
//   SOURCE_SUPABASE_SERVICE_ROLE_KEY=<service_role> \
//   npm run prompts:import
//
// Lê só prompts aprovados (is_approved=true), resolve category_id→nome, aplica
// scrubBranding em title/summary/content, ordena por prompt_number e escreve o
// JSON. Loga quais prompts mudaram no scrub pra revisão manual.

import { config } from 'dotenv';
import { resolve } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { scrubBranding } from '@/lib/prompts/scrub';
import type { SeedPrompt } from '@/lib/prompts/types';

config({ path: resolve(process.cwd(), '.env.local') });

const SOURCE_URL =
  process.env.SOURCE_SUPABASE_URL ?? 'https://jzxuwziiyvyaguvcbtdw.supabase.co';
const SOURCE_KEY = process.env.SOURCE_SUPABASE_SERVICE_ROLE_KEY;

const OUT_PATH = resolve(process.cwd(), 'scripts/data/prompts-seed.json');

type SourcePrompt = {
  prompt_number: number | null;
  title: string;
  summary: string | null;
  content: string;
  category_id: string | null;
  tags: string[] | null;
  is_approved: boolean;
};
type SourceCategory = { id: string; name: string };

async function main() {
  if (!SOURCE_KEY) {
    console.error(
      'Faltou SOURCE_SUPABASE_SERVICE_ROLE_KEY (service-role do projeto fonte) no env/.env.local.',
    );
    process.exit(2);
  }

  const sb = createClient(SOURCE_URL, SOURCE_KEY, {
    auth: { persistSession: false },
  });

  // 1) Categorias: id → nome
  const { data: cats, error: catErr } = await sb
    .from('prompt_categories')
    .select('id, name');
  if (catErr) {
    console.error('Erro lendo prompt_categories:', catErr.message);
    process.exit(1);
  }
  const catName = new Map<string, string>(
    (cats as SourceCategory[]).map((c) => [c.id, c.name]),
  );

  // 2) Prompts aprovados
  const { data: rows, error: pErr } = await sb
    .from('prompts')
    .select('prompt_number, title, summary, content, category_id, tags, is_approved')
    .eq('is_approved', true)
    .order('prompt_number', { ascending: true });
  if (pErr) {
    console.error('Erro lendo prompts:', pErr.message);
    process.exit(1);
  }

  const src = rows as SourcePrompt[];
  const seed: SeedPrompt[] = [];
  const scrubbedTitles: string[] = [];

  for (const r of src) {
    const title = scrubBranding(r.title ?? '');
    const summary = scrubBranding(r.summary ?? '');
    const content = scrubBranding(r.content ?? '');
    if (title.changed || summary.changed || content.changed) {
      scrubbedTitles.push(title.text || `#${r.prompt_number}`);
    }
    seed.push({
      prompt_number: r.prompt_number,
      title: title.text.trim(),
      summary: summary.text.trim(),
      content: content.text.trim(),
      category: r.category_id ? catName.get(r.category_id) ?? 'Geral' : 'Geral',
      tags: (r.tags ?? []).filter((t) => t && t.trim().length > 0),
    });
  }

  mkdirSync(resolve(process.cwd(), 'scripts/data'), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(seed, null, 2) + '\n', 'utf-8');

  const byCat = new Map<string, number>();
  for (const s of seed) byCat.set(s.category, (byCat.get(s.category) ?? 0) + 1);

  console.log(`\nImportados ${seed.length} prompts → ${OUT_PATH}`);
  console.log(`Categorias (${byCat.size}):`);
  for (const [c, n] of [...byCat.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${n.toString().padStart(3)}  ${c}`);
  }
  console.log(`\nScrub de marca alterou ${scrubbedTitles.length} prompt(s):`);
  for (const t of scrubbedTitles) console.log(`  • ${t}`);
  console.log('\nRevise o JSON e rode `python scripts/seed_prompts.py` pra carregar no PROGPT.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
