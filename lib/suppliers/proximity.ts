import municipios from './data/municipios-geo.json';

// Busca por proximidade — "fornecedores perto da obra".
//
// Dor real do cliente (24/09/2026): "nossas obras rodam em vários pontos do
// estado, e dependendo do volume não compensa comprar de alguém de outra
// cidade distante". Filtrar por UF traz São Paulo capital pra uma obra em
// Itupeva; filtrar por 1 cidade exclui o fornecedor da cidade vizinha.
//
// Resolvemos no NOSSO lado: as coordenadas das 5.570 sedes municipais vêm do
// IBGE (`scripts/build-municipios-geo.ts`) e viram uma lista de cidades que
// alimenta o filtro `cities` que a busca já aceita — sem tocar na base
// externa da Receita nem adicionar coluna geográfica lá.

export type MunicipioGeo = {
  id: number;
  nome: string;
  uf: string;
  /** Centroide — usado para ordenar e exibir a distância. */
  lat: number;
  lon: number;
  /** Retângulo do município: [minLat, minLon, maxLat, maxLon]. */
  box: [number, number, number, number];
};

export type CidadeProxima = MunicipioGeo & {
  /** Distância em km entre as cidades (centro a centro) — é o número que o
   *  comprador reconhece ("Jundiaí, 17 km"). */
  distanciaKm: number;
};

const LISTA = municipios as MunicipioGeo[];

/** Raios oferecidos na interface. 0 = só a cidade escolhida. */
export const RAIOS_KM = [0, 30, 50, 100, 200] as const;
export type RaioKm = (typeof RAIOS_KM)[number];

/** Teto de cidades devolvidas — a query da busca usa `= any(array)` e uma
 *  lista gigante degrada o plano do Postgres sem ganho prático. */
export const MAX_CIDADES = 120;

/** Comparação de nome de cidade: sem acento, sem caixa, sem espaço extra. */
export function normalizarNomeCidade(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/**
 * Distância em km entre as BORDAS de dois municípios (0 quando se tocam).
 *
 * Medir centro a centro mente em município grande: Petrolina/PE e
 * Juazeiro/BA são coladas e seus centroides distam 68 km. É a distância
 * entre bordas que responde "dá pra atender essa obra sem frete caro?".
 */
export function distanciaEntreMunicipios(
  a: MunicipioGeo,
  b: MunicipioGeo,
): number {
  const [aMinLat, aMinLon, aMaxLat, aMaxLon] = a.box;
  const [bMinLat, bMinLon, bMaxLat, bMaxLon] = b.box;

  // Separação angular; 0 quando os retângulos se sobrepõem naquele eixo.
  const dLatGraus = Math.max(0, aMinLat - bMaxLat, bMinLat - aMaxLat);
  const dLonGraus = Math.max(0, aMinLon - bMaxLon, bMinLon - aMaxLon);

  if (dLatGraus === 0 && dLonGraus === 0) return 0;

  const latMedia = (a.lat + b.lat) / 2;

  return distanciaKm(
    { lat: 0, lon: 0 },
    { lat: dLatGraus, lon: dLonGraus },
    latMedia,
  );
}

/** Distância em km entre dois pontos (Haversine, raio médio da Terra).
 *  `latReferencia` permite medir um DELTA de coordenadas na latitude certa
 *  (usado pela distância entre bordas). */
export function distanciaKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
  latReferencia?: number,
): number {
  const R = 6371;
  const rad = (g: number) => (g * Math.PI) / 180;

  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);

  const lat1 = rad(latReferencia ?? a.lat);
  const lat2 = rad(latReferencia ?? b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function acharMunicipio(uf: string, nome: string): MunicipioGeo | null {
  const alvoUf = uf.trim().toUpperCase();
  const alvoNome = normalizarNomeCidade(nome);

  return (
    LISTA.find(
      (m) => m.uf === alvoUf && normalizarNomeCidade(m.nome) === alvoNome,
    ) ?? null
  );
}

/**
 * Cidades dentro do raio, da mais perto para a mais longe, incluindo a
 * própria. Cruza fronteira de estado de propósito: uma obra em Itupeva (SP)
 * pode ser atendida por fornecedor de MG a 40 km — o limite administrativo
 * não importa pro frete.
 *
 * `raioKm = 0` devolve só a cidade de origem.
 */
export function cidadesNoRaio(args: {
  uf: string;
  cidade: string;
  raioKm: number;
  limite?: number;
}): CidadeProxima[] {
  const origem = acharMunicipio(args.uf, args.cidade);
  if (!origem) return [];

  const limite = Math.max(1, args.limite ?? MAX_CIDADES);

  if (args.raioKm <= 0) {
    return [{ ...origem, distanciaKm: 0 }];
  }

  // Pré-filtro barato por caixa envolvente antes do Haversine: 1° de
  // latitude ≈ 111 km. Evita 5.570 cálculos de trigonometria por chamada.
  const grausLat = args.raioKm / 111;
  const cosLat = Math.cos((origem.lat * Math.PI) / 180);
  const grausLon = args.raioKm / (111 * Math.max(0.1, Math.abs(cosLat)));

  const perto: CidadeProxima[] = [];

  for (const m of LISTA) {
    // Pré-filtro generoso (usa o centroide + meio grau de folga pro tamanho
    // do município); o corte fino é a distância entre bordas, abaixo.
    if (Math.abs(m.lat - origem.lat) > grausLat + 1.5) continue;
    if (Math.abs(m.lon - origem.lon) > grausLon + 1.5) continue;

    // Duas medidas, de propósito:
    //  - ENTRAR na lista: distância entre BORDAS. Um município vizinho
    //    colado entra mesmo sendo enorme (Petrolina/Juazeiro).
    //  - EXIBIR/ORDENAR: distância entre centros, que é o número que a
    //    pessoa reconhece e o que aproxima o trajeto real.
    const borda = distanciaEntreMunicipios(origem, m);
    if (borda > args.raioKm) continue;

    perto.push({ ...m, distanciaKm: Math.round(distanciaKm(origem, m)) });
  }

  perto.sort((a, b) => a.distanciaKm - b.distanciaKm);
  return perto.slice(0, limite);
}
