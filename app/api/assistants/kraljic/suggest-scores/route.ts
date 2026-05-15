import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { requireEnv } from '@/lib/env';
import { getCurrentUser } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { recordApiUsage } from '@/lib/observability/api-usage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  itemName: z.string().trim().min(1).max(200),
  category: z.string().trim().max(120).optional().default(''),
  description: z.string().trim().min(20).max(4000),
});

// 7 criterion scores + a rationale text. Matches KraljicItemSchema's
// user-scored fields (spend is derived server-side, not asked here).
const ScoreField = z.number().int().min(1).max(4);

const SuggestionSchema = z.object({
  criticality: ScoreField.describe('Nível de Criticidade do item (1-4)'),
  technicalSpec: ScoreField.describe('Complexidade das Especificações Técnicas (1-4)'),
  customerValue: ScoreField.describe('Valor Percebido pelo Cliente Final (1-4)'),
  marketStructure: ScoreField.describe(
    'Estrutura do Mercado — concentração de fornecedores (1=mercado pulverizado, 4=oligopólio/monopólio)',
  ),
  marketRivalry: ScoreField.describe(
    'Rivalidade do Mercado entre fornecedores (1=alta competição, 4=baixa competição)',
  ),
  supplierPower: ScoreField.describe(
    'Poder de Barganha do Fornecedor sobre o comprador (1=baixo, 4=alto)',
  ),
  supplierSwitching: ScoreField.describe(
    'Dificuldade de Substituição do Fornecedor (1=trivial, 4=quase impossível)',
  ),
  rationale: z.string().describe(
    '2-4 frases justificando os scores, em PT-BR, mencionando o que pesou em cada eixo',
  ),
});

const SYSTEM_PROMPT = `Você é um analista sênior de procurement ajudando um comprador a pontuar uma categoria na Matriz de Kraljic. Receberá o nome da categoria e uma descrição livre do comprador.

Sua tarefa: propor scores de 1 a 4 para 7 sub-critérios.

## Eixo IMPACTO NO NEGÓCIO (somente 3 critérios — o 4º, Spend, é calculado pelo sistema):
- **criticality**: o quanto a falha/atraso desta categoria afeta operação ou receita. 1=baixo (substituível, não-crítico operacional), 2=moderado, 3=alto, 4=parada de operação se faltar.
- **technicalSpec**: complexidade técnica das especificações. 1=commodity sem spec, 2=spec leve, 3=spec detalhada, 4=engenharia customizada/regulada.
- **customerValue**: o quanto o cliente final percebe valor neste insumo. 1=invisível, 2=indireto, 3=relevante, 4=diferenciador competitivo.

## Eixo COMPLEXIDADE DO MERCADO FORNECEDOR:
- **marketStructure**: concentração da oferta. 1=mercado pulverizado (centenas de opções), 2=mercado competitivo, 3=oligopólio, 4=monopólio/duopólio.
- **marketRivalry**: rivalidade entre fornecedores. 1=alta rivalidade (preço-disputa), 2=competição normal, 3=acordos tácitos, 4=carteis ou mercado coordenado.
- **supplierPower**: poder de barganha do fornecedor. 1=baixo (comprador domina), 2=equilibrado, 3=alto, 4=trava o comprador.
- **supplierSwitching**: dificuldade de trocar fornecedor. 1=trivial (commodity), 2=custo de switch baixo, 3=switch demorado/caro, 4=lock-in tecnológico/contratual.

## Regras
- Seja conservador: se a descrição é vaga, prefira o meio (2 ou 3).
- Quando a descrição não menciona o critério, infira do contexto da categoria (ex: TI/Software → technicalSpec alto por default).
- Rationale: 2-4 frases em PT-BR mostrando o que pesou na pontuação dos eixos.`;

// POST /api/assistants/kraljic/suggest-scores
// Body: { itemName, category?, description }
// Returns: { criticality, technicalSpec, customerValue, marketStructure,
//            marketRivalry, supplierPower, supplierSwitching, rationale }
export async function POST(req: Request) {
  let parsed;
  try {
    parsed = BodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'invalid body' },
      { status: 400 },
    );
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const rl = await checkChatRateLimit();
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', retry_after_secs: rl.retryAfterSecs },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSecs) } },
    );
  }

  const openai = createOpenAI({ apiKey: requireEnv('OPENAI_API_KEY') });

  try {
    const result = await generateObject({
      model: openai(process.env.OPENAI_MODEL ?? 'gpt-4o-mini'),
      system: SYSTEM_PROMPT,
      schema: SuggestionSchema,
      messages: [
        {
          role: 'user',
          content: `Categoria: ${parsed.category || '(não informada)'}\nItem: ${parsed.itemName}\n\nDescrição do comprador:\n${parsed.description}\n\nProponha os 7 scores e o rationale.`,
        },
      ],
    });

    const cachedPromptTokens = (() => {
      const v = result.providerMetadata?.openai?.cachedPromptTokens;
      return typeof v === 'number' ? v : 0;
    })();
    void recordApiUsage({
      provider: 'openai',
      operation: 'assistant-kraljic-suggest',
      model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      tokensIn: result.usage.promptTokens,
      tokensOut: result.usage.completionTokens,
      tokensCached: cachedPromptTokens,
      metadata: { itemName: parsed.itemName.slice(0, 80) },
    });

    return NextResponse.json(result.object);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'suggest_failed';
    console.error('[api/assistants/kraljic/suggest-scores] failed:', err);
    return NextResponse.json(
      { error: 'suggest_failed', detail: message },
      { status: 500 },
    );
  }
}
