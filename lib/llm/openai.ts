import OpenAI from 'openai';
import { requireEnv } from '@/lib/env';

const TIMEOUT_MS = 30_000;

let instance: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (instance) return instance;
  const apiKey = requireEnv('OPENAI_API_KEY');
  instance = new OpenAI({ apiKey });
  return instance;
}

export function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
}

export async function pingOpenAI(): Promise<string> {
  const ai = getOpenAI();
  const model = getOpenAIModel();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await ai.chat.completions.create(
      {
        model,
        messages: [{ role: 'user', content: 'ping' }],
        max_completion_tokens: 8,
      },
      { signal: controller.signal },
    );
    return res.choices[0]?.message?.content ?? '';
  } finally {
    clearTimeout(timer);
  }
}
