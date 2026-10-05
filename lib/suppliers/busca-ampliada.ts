// Busca ampliada de fornecedores (sub-projeto 73) — liberada só para equipes
// listadas aqui. Além da base da Receita, a busca procura:
//   1. na VENDOR LIST da própria equipe (fornecedores que ela já usa, subidos
//      em /fornecedores ou na própria tela de busca);
//   2. na internet (quem vende o item, com link).
//
// Nasceu da Construtora Costa Feitosa (2026-10-05): a vendor list delas tem
// 809 fornecedores SEM CNPJ, organizados por "grupo de materiais" — a busca
// por CNAE da Receita não enxerga essa lista, e item de varejo ("caneta 5b")
// aparece no Google mas não como atividade principal na Receita.
//
// Puro (sem DB/rede): acesso, normalização e ranking da vendor list.

export type EquipeBuscaAmpliada = {
  id: string;
  nome: string;
  /** E-mails liberados. A vendor list é compartilhada entre eles. */
  emails: readonly string[];
};

// Liberação POR PESSOA, não por domínio: um colega novo da mesma empresa só
// entra quando o comercial pedir.
export const EQUIPES_BUSCA_AMPLIADA: readonly EquipeBuscaAmpliada[] = [
  {
    id: 'costa-feitosa',
    nome: 'Costa Feitosa',
    emails: [
      'cristiano.camargo@costafeitosa.com.br',
      'camila.santos@costafeitosa.com.br',
      'kate.sa@costafeitosa.com.br',
    ],
  },
];

export function equipeDoUsuario(email: string | null | undefined): EquipeBuscaAmpliada | null {
  const e = (email ?? '').trim().toLowerCase();
  if (!e) return null;
  return EQUIPES_BUSCA_AMPLIADA.find((eq) => eq.emails.includes(e)) ?? null;
}

// ─── Vendor list ──────────────────────────────────────────────────────────

export type FornecedorVendorList = {
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string | null;
  categoria: string | null;
  municipio: string | null;
  uf: string | null;
  telefone: string | null;
  email: string | null;
  notas: string | null;
};

export type ResultadoVendorList = FornecedorVendorList & {
  /** Por que entrou: categoria escolhida, termo no nome, etc. */
  motivo: string;
  pontos: number;
};

export function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Palavras do pedido que não dizem O QUE se compra.
const STOPWORDS = new Set(
  (
    'a o as os um uma de da do das dos em no na nos nas para pra por com sem e ou que ' +
    'quero preciso procuro busco buscar comprar compra compras cotar cotacao orcamento ' +
    'fornecedor fornecedores fornecimento empresa empresas loja lojas venda vende vendem ' +
    'onde tem perto regiao cidade estado proximo proxima qualquer algum alguma ' +
    'material materiais produto produtos servico servicos item itens tipo locacao aluguel'
  ).split(' '),
);

const UFS = new Set(
  'ac al ap am ba ce df es go ma mt ms mg pa pb pr pe pi rj rn rs ro rr sc sp se to'.split(' '),
);

/** Termos que identificam o item pedido ("caneta 5b em natal/rn" → caneta, 5b, natal). */
export function termosDaConsulta(consulta: string): string[] {
  const vistos = new Set<string>();
  for (const t of normalizar(consulta).split(' ')) {
    if (t.length < 2 || STOPWORDS.has(t) || UFS.has(t)) continue;
    // Plural simples: "luvas" casa com "luva".
    vistos.add(t.length > 4 && t.endsWith('s') ? t.slice(0, -1) : t);
  }
  return [...vistos];
}

function contem(texto: string | null, termo: string): boolean {
  if (!texto) return false;
  const t = ` ${normalizar(texto)} `;
  // Termo curto ("ca" de "CA-50", "5b") só vale como palavra inteira — como
  // prefixo casaria com qualquer nome começando por "ca".
  return termo.length < 4 ? t.includes(` ${termo} `) : t.includes(` ${termo}`);
}

/** Categorias distintas da vendor list, na grafia original (para o LLM escolher). */
export function categoriasDistintas(rows: readonly FornecedorVendorList[]): string[] {
  const porChave = new Map<string, string>();
  for (const r of rows) {
    const c = r.categoria?.trim();
    if (c && !porChave.has(normalizar(c))) porChave.set(normalizar(c), c);
  }
  return [...porChave.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

const LIMITE_RESULTADOS = 60;

/**
 * Ranqueia a vendor list para o pedido. Categoria escolhida pela IA pesa
 * mais (a planilha diz "AÇO", o comprador pede "vergalhão"); termo do pedido
 * no nome, na categoria ou nas observações também conta.
 */
export function buscarNaVendorList(
  rows: readonly FornecedorVendorList[],
  consulta: string,
  categoriasEscolhidas: readonly string[] = [],
): ResultadoVendorList[] {
  const termos = termosDaConsulta(consulta);
  // A IA devolve da categoria mais provável para a menos: a 1ª pesa mais.
  const pesoCategoria = new Map<string, number>();
  categoriasEscolhidas.forEach((c, i) => {
    const k = normalizar(c);
    if (!pesoCategoria.has(k)) pesoCategoria.set(k, Math.max(6, 12 - i * 2));
  });
  const consultaNorm = ` ${normalizar(consulta)} `;

  const out: ResultadoVendorList[] = [];
  for (const r of rows) {
    let pontos = 0;
    const motivos: string[] = [];

    const peso = r.categoria ? pesoCategoria.get(normalizar(r.categoria)) : undefined;
    if (peso) {
      pontos += peso;
      motivos.push(`categoria ${r.categoria!.trim()}`);
    }
    const noNome = termos.filter((t) => contem(r.razaoSocial, t) || contem(r.nomeFantasia, t));
    const naCategoria = termos.filter((t) => contem(r.categoria, t));
    const nasNotas = termos.filter((t) => contem(r.notas, t));
    // Sem a categoria escolhida pela IA, o fornecedor só entra se o nome ou
    // a categoria dele tiverem o termo PRINCIPAL do pedido (o 1º: "luva" em
    // "luva de segurança") — senão "segurança" puxaria o grupo de alarmes.
    // Observação sozinha também não basta: só desempata.
    const principal = termos[0];
    if (!peso && !(principal && (noNome.includes(principal) || naCategoria.includes(principal)))) continue;
    pontos += naCategoria.length * 4 + noNome.length * 3 + nasNotas.length;
    if (naCategoria.length && !peso) motivos.push(`categoria ${r.categoria!.trim()}`);
    if (noNome.length) motivos.push(`nome com "${noNome.join('", "')}"`);
    if (nasNotas.length) motivos.push('citado nas observações');

    // Mesma cidade/UF citada no pedido sobe na lista (não filtra: fornecedor
    // de obra costuma entregar fora da cidade dele).
    if (r.municipio && consultaNorm.includes(` ${normalizar(r.municipio)} `)) pontos += 2;
    else if (r.uf && consultaNorm.includes(` ${r.uf.toLowerCase()} `)) pontos += 1;

    out.push({ ...r, motivo: motivos.join(' · '), pontos });
  }

  out.sort((a, b) => b.pontos - a.pontos || a.razaoSocial.localeCompare(b.razaoSocial, 'pt-BR'));
  return out.slice(0, LIMITE_RESULTADOS);
}

/** A mesma planilha subida por duas pessoas da equipe não aparece duas vezes. */
export function semDuplicados(rows: readonly FornecedorVendorList[]): FornecedorVendorList[] {
  const vistos = new Set<string>();
  const out: FornecedorVendorList[] = [];
  for (const r of rows) {
    const cnpj = r.cnpj?.replace(/\D/g, '').slice(0, 8);
    const chave = cnpj
      ? `cnpj:${cnpj}`
      : `nome:${normalizar(r.razaoSocial)}|${(r.email ?? r.telefone?.replace(/\D/g, '') ?? '').toLowerCase()}|${normalizar(r.categoria ?? '')}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    out.push(r);
  }
  return out;
}

// ─── Internet ─────────────────────────────────────────────────────────────

export type FornecedorWeb = {
  nome: string;
  site: string | null;
  telefone: string | null;
  cidade: string | null;
  uf: string | null;
  oQueVende: string | null;
};

/** Só links http(s) — o modelo às vezes devolve "N/A" ou texto no campo. */
export function siteSeguro(url: string | null | undefined): string | null {
  const u = (url ?? '').trim();
  if (!u) return null;
  try {
    const parsed = new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`);
    if (!/^https?:$/.test(parsed.protocol) || !parsed.hostname.includes('.')) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/** Tira o JSON da resposta do modelo, mesmo cercado de texto ou ```json. */
export function extrairFornecedoresWeb(texto: string): FornecedorWeb[] {
  const inicio = texto.indexOf('[');
  const fim = texto.lastIndexOf(']');
  if (inicio < 0 || fim <= inicio) return [];
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto.slice(inicio, fim + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(bruto)) return [];
  const str = (v: unknown): string | null => {
    if (typeof v !== 'string') return null;
    const t = v.trim();
    return t && !/^(n\/?a|null|-|não informado|nao informado)$/i.test(t) ? t : null;
  };
  const out: FornecedorWeb[] = [];
  for (const item of bruto) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const nome = str(o.nome);
    if (!nome) continue;
    const uf = str(o.uf);
    out.push({
      nome,
      site: siteSeguro(str(o.site)),
      telefone: str(o.telefone),
      cidade: str(o.cidade),
      uf: uf && /^[A-Za-z]{2}$/.test(uf) ? uf.toUpperCase() : null,
      oQueVende: str(o.oQueVende),
    });
  }
  return out.slice(0, 12);
}
