import { z } from 'zod';
import { getGemini } from '@/lib/llm/gemini';
import { requireEnv } from '@/lib/env';
import type { Classification, RetrievedChunk } from './types';
import type { Trace } from '@/lib/observability/types';

const SNIPPET_MAX = 240;
const ITEM_MAX_CHARS = 120;

const FollowupsSchema = z.object({
  followups: z.array(z.string().min(3).max(ITEM_MAX_CHARS)).min(1).max(3),
});

const SYSTEM_DEEPEN_PT = `Voce e um assistente que sugere 3 perguntas curtas de follow-up para um usuario que acabou de receber uma resposta sobre teoria de procurement. As perguntas devem aprofundar o tema, ser respondiveis a partir do material abaixo, e ter no maximo 90 caracteres cada. Nao inclua a pergunta original. Nao use IDs, numeros entre colchetes, nem cite fontes. Retorne JSON com a forma { "followups": [string, string, string] }.`;

const SYSTEM_REDIRECT_PT = `Voce e um assistente que ajuda um usuario cuja pergunta nao foi respondida porque a base de conhecimento nao tinha material sobre o topico. Sugira 3 reformulacoes ou topicos proximos de procurement (matriz de Kraljic, TCO, modelos de Cox / Cousins / Monczka, sourcing estrategico, gestao de fornecedores, Porter, Dyer, etc.) que possam estar na base. Nao prometa que a base cobre o tema; apenas sugira reformulacoes. No maximo 90 caracteres cada. Retorne JSON com a forma { "followups": [string, string, string] }.`;

export type SuggestFollowupsInput = {
  query: string;
  answer: string;
  chunks: RetrievedChunk[];
  classification: Classification;
  parentTrace?: Trace;
};

export async function suggestFollowups(input: SuggestFollowupsInput): Promise<string[]> {
  const { query, answer, chunks } = input;
  const ai = getGemini();
  const model = requireEnv('GEMINI_MODEL');

  const mode: 'deepen' | 'redirect' = chunks.length > 0 ? 'deepen' : 'redirect';
  const system = mode === 'deepen' ? SYSTEM_DEEPEN_PT : SYSTEM_REDIRECT_PT;

  let userBlock: string;
  if (mode === 'deepen') {
    const material = chunks
      .map((c) => `- ${c.articleTitle}: ${c.content.slice(0, SNIPPET_MAX)}`)
      .join('\n');
    userBlock = [
      '## Pergunta original',
      query,
      '',
      '## Resposta dada',
      answer,
      '',
      '## Material disponivel',
      material,
    ].join('\n');
  } else {
    userBlock = ['## Pergunta original (nao respondida)', query].join('\n');
  }

  const res = await ai.models.generateContent({
    model,
    contents: `${system}\n\n${userBlock}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          followups: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            maxItems: 3,
          },
        },
        required: ['followups'],
      },
      maxOutputTokens: 512,
    },
  });
  const text = res.text ?? '';
  const parsed = FollowupsSchema.parse(JSON.parse(text));
  return parsed.followups;
}
