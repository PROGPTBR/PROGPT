import type { Row } from './analyze';

// Dataset de exemplo pro Dashboard Studio — ordens de compra sintéticas de um
// ano, ricas o suficiente pra acender TODOS os gráficos (data, 2 dimensões,
// várias medidas). Determinístico (LCG com seed fixa) pra não usar Math.random
// e manter o "exemplo" estável entre renders/testes.

const CATEGORIAS = [
  'Matéria-prima', 'Embalagens', 'Logística', 'TI & Software', 'Serviços',
  'Manutenção (MRO)', 'Marketing', 'Energia', 'Frota', 'EPIs',
];
const FORNECEDORES = [
  'Alfa Suprimentos', 'Beta Industrial', 'Cordeiro & Cia', 'Delta Log',
  'Epsilon Tech', 'Ferreira Materiais', 'Global Parts', 'Horizonte S.A.',
  'Ipê Serviços', 'JK Distribuidora', 'Lumen Energia', 'Meridian',
];
const REGIOES = ['Sudeste', 'Sul', 'Nordeste', 'Centro-Oeste', 'Norte'];
const STATUS = ['Aprovado', 'Aprovado', 'Aprovado', 'Pendente', 'Cancelado'];
const PRIORIDADES = ['Alta', 'Média', 'Baixa'];

// LCG simples (Numerical Recipes) — pseudoaleatório determinístico.
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

export function sampleDataset(): { name: string; rows: Row[] } {
  const rng = lcg(20260713);
  const rows: Row[] = [];
  const now = new Date(2026, 5, 30); // 2026-06-30 fixa (sem Date.now)

  for (let i = 0; i < 520; i++) {
    const daysAgo = Math.floor(rng() * 365);
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo);
    const categoria = pick(rng, CATEGORIAS);
    const fornecedor = pick(rng, FORNECEDORES);
    const regiao = pick(rng, REGIOES);

    // Valor com cauda longa (algumas ordens grandes) por categoria.
    const base = 1500 + rng() * 18000;
    const catMult = 1 + CATEGORIAS.indexOf(categoria) * 0.12;
    const valor = Math.round(base * catMult * (rng() < 0.08 ? 4 + rng() * 3 : 1));
    const economiaPct = Math.round((rng() * 22) * 10) / 10; // 0–22%
    const economia = Math.round((valor * economiaPct) / 100);
    const prazoDias = 3 + Math.floor(rng() * 45);
    const itens = 1 + Math.floor(rng() * 40);

    rows.push({
      'Data': `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      'Categoria': categoria,
      'Fornecedor': fornecedor,
      'Região': regiao,
      'Status': pick(rng, STATUS),
      'Prioridade': pick(rng, PRIORIDADES),
      'Valor (R$)': valor,
      'Economia (R$)': economia,
      'Economia %': economiaPct,
      'Prazo (dias)': prazoDias,
      'Itens': itens,
    });
  }

  return { name: 'Exemplo · Ordens de Compra 2026', rows };
}
