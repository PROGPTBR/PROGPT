#!/usr/bin/env tsx
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(process.cwd(), '.env.local') });

import { buscarCatmat, precoReferencia } from '@/lib/govdata/precos';

async function main() {
  const texto = process.argv.slice(2).join(' ').trim() || 'açúcar refinado branco 1kg';
  console.log(`\n🔎 buscarCatmat("${texto}")...`);
  const t0 = Date.now();
  const match = await buscarCatmat(texto);
  console.log(`  (${Date.now() - t0}ms)`);
  if (!match) {
    console.log('  ❌ não mapeou');
    return;
  }
  console.log(`  classe ${match.codigoClasse} — ${match.nomeClasse}`);
  console.log(`  pdm    ${match.codigoPdm} — ${match.nomePdm}`);
  console.log(`  item   ${match.codigoItem} — ${match.descricaoItem.slice(0, 90)}`);
  console.log(`  confiança ${match.confianca} · ${match.rationale}`);

  console.log(`\n💰 precoReferencia(${match.codigoItem})...`);
  const t1 = Date.now();
  const pr = await precoReferencia(match.codigoItem);
  console.log(`  (${Date.now() - t1}ms) · totalAmostras=${pr.totalAmostras}`);
  if (pr.stats) {
    const s = pr.stats;
    console.log(
      `  mediana R$ ${s.mediana} · p25 ${s.p25} · p75 ${s.p75} · min ${s.min} · max ${s.max} · n=${s.n} (bruto ${s.nBruto}, ${s.outliersRemovidos} outliers)`,
    );
    pr.amostras.slice(0, 4).forEach((a) =>
      console.log(`    · R$ ${a.precoUnitario} ${a.unidade} | ${a.uf} | ${a.dataCompra} | ${a.fornecedor.slice(0, 30)}`),
    );
  } else {
    console.log('  (sem amostras de preço)');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
