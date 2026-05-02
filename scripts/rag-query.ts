#!/usr/bin/env tsx
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(process.cwd(), '.env.local') });

import { runRag } from '@/lib/rag';

async function main() {
  const query = process.argv.slice(2).join(' ').trim();
  if (!query) {
    console.error('Usage: npm run rag:query "<question>"');
    process.exit(2);
  }

  const result = await runRag(query);

  console.log('\n=== Classification ===');
  console.log(JSON.stringify(result.classification, null, 2));

  console.log('\n=== Sources (top after rerank) ===');
  if (result.sources.length === 0) {
    console.log('(no sources)');
  } else {
    for (const src of result.sources) {
      console.log(`  [${src.number}] ${src.articleTitle}  (chunk ${src.chunkId})`);
    }
  }

  console.log('\n=== System prompt (truncated 800 chars) ===');
  console.log(result.system.slice(0, 800) + (result.system.length > 800 ? '\n... (truncated)' : ''));

  console.log('\n=== User prompt (truncated 800 chars) ===');
  console.log(result.user.slice(0, 800) + (result.user.length > 800 ? '\n... (truncated)' : ''));

  console.log('\n=== Debug ===');
  console.log(JSON.stringify(result.debug, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
