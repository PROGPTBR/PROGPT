import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

import { requireEnv } from '@/lib/env';
import { getOpenAIModel } from '@/lib/llm/openai';
import { recordApiUsage } from '@/lib/observability/api-usage';

// Leitura por IA da Área Médica (sub-projeto 100):
//  - a lista de cirurgias como o médico a tem (mensagens do grupo de WhatsApp,
//    anotações, planilha colada);
//  - o demonstrativo que o hospital manda por e-mail (texto, PDF, Excel).
//
// Esquemas 100% obrigatórios (nulos em vez de opcionais): o tier de geração
// em produção liga o modo estrito do structured output (ver
// tests/lib/llm/structured-output-strict.test.ts).

const Linha = z.object({
  data: z.string().nullable(),
  paciente: z.string(),
  procedimento: z.string().nullable(),
  convenio: z.string().nullable(),
  valor: z.number().nullable(),
});

export const CirurgiasExtraidasSchema = z.object({
  cirurgias: z.array(Linha.extend({ hospital: z.string().nullable() })),
});

export const DemonstrativoExtraidoSchema = z.object({
  hospital: z.string().nullable(),
  referencia: z.string().nullable(),
  valor_total: z.number().nullable(),
  itens: z.array(Linha),
});

export type CirurgiasExtraidas = z.infer<typeof CirurgiasExtraidasSchema>;
export type DemonstrativoExtraido = z.infer<typeof DemonstrativoExtraidoSchema>;

const REGRAS = `- data no formato AAAA-MM-DD. Quando o texto traz só dia e mês, use o ano mais recente que não deixe a data no futuro em relação a hoje.
- paciente: o nome ou as iniciais exatamente como aparecem.
- procedimento: o nome da cirurgia ou do procedimento.
- convenio: o plano de saúde, ou "Particular" se o texto disser.
- valor: o valor em reais como número (1234.56). Se não aparecer, null.
Copie como está: não invente paciente, data nem valor. O que não aparecer volta null. Não use travessão.`;

function systemCirurgias(hoje: string, hospitais: string[]) {
  return `Você organiza a lista de cirurgias feitas por um médico brasileiro. O texto vem de mensagens de WhatsApp, anotações ou planilha colada. Hoje é ${hoje}.

Devolva uma linha por cirurgia REALIZADA. Ignore conversa, confirmações, agendamentos cancelados e mensagens que não são cirurgia.

${REGRAS}
- hospital: o hospital onde a cirurgia foi feita, se o texto disser. Hospitais cadastrados: ${hospitais.join('; ') || 'nenhum'}. Se for um deles, use o nome exatamente como cadastrado.`;
}

function systemDemonstrativo(hoje: string) {
  return `Você lê o demonstrativo de pagamento que um hospital brasileiro envia ao médico: a relação das cirurgias e procedimentos que o hospital vai pagar. Hoje é ${hoje}.

- hospital: o hospital que emitiu o demonstrativo.
- referencia: o período ou a competência (ex.: "outubro/2026", "repasse 15/11").
- valor_total: o total a pagar ao médico (valor líquido de repasse, se houver líquido e bruto).
- itens: uma linha por cirurgia ou procedimento pago.

${REGRAS}`;
}

function modelo() {
  const openai = createOpenAI({ apiKey: requireEnv('OPENAI_API_KEY') });
  const model = getOpenAIModel('generation');
  return { model, provider: openai(model) };
}

function cached(meta: unknown): number {
  const v = (meta as { openai?: { cachedPromptTokens?: unknown } } | undefined)?.openai?.cachedPromptTokens;
  return typeof v === 'number' ? v : 0;
}

const MAX_TEXTO = 60_000;

/** Só aceita data válida no formato certo; o resto vira null para o médico preencher. */
export function dataLimpa(v: string | null): string | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return Number.isNaN(Date.parse(`${v}T00:00:00Z`)) ? null : v;
}

export async function extrairCirurgias(
  texto: string,
  hoje: string,
  hospitais: string[],
  userId: string,
): Promise<CirurgiasExtraidas> {
  const { model, provider } = modelo();
  const out = await generateObject({
    model: provider,
    system: systemCirurgias(hoje, hospitais),
    schema: CirurgiasExtraidasSchema,
    messages: [{ role: 'user', content: texto.slice(0, MAX_TEXTO) }],
  });
  void recordApiUsage({
    provider: 'openai',
    operation: 'medico-ler-cirurgias',
    model,
    tokensIn: out.usage.promptTokens,
    tokensOut: out.usage.completionTokens,
    tokensCached: cached(out.providerMetadata),
    callCount: 1,
    userId,
  });
  return {
    cirurgias: out.object.cirurgias
      .filter((c) => c.paciente.trim())
      .map((c) => ({ ...c, data: dataLimpa(c.data) })),
  };
}

export async function extrairDemonstrativo(texto: string, hoje: string, userId: string): Promise<DemonstrativoExtraido> {
  const { model, provider } = modelo();
  const out = await generateObject({
    model: provider,
    system: systemDemonstrativo(hoje),
    schema: DemonstrativoExtraidoSchema,
    messages: [{ role: 'user', content: texto.slice(0, MAX_TEXTO) }],
  });
  void recordApiUsage({
    provider: 'openai',
    operation: 'medico-ler-demonstrativo',
    model,
    tokensIn: out.usage.promptTokens,
    tokensOut: out.usage.completionTokens,
    tokensCached: cached(out.providerMetadata),
    callCount: 1,
    userId,
  });
  return {
    ...out.object,
    itens: out.object.itens.filter((i) => i.paciente.trim()).map((i) => ({ ...i, data: dataLimpa(i.data) })),
  };
}
