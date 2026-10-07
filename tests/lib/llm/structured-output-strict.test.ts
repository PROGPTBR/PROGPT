import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { FluxoStageOutputSchema } from '@/lib/fluxo/types';
import { CompradorResultSchema } from '@/lib/assistants/comprador';
import { ReplySchema } from '@/lib/assistants/comprador-inbox';

// O tier de geração em produção (gpt-5.x) é tratado como modelo de raciocínio
// pelo @ai-sdk/openai, que liga o modo ESTRITO do structured output: o OpenAI
// recusa o esquema inteiro se algum campo não estiver em "required". Com
// gpt-4o-mini (dev/CI) o modo estrito fica desligado — por isso o erro só
// aparecia em produção (Fluxo de Compras e Proc2Pay quebrados até 2026-10-07).

/** Campos fora de "required", em qualquer nível do esquema. */
function camposOpcionais(s: any, path = '$'): string[] {
  const out: string[] = [];
  if (s?.type === 'object' && s.properties) {
    const req = new Set(s.required ?? []);
    for (const k of Object.keys(s.properties)) {
      if (!req.has(k)) out.push(`${path}.${k}`);
      out.push(...camposOpcionais(s.properties[k], `${path}.${k}`));
    }
  }
  if (s?.items) out.push(...camposOpcionais(s.items, `${path}[]`));
  for (const k of ['anyOf', 'oneOf', 'allOf']) for (const x of s?.[k] ?? []) out.push(...camposOpcionais(x, path));
  return out;
}

describe('esquemas de generateObject compatíveis com o modo estrito', () => {
  it.each([
    ['FluxoStageOutputSchema', FluxoStageOutputSchema],
    ['CompradorResultSchema', CompradorResultSchema],
    ['ReplySchema', ReplySchema],
  ])('%s não tem campo opcional', (_n, schema) => {
    expect(camposOpcionais(zodToJsonSchema(schema as never, { target: 'openApi3' }))).toEqual([]);
  });

  it('Proc2Pay (esquemas com campos opcionais) desliga o modo estrito', () => {
    for (const f of ['lib/proc2pay/intake.ts', 'lib/proc2pay/executors.ts']) {
      expect(readFileSync(f, 'utf8')).toMatch(/structuredOutputs: false/);
    }
  });
});
