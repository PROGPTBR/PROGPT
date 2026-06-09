import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { getOpenAI } from '@/lib/llm/openai';
import { getRunForOwner } from '@/lib/assistants/runs';
import {
  NegotiationSimulatorSetupSchema,
  type NegotiationStrategyParams,
} from '@/lib/assistants/types';
import {
  TTS_MODEL,
  TTS_MAX_INPUT_CHARS,
  voiceForPersona,
} from '@/lib/assistants/negotiation/voice';
import { recordApiUsage } from '@/lib/observability/api-usage';
import { withUser } from '@/lib/observability/user-context';

export const runtime = 'nodejs';
export const maxDuration = 60;

// POST /api/assistants/runs/[id]/speak — sub-projeto 34 (modo voz).
//
// Sintetiza a fala do fornecedor simulado (texto do turno → áudio mp3) na voz
// da persona do setup. A persona vem do RUN (server-side), nunca do body — o
// cliente só manda o texto a falar (que é a resposta recém-streamada, não
// persistida por turno no servidor). Owner-gated + rate-limited (endpoint de
// custo). Falha aqui é não-fatal pro cliente: o simulador degrada pra texto.

const Body = z.object({
  text: z.string().trim().min(1).max(TTS_MAX_INPUT_CHARS),
});

export async function POST(
  req: Request,
  { params: routeParams }: { params: { id: string } },
): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return withUser(user.id, () => speakBody(req, user, routeParams));
}

async function speakBody(
  req: Request,
  user: { id: string },
  routeParams: { id: string },
): Promise<Response> {
  const rl = await checkChatRateLimit();
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', retry_after_secs: rl.retryAfterSecs },
      { status: 429 },
    );
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const run = await getRunForOwner(routeParams.id, user.id);
  if (!run || run.assistant_type !== 'negotiation') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Persona do setup persistido no run (server-side, não confiável do client).
  const rawParams = run.params as NegotiationStrategyParams & {
    simulator?: unknown;
  };
  const setup = NegotiationSimulatorSetupSchema.safeParse(rawParams.simulator);
  const persona = setup.success ? setup.data.personaProfile : null;
  const { voice, instructions } = voiceForPersona(persona);

  try {
    const ai = getOpenAI();
    const speech = await ai.audio.speech.create({
      model: TTS_MODEL,
      voice,
      input: body.text,
      instructions,
      response_format: 'mp3',
    });
    const audio = Buffer.from(await speech.arrayBuffer());

    void recordApiUsage({
      provider: 'openai',
      operation: 'assistant-negotiation-speak',
      model: TTS_MODEL,
      // TTS fatura por tokens de TEXTO de input + tokens de áudio de output.
      // A API de speech não retorna usage; aproximamos input por chars/4 e
      // output pela duração estimada (ver rate card em api-usage.ts).
      tokensIn: Math.ceil(body.text.length / 4),
      metadata: {
        chars: body.text.length,
        persona: persona ?? 'default',
        voice,
      },
    });

    return new Response(new Uint8Array(audio), {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[negotiation/speak] TTS failed:', msg);
    return NextResponse.json({ error: 'tts_failed' }, { status: 502 });
  }
}
