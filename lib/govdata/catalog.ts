// Navegação do catálogo CATMAT (materiais) do Compras.gov.br.
// O catálogo NÃO tem busca por texto livre (descricaoItem retorna 0 — ver
// docs/product/govdata-api-contract.md), só navegação por código na hierarquia
// Grupo → Classe → PDM → Item. Listas cacheadas 24h (catálogo é estável).

import { govGet } from './client';
import { cached } from './cache';
import type { ComprasPage } from './types';

const PAGE = 500; // máx do Compras

export interface CatmatClasse {
  codigoClasse: number;
  nomeClasse: string;
}
export interface CatmatPdm {
  codigoPdm: number;
  nomePdm: string;
}
export interface CatmatItem {
  codigoItem: number;
  descricaoItem: string;
}

/** Todas as ~711 classes CATMAT (≤2 páginas). Cacheada. */
export async function listClasses(): Promise<CatmatClasse[]> {
  return cached('catmat:classes', async () => {
    const out: CatmatClasse[] = [];
    for (let pagina = 1; pagina <= 3; pagina++) {
      const page = await govGet<ComprasPage<CatmatClasse>>(
        'compras',
        '/modulo-material/2_consultarClasseMaterial',
        { pagina, tamanhoPagina: PAGE },
      );
      const rows = page.resultado ?? [];
      out.push(...rows);
      if (rows.length < PAGE) break;
    }
    return out;
  });
}

/** PDMs (Padrões Descritivos de Material) de uma classe. Cacheada por classe. */
export async function listPdms(codigoClasse: number): Promise<CatmatPdm[]> {
  return cached(`catmat:pdms:${codigoClasse}`, async () => {
    const page = await govGet<ComprasPage<CatmatPdm>>(
      'compras',
      '/modulo-material/3_consultarPdmMaterial',
      { codigoClasse, pagina: 1, tamanhoPagina: PAGE },
    );
    return page.resultado ?? [];
  });
}

/** Itens de um PDM (a folha da hierarquia — cada um tem codigoItem p/ preços). */
export async function listItemsByPdm(codigoPdm: number): Promise<CatmatItem[]> {
  return cached(`catmat:items:${codigoPdm}`, async () => {
    const page = await govGet<ComprasPage<CatmatItem>>(
      'compras',
      '/modulo-material/4_consultarItemMaterial',
      { codigoPdm, statusItem: true, pagina: 1, tamanhoPagina: PAGE },
    );
    return page.resultado ?? [];
  });
}
