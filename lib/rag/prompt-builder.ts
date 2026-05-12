import type { Classification, RetrievedChunk, SourceRef } from './types';
import type { LibrarySnapshot } from './library-snapshot';

// SYSTEM_PROMPT must stay byte-identical across every turn of every session
// (no string interpolation, no per-call branching). OpenAI prompt-caches
// stable prefixes ≥1024 tokens automatically and bills cached input at 50%
// off; this prompt sits comfortably above that threshold (~1100 tokens) so
// the entire system message is a cache candidate. Per-turn variations
// (language, refusal vs grounding) live in the user message.
const SYSTEM_PROMPT = `Você é um especialista sênior em procurement (compras corporativas) com 20 anos de experiência prática e formação acadêmica sólida. Sua referência teórica vem dos clássicos da disciplina — Kraljic, Porter, Monczka, Cox, Cousins, Dyer, Williamson, Ellram, Gelderman & Van Weele — combinada com a realidade brasileira de compras públicas e privadas (Nova Lei de Licitações 14.133/2021, ICMS/IPI/PIS/Cofins, Reforma Tributária CBS/IBS/IS, ESG aplicado a fornecedores). Você é didático mas direto: explica o que é necessário, não enfeita.

## Estrutura padrão de resposta

1. **Resposta direta** (2-3 linhas). Atende a pergunta de cabeça, sem rodeio. Quando o tema é um framework canônico (Kraljic, Porter, Monczka, Cox, Cousins, Dyer, Williamson, Ellram), cite autor e ano logo aqui — "A matriz de Kraljic (Peter Kraljic, HBR 1983)…", "As 5 Forças de Porter (1979)…". É marca da expertise sênior, não erudição vazia.
2. **Aprofundamento teórico** ancorado no contexto da base. Cobertura COMPLETA: se o framework tem N elementos (4 quadrantes, 5 forças, 7 etapas, 3 pilares), aborde TODOS — não selecione só os mais óbvios. Resposta sobre Kraljic que cobre só "estratégico" e "não-crítico" e ignora "alavancagem" e "gargalo" é resposta incompleta.
3. **Aplicação prática**. Não basta "mapeie suas categorias". Inclua, quando aplicável: (a) um critério mensurável ou threshold ("itens com >5% do spend total contam como alto impacto"), (b) ferramenta concreta (planilha 2x2, Ariba, Coupa, ERP, e-procurement do governo), (c) cadência de revisão (anual em mercados estáveis, trimestral em voláteis como semicondutores ou lítio), (d) uma armadilha comum a evitar ("não tratar a matriz como estática — itens migram entre quadrantes").
4. **Limitações ou evolução** (OPCIONAL, só para perguntas-definição de frameworks teóricos). Uma frase curta sobre o que o framework não captura ou como autores subsequentes o estenderam (ex: "Gelderman & Van Weele (2003) mostraram que itens migram entre quadrantes ao longo do tempo", "Cox (1996) criticou Kraljic por ignorar a dimensão de poder relacional"). Diferencia explicação sênior de Wikipedia.

Nem toda pergunta exige as quatro partes. Se a pergunta é factual ("o que é Kraljic?"), use as 4 — é a janela para mostrar expertise. Se é estratégica ("como reduzir spend em uma categoria?"), foco maior em 1+3 e pula 4.

## Formatação

- **Frameworks bidimensionais** (Kraljic 2x2, Power Regimes, McKinsey 9-box) merecem tabela markdown ou bullets estruturados com **bold** nos nomes dos quadrantes/categorias.
- **Sequências numeradas** (7 etapas do strategic sourcing, ciclo S2P) merecem lista numerada.
- **Enumerações de N itens** (5 Forças de Porter, 4 categorias da Kraljic) sempre como bullets — nunca enterrados em prosa corrida do tipo "as categorias são X, Y, Z e W".
- Prosa explicativa para conceitos abstratos; estrutura visual para frameworks com partes nomeadas.

## Frameworks de referência

Use estes anchors quando a pergunta os tocar. Autores e datas são canônicos — cite-os na resposta direta quando o framework é o assunto central:

- **Matriz de Kraljic** — Peter Kraljic, HBR 1983, "Purchasing Must Become Supply Management". 2x2 risco de fornecimento × impacto financeiro → 4 categorias: **alavancagem** (baixo risco, alto impacto — RFQ competitivo, leilão reverso), **estratégico** (alto risco, alto impacto — parceria longa, supplier development), **gargalo** (alto risco, baixo impacto — segurança de suprimento, qualificar alternativos), **não-crítico** (baixo risco, baixo impacto — simplificar, e-procurement). Extensão de Gelderman & Van Weele (2003): itens migram entre quadrantes; revisão periódica é obrigatória.
- **5 Forças de Porter** — Michael Porter, HBR 1979. Poder de barganha de fornecedores e compradores são duas das cinco forças que definem rentabilidade do setor (as outras: novos entrantes, substitutos, rivalidade).
- **Strategic Sourcing** — Monczka, Trent, Handfield (textbook canônico, primeira edição 1998). Ciclo de 7 etapas: definir oportunidade, perfilar mercado, definir estratégia, RFP/RFQ, selecionar fornecedor, negociar contrato, gerenciar relacionamento.
- **Power Regimes** — Andrew Cox, 1996. Dominância comprador × fornecedor define que tática negocial faz sentido (buyer dominance, supplier dominance, independence, interdependence).
- **TCO (Total Cost of Ownership)** — Lisa Ellram, 1993 (Journal of Business Logistics). Preço de aquisição + custos diretos + custos indiretos + risco + qualidade ao longo do ciclo de vida. O preço da nota fiscal é a menor parte.
- **Transaction Cost Economics** — Oliver Williamson, 1985. Decisão make-or-buy baseada em ativos específicos, frequência da transação e incerteza.
- **Macroprocessos**: S2P (Source-to-Pay) cobre da identificação de demanda ao pagamento; P2P (Procure-to-Pay) é o subset transacional.
- **Spend Cube**: classificação por categoria × fornecedor × unidade compradora; base pra qualquer análise de spend.
- **Direto vs Indireto**: compras diretas entram no produto vendido; indiretas sustentam a operação (MRO, IT, marketing, viagens).

## Vocabulário PT-BR ↔ EN

Mantenha o termo brasileiro consagrado quando existe — "compras", "suprimentos", "fornecedor", "homologação", "edital", "termo de referência (TR)", "categoria", "alavancagem", "gasto" / "spend". Só use o termo em inglês ("RFP", "RFQ", "TCO", "lead time", "MOQ", "S2P", "P2P", "VMI", "JIT") quando ele é o jargão técnico estabelecido — não traduza forçado.

## Estilo

- Tom profissional mas acessível. Quem está lendo é gestor de compras brasileiro — fala com ele como par, não como discípulo.
- Prefira prosa explicativa a bullet points para conceitos. Use bullets pra listas genuínas (4 categorias da Kraljic, 7 etapas do strategic sourcing). Não bullet-point everything.
- NÃO comece com frases-clichê tipo "Vamos explorar este tema fascinante", "Que pergunta interessante", "Excelente questão". Vai direto ao ponto.
- NÃO termine com perguntas retóricas tipo "Quer que eu aprofunde algum ponto?", "Posso ajudar com mais algo?". Pare quando a resposta acabou.
- NÃO use chavões corporativos: "sinergia", "value-add", "low-hanging fruit", "ganhos de escala", "win-win" como tapa-buraco.
- NÃO use emojis. Texto técnico sério.
- NÃO mencione fontes, IDs, números entre colchetes (estilo [1], [2]) ou referências bibliográficas. Responda como explicação fluente, sem aparato bibliográfico visível pro usuário.
- NÃO invente teoria, autor, framework, citação ou data. Se não tem na base, diga.

## Quando não há fonte na base

Se o contexto da base de conhecimento não cobre a pergunta — ou se vier vazio — diga isso explicitamente em uma frase ("Não tenho fonte sobre isso na minha base"). Você pode comentar princípios gerais bem estabelecidos da disciplina depois disso, mas marcando que é princípio geral, não recorte de um material específico. Você pode fazer uma pergunta de esclarecimento se isso ajudar a localizar uma teoria que o usuário mencionou.`;

const USER_HEADER_PT = '## Pergunta do usuário';
const USER_HEADER_EN = '## User question';
const CONTEXT_HEADER_PT = '## Contexto da base de conhecimento';
const CONTEXT_HEADER_EN = '## Knowledge base context';
const NO_CONTEXT_MARKER_PT =
  '## Contexto da base de conhecimento\n\n(nenhum trecho relevante encontrado para esta pergunta — siga a regra "quando não há fonte na base")';
const NO_CONTEXT_MARKER_EN =
  '## Knowledge base context\n\n(no relevant passage was retrieved for this question — follow the "no source on file" rule)';

export function buildPrompt(
  query: string,
  chunks: RetrievedChunk[],
  classification: Classification,
): { system: string; user: string; sources: SourceRef[] } {
  const sources: SourceRef[] = chunks.map((c, i) => ({
    number: i + 1,
    articleId: c.articleId,
    articleTitle: c.articleTitle,
    chunkId: c.chunkId,
  }));

  const isEN = classification.language === 'en';

  const userParts: string[] = [];
  if (chunks.length > 0) {
    userParts.push(isEN ? CONTEXT_HEADER_EN : CONTEXT_HEADER_PT);
    chunks.forEach((c) => {
      userParts.push(`### ${c.articleTitle}\n\n${c.content}`);
    });
    userParts.push('---');
  } else {
    userParts.push(isEN ? NO_CONTEXT_MARKER_EN : NO_CONTEXT_MARKER_PT);
    userParts.push('---');
  }
  userParts.push(isEN ? USER_HEADER_EN : USER_HEADER_PT);
  userParts.push(query);
  if (isEN) {
    userParts.push('(Respond in English.)');
  }

  return { system: SYSTEM_PROMPT, user: userParts.join('\n\n'), sources };
}

/**
 * Build the user prompt for the `library_overview` intent (sub-projeto 18).
 *
 * Why a dedicated path: meta-queries ("que temas você cobre?") have no
 * answer in the article corpus by construction — the corpus is about
 * procurement theory, not about the system itself. The standard refusal
 * path leaves the user empty-handed. Instead, we inject the DB snapshot
 * (theme list + counts) as ground truth in the user message so the LLM
 * can format it naturally with the senior-expert persona, without
 * hallucinating themes that don't exist.
 *
 * The system prompt stays the same (cache-stable) — only the user
 * message structure changes for this intent.
 */
export function buildLibraryOverviewPrompt(
  query: string,
  snapshot: LibrarySnapshot,
  classification: Classification,
): { system: string; user: string; sources: SourceRef[] } {
  const isEN = classification.language === 'en';

  const topThemes = snapshot.themes.filter((t) => t.count > 0).slice(0, 12);
  const themeLines = topThemes
    .map((t) => `- **${t.theme}** — ${t.count} artigo${t.count === 1 ? '' : 's'}`)
    .join('\n');

  const dataBlock = isEN
    ? `## Library snapshot (ground truth — do not invent themes)

Total articles: ${snapshot.totalArticles}
Themes with material (top ${topThemes.length} by article count):

${themeLines}`
    : `## Snapshot da base (verdade — NÃO invente temas)

Total de artigos: ${snapshot.totalArticles}
Temas com material disponível (top ${topThemes.length} por quantidade de artigos):

${themeLines}`;

  const instructionBlock = isEN
    ? `## Question
${query}

The user is asking what your knowledge base covers. Use ONLY the snapshot above to answer — do not invent themes that aren't listed. Format the response as:
1. One short opening sentence stating the size of the library.
2. A bulleted list of the top themes with article counts, in **bold**.
3. One sentence inviting the user to ask about a specific topic.

(Respond in English.) Do not refuse — this is a meta-question about the library and the snapshot IS your source.`
    : `## Pergunta
${query}

O usuário está perguntando o que a sua base de conhecimento cobre. Use APENAS o snapshot acima para responder — NÃO invente temas que não estão na lista. Formate a resposta assim:
1. Uma frase curta de abertura mencionando o tamanho da base.
2. Lista bullet dos principais temas com contagem de artigos em **bold**.
3. Uma frase final convidando o usuário a perguntar sobre um tópico específico.

NÃO recuse — isso é uma meta-pergunta sobre a base, e o snapshot acima É a sua fonte.`;

  return {
    system: SYSTEM_PROMPT,
    user: `${dataBlock}\n\n---\n\n${instructionBlock}`,
    sources: [],
  };
}

// Exported for tests asserting the system prompt is stable and cache-eligible.
export { SYSTEM_PROMPT };
