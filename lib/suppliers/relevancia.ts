// Termos do pedido que identificam o que o comprador quer, para dar
// preferência na ordem da busca a quem tem esse termo no NOME.
//
// Achado em 2026-10-21 (Alexandre): "artigo de papelaria" trazia a Suzano no
// topo. O CNAE estava certo (comércio atacadista de artigos de escritório e de
// papelaria), mas a ordem premiava empresa grande com maior capital social, e
// filiais da Suzano estão registradas nesse ramo (papel). Uma papelaria de
// verdade tem "papelaria" no nome; uma fabricante de celulose, não.
//
// Puro: roda no navegador (monta o pedido) e é validado de novo no servidor.

const PALAVRAS_VAZIAS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na', 'nos', 'nas', 'para', 'pra', 'com', 'por',
  'um', 'uma', 'uns', 'umas', 'o', 'a', 'os', 'as', 'que', 'ou', 'até', 'ate',
  'fornecedor', 'fornecedores', 'fornecimento', 'empresa', 'empresas', 'comercio', 'comércio',
  'atacado', 'atacadista', 'varejo', 'distribuidor', 'distribuidora', 'loja', 'lojas',
  'preciso', 'quero', 'procuro', 'busco', 'buscar', 'comprar', 'compra', 'compras', 'cotar', 'cotação', 'cotacao',
  'artigo', 'artigos', 'material', 'materiais', 'produto', 'produtos', 'item', 'itens',
  'servico', 'serviço', 'servicos', 'serviços', 'geral', 'gerais', 'tipo', 'tipos',
  'regiao', 'região', 'cidade', 'estado', 'perto', 'proximo', 'próximo', 'local', 'brasil',
]);

// Lugar não é o que se compra: "papelaria em Manaus" não deve premiar quem
// tem "Manaus" no nome. Estados por extenso aqui; as cidades do pedido vêm
// do classificador (parâmetro `lugares`).
const ESTADOS = new Set(
  (
    'acre alagoas amapa amazonas bahia ceara distrito federal espirito santo goias maranhao mato grosso sul ' +
    'minas gerais para paraiba parana pernambuco piaui rio janeiro norte rondonia roraima santa catarina ' +
    'sao paulo sergipe tocantins nordeste sudeste centro oeste'
  ).split(' '),
);

/** Tamanho do radical: "papelaria" e "papelarias" casam por "PAPELA". */
const RADICAL = 6;
export const MAX_TERMOS = 5;

function semAcento(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Radicais em MAIÚSCULAS, sem acento, só letras e números ("PAPELA",
 * "ESCRIT"). Vazio quando o pedido só tem palavras genéricas.
 */
export function termosDeRelevancia(pedido: string, lugares: readonly string[] = []): string[] {
  const deLugar = new Set(
    lugares.flatMap((l) => semAcento(l).toLowerCase().split(/[^a-z0-9]+/)).filter(Boolean),
  );
  const termos: string[] = [];
  for (const bruto of pedido.split(/[^\p{L}\p{N}]+/u)) {
    const palavra = bruto.toLowerCase();
    if (palavra.length < 4 || PALAVRAS_VAZIAS.has(palavra)) continue;
    const plana = semAcento(palavra);
    if (ESTADOS.has(plana) || deLugar.has(plana)) continue;
    const radical = semAcento(palavra).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, RADICAL);
    if (radical.length < 4 || termos.includes(radical)) continue;
    termos.push(radical);
    if (termos.length >= MAX_TERMOS) break;
  }
  return termos;
}

/**
 * Termos do pedido e, depois, os do nome do ramo escolhido. "material de
 * escritório" cai no ramo "artigos de escritório e de papelaria": quem tem
 * "papelaria" no nome também vende o que foi pedido.
 */
export function termosDaBusca(
  pedido: string,
  nomeDoRamo: string,
  lugares: readonly string[] = [],
): string[] {
  const termos = termosDeRelevancia(pedido, lugares);
  for (const t of termosDeRelevancia(nomeDoRamo)) {
    if (termos.length >= MAX_TERMOS) break;
    if (!termos.includes(t)) termos.push(t);
  }
  return termos;
}

/** Expressão para o `~` do Postgres, ou null. Aceita só radicais limpos. */
export function padraoDeRelevancia(termos: readonly string[] | undefined): string | null {
  const limpos = (termos ?? []).filter((t) => /^[A-Z0-9]{4,12}$/.test(t)).slice(0, MAX_TERMOS);
  return limpos.length ? `(${limpos.join('|')})` : null;
}
