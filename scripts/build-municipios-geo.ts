// Gera lib/suppliers/data/municipios-geo.json — os 5.570 municípios do país
// com coordenadas da sede (centroide oficial do IBGE).
//
// É o insumo da busca por proximidade: "fornecedores num raio de X km da
// obra". Roda uma vez (o dado só muda quando o IBGE altera malha), e o JSON
// fica versionado no repo — em runtime não há chamada ao IBGE.
//
//   npx tsx scripts/build-municipios-geo.ts

import fs from 'fs';
import path from 'path';

// lat/lon = centroide (para ordenar por proximidade e exibir).
// box = retângulo envolvente [minLat, minLon, maxLat, maxLon].
//
// O box existe porque o centroide sozinho mente em município grande:
// Petrolina/PE e Juazeiro/BA são cidades coladas e seus centroides ficam a
// 68 km. Medindo BORDA a BORDA, municípios vizinhos dão ~0 km — que é o que
// interessa pra "fornecedor perto da obra".
type Municipio = {
  id: number;
  nome: string;
  uf: string;
  lat: number;
  lon: number;
  box: [number, number, number, number];
};

const UF_IDS: Array<[number, string]> = [
  [12, 'AC'], [27, 'AL'], [16, 'AP'], [13, 'AM'], [29, 'BA'], [23, 'CE'],
  [53, 'DF'], [32, 'ES'], [52, 'GO'], [21, 'MA'], [51, 'MT'], [50, 'MS'],
  [31, 'MG'], [15, 'PA'], [25, 'PB'], [41, 'PR'], [26, 'PE'], [22, 'PI'],
  [33, 'RJ'], [24, 'RN'], [43, 'RS'], [11, 'RO'], [14, 'RR'], [42, 'SC'],
  [35, 'SP'], [28, 'SE'], [17, 'TO'],
];

async function getJson<T>(url: string): Promise<T> {
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as T;
    } catch (err) {
      if (tentativa === 3) throw err;
      await new Promise((r) => setTimeout(r, 2000 * tentativa));
    }
  }
  throw new Error('inalcançável');
}

async function main() {
  // 1) Nomes: uma chamada nacional.
  console.log('Baixando nomes dos municípios…');
  const nomes = await getJson<
    Array<{ id: number; nome: string; microrregiao?: { mesorregiao?: { UF?: { sigla?: string } } } }>
  >('https://servicodados.ibge.gov.br/api/v1/localidades/municipios');

  const nomePorId = new Map<number, { nome: string; uf: string }>();
  for (const m of nomes) {
    const uf = m.microrregiao?.mesorregiao?.UF?.sigla;
    if (uf) nomePorId.set(m.id, { nome: m.nome, uf });
  }
  console.log(`  ${nomePorId.size} municípios nomeados`);

  // 2) Coordenadas: uma chamada por UF (a malha nacional é pesada demais).
  const out: Municipio[] = [];
  for (const [ufId, uf] of UF_IDS) {
    const metas = await getJson<
      Array<{
        id: string;
        centroide?: { latitude: number; longitude: number };
        'regiao-limitrofe'?: Array<{ latitude: number; longitude: number }>;
      }>
    >(`https://servicodados.ibge.gov.br/api/v3/malhas/estados/${ufId}/metadados?intrarregiao=municipio`);

    let ok = 0;
    for (const meta of metas) {
      const id = Number(meta.id);
      const nome = nomePorId.get(id);
      if (!nome || !meta.centroide) continue;
      // O IBGE devolve o retângulo como 2 cantos opostos — normalizamos
      // pra [minLat, minLon, maxLat, maxLon] sem depender da ordem.
      const cantos = meta['regiao-limitrofe'] ?? [];
      const lats = cantos.map((c) => c.latitude);
      const lons = cantos.map((c) => c.longitude);

      const box: [number, number, number, number] =
        lats.length >= 2 && lons.length >= 2
          ? [
              Number(Math.min(...lats).toFixed(3)),
              Number(Math.min(...lons).toFixed(3)),
              Number(Math.max(...lats).toFixed(3)),
              Number(Math.max(...lons).toFixed(3)),
            ]
          : [
              Number(meta.centroide.latitude.toFixed(3)),
              Number(meta.centroide.longitude.toFixed(3)),
              Number(meta.centroide.latitude.toFixed(3)),
              Number(meta.centroide.longitude.toFixed(3)),
            ];

      out.push({
        id,
        nome: nome.nome,
        uf: nome.uf,
        lat: Number(meta.centroide.latitude.toFixed(4)),
        lon: Number(meta.centroide.longitude.toFixed(4)),
        box,
      });
      ok++;
    }
    console.log(`  ${uf}: ${ok} municípios`);
  }

  out.sort((a, b) => a.id - b.id);

  const destino = path.resolve('lib/suppliers/data/municipios-geo.json');
  fs.writeFileSync(destino, JSON.stringify(out));
  const kb = (fs.statSync(destino).size / 1024).toFixed(0);
  console.log(`\nGravado: ${destino}`);
  console.log(`${out.length} municípios · ${kb} KB`);
}

main().catch((err) => {
  console.error('FALHOU:', err instanceof Error ? err.message : err);
  process.exit(1);
});
