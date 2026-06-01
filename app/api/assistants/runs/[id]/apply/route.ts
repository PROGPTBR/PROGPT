import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { getOpenAIModel } from '@/lib/llm/openai';
import { z } from 'zod';
import { requireEnv } from '@/lib/env';
import { getCurrentUser } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { startTrace, flushAsync } from '@/lib/observability/langfuse';
import { recordApiUsage } from '@/lib/observability/api-usage';
import { getRunForOwner, updateRunOutput } from '@/lib/assistants/runs';
import {
  splitAssembledOutput,
  ASSEMBLY_BOUNDARY,
} from '@/lib/assistants/template-assembly';
import { SCORECARD_SYSTEM_PROMPT } from '@/lib/assistants/scorecard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  suggestion: z.string().trim().min(5).max(8000),
});

const RFP_SYSTEM_PROMPT = `Você é um especialista sênior em procurement editando um draft de RFP. Receberá:

1. O draft ATUAL do RFP (apenas as seções customizáveis — Apresentação, Info do Projeto, Especificações, Critérios).
2. Uma SUGESTÃO de melhoria proposta pelo consultor (geralmente sua resposta anterior no chat).

Sua tarefa: produzir a versão atualizada do RFP incorporando a sugestão. Regras:

- Output: APENAS o markdown do RFP atualizado, sem preâmbulo, sem comentário, sem cercas de código.
- Preserve a estrutura (mesmos headings, mesma ordem das seções) salvo se a sugestão pedir reordenação explícita.
- Não invente seções novas além do que o draft atual já tem ou a sugestão pede.
- Mantenha o tom e estilo do draft original.
- Mantenha valores reais (nomes, CNPJ, e-mails) — não substitua por placeholders.
- Se a sugestão for ambígua ou inviável, faça a melhor interpretação razoável.`;

const KRALJIC_SYSTEM_PROMPT = `Você é um especialista sênior em procurement editando uma análise de portfólio via Matriz de Kraljic. Receberá:

1. O relatório ATUAL (apenas as seções customizáveis — Resumo Executivo, Plano por Quadrante, Recomendações por Item, Próximos Passos).
2. Uma SUGESTÃO de melhoria do consultor.

Regras:

- Output: APENAS o markdown atualizado, sem preâmbulo, sem cercas de código.
- Preserve a estrutura (mesmas seções, mesma ordem) e o tom.
- NÃO altere a classificação dos itens nem mude scores/quadrantes — isso é input do sistema. Se a sugestão pede reclassificação, ignore-a e mantenha o quadrante atual; mas pode mencionar no texto que "uma rerun com scores ajustados poderia mover X de Gargalo para Estratégico".
- Não invente seções novas além do que o relatório já tem.
- Mantenha valores reais (spend, nomes de itens, % por quadrante).
- Se a sugestão for ambígua, faça a melhor interpretação razoável.`;

const PORTER_SYSTEM_PROMPT = `Você é um especialista sênior em estratégia editando uma análise das 5 Forças de Porter. Receberá:

1. O relatório ATUAL (Sumário Executivo, Análise por Força, Síntese, Recomendações).
2. Uma SUGESTÃO de melhoria do consultor.

Regras:

- Output: APENAS o markdown atualizado, sem preâmbulo, sem cercas de código.
- Preserve as cinco forças canônicas (rivalidade, novos entrantes, substitutos, poder dos fornecedores, poder dos compradores) e a estrutura geral.
- Pode reclassificar intensidade (baixa/média/alta) de uma força quando o consultor traz contexto novo — diferente de Kraljic, aqui não há scoring determinístico.
- Não invente players, market shares ou números de mercado que não estejam no draft ou na sugestão.
- Mantenha o tom técnico-sênior do draft original.
- Se a sugestão for ambígua, faça a melhor interpretação razoável.`;

const FINANCIAL_SYSTEM_PROMPT = `Você é um Analista de Risco de Crédito Bancário editando um relatório de análise financeira de fornecedor. Receberá:

1. O relatório ATUAL (Sumário, 4 pilares pontuados, Demonstrativo resumido, Recomendação, Termos de pagamento, Risco de falência).
2. Uma SUGESTÃO de melhoria do consultor.

Regras:

- Output: APENAS o markdown atualizado, sem preâmbulo, sem cercas de código.
- NÃO altere o score numérico (0-100), a pontuação por pilar, a classificação (excellent/good/caution/poor) nem a recomendação (buy/caution/do_not_buy) — esses vieram do cálculo determinístico do sistema. Se a sugestão pede mudança nesses valores, ignore-a no texto e mantenha os valores originais (mas pode mencionar "uma nova análise com indicadores atualizados poderia mudar essa pontuação").
- Pode refinar narrativa, sugerir testes de DD adicionais, propor termos de pagamento alternativos, comparar com benchmarks (sem inventar números setoriais específicos).
- Mantenha o tom técnico-bancário do draft original.
- Não invente indicadores ausentes (N/D no draft permanece N/D).
- Se a sugestão for ambígua, faça a melhor interpretação razoável.`;

const ABC_SYSTEM_PROMPT = `Você é um especialista sênior em procurement editando uma Análise ABC (Curva de Pareto). Receberá:

1. O relatório ATUAL (Sumário Executivo, Plano por classe A/B/C, Cauda longa, Quick wins).
2. Uma SUGESTÃO de melhoria do consultor.

Regras:

- Output: APENAS o markdown atualizado, sem preâmbulo, sem cercas de código.
- Preserve a estrutura (mesmas seções na mesma ordem) e o tom.
- NÃO altere a classificação ABC dos itens, percentuais cumulativos, ranking nem contagens por classe — esses vieram do cálculo determinístico do sistema. Se a sugestão pede reclassificação, ignore-a no texto e mantenha os números atuais (mas pode mencionar "uma re-execução com dados consolidados poderia mover X de B para A").
- Pode refinar plano de ação por classe, sugerir consolidações específicas, propor quick wins, identificar padrões nos dados.
- Mantenha valores reais (nomes de itens, fornecedores, %).
- Se a sugestão for ambígua, faça a melhor interpretação razoável.`;

const PROFILE_SYSTEM_PROMPT = `Você é um especialista sênior em procurement editando um Perfil da Categoria (Strategic Sourcing Step 1). Receberá:

1. O relatório ATUAL (caracterização da categoria, stakeholders, prioridade, requisitos técnicos, restrições regulatórias, recomendações para próximos passos).
2. Uma SUGESTÃO de melhoria do consultor.

Regras:

- Output: APENAS o markdown atualizado, sem preâmbulo, sem cercas de código.
- Preserve a estrutura (mesmas seções na mesma ordem) e o tom.
- CRÍTICO: NÃO altere texto LITERAL dos campos audit-críticos: **Requisitos técnicos** e **Restrições regulatórias**. Esses precisam aparecer palavra por palavra como já estão no relatório. Se a sugestão pede paráfrase desses campos, ignore-a e mantenha o texto literal (pode mencionar "uma alteração desses campos exigiria editar o form e regerar o Perfil").
- Pode refinar: descrição, sub-segmentos (adicionar/reordenar), escopo, critérios de avaliação, stakeholders, observações, recomendações para próximos passos.
- Mantenha valores reais (nome da categoria, nomes de stakeholders, prioridade escolhida).
- Se a sugestão for ambígua, faça a melhor interpretação razoável.`;

// POST /api/assistants/runs/[id]/apply — merges a refine-chat suggestion
// into the RFP's customizable head. Verbatim tail (Cotação + Termos +
// Código) is untouched.
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
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

  const run = await getRunForOwner(params.id, user.id);
  if (!run) return new NextResponse('Not Found', { status: 404 });
  if (run.status !== 'done' || !run.output_md) {
    return NextResponse.json({ error: 'not_ready', status: run.status }, { status: 409 });
  }

  const rl = await checkChatRateLimit();
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', retry_after_secs: rl.retryAfterSecs },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSecs) } },
    );
  }

  const { head, tail } = splitAssembledOutput(run.output_md);

  const env = process.env.APP_ENV ?? 'production';
  const trace = await startTrace({
    name: 'assistant.rfp.apply',
    userId: user.id,
    input: { runId: run.id, suggestionLen: parsed.suggestion.length },
    tags: [`env:${env}`, 'assistant_type:rfp', 'phase:apply'],
  });

  const userPrompt = `## Draft atual do RFP

${head}

## Sugestão a incorporar

${parsed.suggestion}

## Sua resposta

Reescreva o RFP acima incorporando a sugestão. Apenas o markdown atualizado, nada mais.`;

  const openai = createOpenAI({ apiKey: requireEnv('OPENAI_API_KEY') });
  const generateSpan = trace.span('generate', { headLen: head.length });

  try {
    const result = await generateText({
      model: openai(getOpenAIModel('generation')),
      system:
        run.assistant_type === 'kraljic'
          ? KRALJIC_SYSTEM_PROMPT
          : run.assistant_type === 'porter'
            ? PORTER_SYSTEM_PROMPT
            : run.assistant_type === 'financial'
              ? FINANCIAL_SYSTEM_PROMPT
              : run.assistant_type === 'abc'
                ? ABC_SYSTEM_PROMPT
                : run.assistant_type === 'profile'
                  ? PROFILE_SYSTEM_PROMPT
                  : run.assistant_type === 'scorecard'
                    ? SCORECARD_SYSTEM_PROMPT
                    : RFP_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const cachedPromptTokens = (() => {
      const v = result.providerMetadata?.openai?.cachedPromptTokens;
      return typeof v === 'number' ? v : 0;
    })();
    generateSpan.end({
      tokens_in: result.usage.promptTokens,
      tokens_out: result.usage.completionTokens,
      tokens_cached: cachedPromptTokens,
      chars_out: result.text.length,
    });
    void recordApiUsage({
      provider: 'openai',
      operation:
        run.assistant_type === 'kraljic'
          ? 'assistant-kraljic-suggest'
          : run.assistant_type === 'porter'
            ? 'assistant-porter-apply'
            : run.assistant_type === 'financial'
              ? 'assistant-financial-apply'
              : run.assistant_type === 'abc'
                ? 'assistant-abc-apply'
                : run.assistant_type === 'profile'
                  ? 'assistant-profile-apply'
                  : run.assistant_type === 'scorecard'
                    ? 'assistant-scorecard-apply'
                    : 'assistant-rfp-apply',
      model: getOpenAIModel('generation'),
      tokensIn: result.usage.promptTokens,
      tokensOut: result.usage.completionTokens,
      tokensCached: cachedPromptTokens,
      metadata: { runId: run.id, env },
    });

    // Re-assemble with the verbatim tail intact. Always re-emit the
    // boundary marker so subsequent applies can split again.
    const newOutput = tail
      ? `${result.text.trimEnd()}\n\n${ASSEMBLY_BOUNDARY}\n\n${tail.trimStart()}`
      : result.text.trim();

    await updateRunOutput(run.id, newOutput);
    trace.end({ chars_out: newOutput.length, runId: run.id });
    await flushAsync();

    return NextResponse.json({ ok: true, output_md: newOutput });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/assistants/.../apply] failed:', err);
    trace.end({ error: message }, 'ERROR');
    await flushAsync();
    return NextResponse.json({ error: 'apply_failed' }, { status: 500 });
  }
}
