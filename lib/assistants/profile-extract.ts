import { getOpenAI, getOpenAIModel } from '@/lib/llm/openai';
import { recordApiUsage } from '@/lib/observability/api-usage';
import {
  parsePdfTextOnly,
  parseDocxTextOnly,
} from '@/lib/ingest/parser';
import {
  PartialProfileSchema,
  type PartialProfile,
} from './types';

// Sub-projeto 33 — Extract Profile (Perfil da Categoria) fields from an
// existing PDF or DOCX. The user already has a category profile from a
// past sourcing exercise; rather than re-typing the 15 fields, they
// upload and we infer what we can. The result populates the form, which
// the user then revises before submitting.
//
// Implementation choice: text-only parse + 1 structured LLM call. We do
// NOT use parsePdfMultimodal here — for field extraction the layout doesn't
// matter; text is enough. Saves ~10x cost vs the multimodal parser.

const EXTRACT_TIMEOUT_MS = 60_000;
const MAX_TEXT_CHARS = 200_000;

const EXTRACT_SYSTEM_PROMPT = `Você extrai campos estruturados de um documento de Perfil da Categoria (procurement). O documento pode ser um spec, briefing, RFI ou material interno de consultoria. Sua tarefa: identificar e retornar EXATAMENTE os campos abaixo com base no texto. NÃO invente valores que não estão no documento — campos ausentes ficam undefined.

Campos:
- nomeCategoria (string): nome da categoria (ex: "Embalagens flexíveis").
- descricao (string): 1 parágrafo descrevendo a categoria.
- subSegmentos (array de strings): sub-categorias / famílias dentro da categoria.
- escopoIncluido (string): produtos/serviços considerados parte da categoria.
- escopoNaoIncluido (string): produtos/serviços relacionados mas FORA do escopo.
- spendAnualBRL (number): gasto anual em R$ (sem centavos, ex: 5000000 para R$5MM).
- volumeFisico (string curta): volume + unidade (ex: "12000 ton/ano", "240k pcs/mês").
- numeroFornecedoresAtivos (integer ≥0).
- sazonalidade (string curta).
- requisitosTecnicos (string): normas, especificações, performance. PRESERVE LITERAL — copie o texto do documento, não parafraseie.
- restricoesRegulatorias (string): normas, leis, regulamentos. PRESERVE LITERAL.
- criteriosAvaliacao (array de strings, máx 10): critérios de avaliação ORDENADOS por prioridade quando o documento indicar.
- stakeholders (array de {nome: string, papel: "usuario" | "aprovador" | "operacao"}): nomes ou departamentos identificados. Use o papel mais próximo.
- prioridadeEstrategica (enum "custo" | "qualidade" | "inovacao" | "sustentabilidade"): a prioridade dominante implícita no documento.
- observacoes (string): qualquer contexto relevante que não cabe nos outros campos.

Regra crítica: para campos LITERAIS (requisitosTecnicos, restricoesRegulatorias) COPIE o texto do documento. Não resumir.

Output JSON estrito: { campos preenchidos quando identificados; campos ausentes simplesmente omitidos do JSON }.`;

export type ProfileExtractResult = {
  params: PartialProfile;
  warnings: string[];
};

export type ProfileExtractInput = {
  buffer: Buffer;
  mime: string;
  filename: string;
};

function buildWarnings(params: PartialProfile): string[] {
  const warnings: string[] = [];
  if (!params.nomeCategoria) warnings.push('nome da categoria ausente');
  if (!params.descricao) warnings.push('descrição ausente');
  if (!params.subSegmentos || params.subSegmentos.length === 0)
    warnings.push('sub-segmentos ausentes');
  if (!params.escopoIncluido) warnings.push('escopo incluído ausente');
  if (!params.requisitosTecnicos) warnings.push('requisitos técnicos ausentes');
  if (!params.criteriosAvaliacao || params.criteriosAvaliacao.length === 0)
    warnings.push('critérios de avaliação ausentes');
  if (!params.stakeholders || params.stakeholders.length === 0)
    warnings.push('stakeholders ausentes');
  if (!params.prioridadeEstrategica)
    warnings.push('prioridade estratégica não identificada');
  return warnings;
}

export async function extractProfileFromUpload(
  input: ProfileExtractInput,
): Promise<ProfileExtractResult> {
  // 1. Parse to plain text. Multimodal not needed — for field extraction
  // layout doesn't matter.
  let text: string;
  if (input.mime === 'application/pdf') {
    const parsed = await parsePdfTextOnly(input.buffer);
    text = parsed.text;
  } else if (
    input.mime ===
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const parsed = await parseDocxTextOnly(input.buffer);
    text = parsed.text;
  } else {
    throw new Error(`unsupported mime: ${input.mime}`);
  }
  if (text.trim().length < 50) {
    throw new Error('documento vazio ou ilegível');
  }
  if (text.length > MAX_TEXT_CHARS) {
    text = text.slice(0, MAX_TEXT_CHARS);
  }

  const ai = getOpenAI();
  const model = getOpenAIModel();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EXTRACT_TIMEOUT_MS);

  try {
    const res = await ai.chat.completions.create(
      {
        model,
        messages: [
          { role: 'system', content: EXTRACT_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Documento: ${input.filename}\n\n${text}\n\nExtraia os campos do Perfil da Categoria. Retorne JSON estrito.`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      },
      { signal: controller.signal },
    );

    const raw = res.choices[0]?.message?.content?.trim() ?? '{}';
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      throw new Error('LLM returned non-JSON');
    }

    const parsed = PartialProfileSchema.safeParse(parsedJson);
    if (!parsed.success) {
      throw new Error(`extraction schema mismatch: ${parsed.error.message}`);
    }

    void recordApiUsage({
      provider: 'openai',
      operation: 'assistant-profile-extract',
      model,
      tokensIn: res.usage?.prompt_tokens ?? 0,
      tokensOut: res.usage?.completion_tokens ?? 0,
      metadata: { filename: input.filename, mime: input.mime },
    });

    return {
      params: parsed.data,
      warnings: buildWarnings(parsed.data),
    };
  } finally {
    clearTimeout(timer);
  }
}
