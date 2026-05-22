// Smoke pra sub-projeto 21 — valida que a DB externa responde
// e que o classifier + search pipeline funciona end-to-end.
//
// Roda assim:
//   tsx scripts/smoke-suppliers.ts

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { classifyCnae } from '../lib/suppliers/cnae-classifier';
import { searchSuppliers } from '../lib/suppliers/search';
import { searchCnaesByText } from '../lib/suppliers/cnae-lookup';
import { closeReceitaPool } from '../lib/suppliers/receita-db';

async function main() {
  console.log('\n=== 1) cnae-search autocomplete ===');
  const cnaes = await searchCnaesByText('embalag', 5);
  for (const c of cnaes) {
    console.log(`  ${c.code} — ${c.name}`);
  }

  console.log('\n=== 2) classifyCnae("embalagens flexíveis no Nordeste") ===');
  const cls = await classifyCnae('embalagens flexíveis no Nordeste');
  console.log('  cnaeCode:', cls.cnaeCode);
  console.log('  cnaeName:', cls.cnaeName);
  console.log('  confidence:', cls.confidence);
  console.log('  scope:', cls.scope, '| states:', cls.states);
  console.log('  rationale:', cls.rationale);
  console.log('  alternatives:');
  for (const a of cls.alternatives) {
    console.log(`    ${a.code} — ${a.name} (score ${a.score.toFixed(3)})`);
  }

  if (cls.cnaeCode) {
    console.log('\n=== 3) searchSuppliers ===');
    const result = await searchSuppliers({
      cnae: cls.cnaeCode,
      ufs: cls.states,
      limit: 5,
    });
    console.log(`  total: ${result.total}`);
    console.log(`  showing ${result.suppliers.length} of those:`);
    for (const s of result.suppliers) {
      console.log(
        `    ${s.cnpj} | ${s.razao_social} | ${s.uf}/${s.municipio} | ${s.porte ?? '-'}`,
      );
    }
  }

  await closeReceitaPool();
}

main().catch((err) => {
  console.error('SMOKE FAILED:', err);
  process.exit(1);
});
