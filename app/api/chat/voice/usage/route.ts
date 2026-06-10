import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { REALTIME_MODEL } from '@/lib/voice/realtime-config';
import { recordApiUsage } from '@/lib/observability/api-usage';

export const runtime = 'nodejs';
export const maxDuration = 15;

// POST /api/chat/voice/usage — sub-projeto 35.
//
// O client acumula o usage dos eventos `response.done` da sessão realtime e
// posta aqui no encerramento (ou via sendBeacon no unload). Limitação aceita
// no MVP: usage é CLIENT-REPORTED (sem proxy de mídia não há fonte server-side)
// — mitigado pelos caps do schema + sessão de 10 min + mint rate-limited.

const MAX_TOKENS_PER_FIELD = 2_000_000; // cap defensivo bem acima de 10 min reais

const Body = z.object({
  audioIn: z.number().int().min(0).max(MAX_TOKENS_PER_FIELD).default(0),
  audioOut: z.number().int().min(0).max(MAX_TOKENS_PER_FIELD).default(0),
  textIn: z.number().int().min(0).max(MAX_TOKENS_PER_FIELD).default(0),
  textOut: z.number().int().min(0).max(MAX_TOKENS_PER_FIELD).default(0),
  cachedIn: z.number().int().min(0).max(MAX_TOKENS_PER_FIELD).default(0),
  durationSecs: z.number().int().min(0).max(3600).default(0),
});

export async function POST(req: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const total = body.audioIn + body.audioOut + body.textIn + body.textOut;
  if (total === 0) return NextResponse.json({ ok: true, skipped: true });

  void recordApiUsage({
    provider: 'openai',
    operation: 'chat-voice-realtime',
    model: REALTIME_MODEL,
    tokensIn: body.audioIn + body.textIn,
    tokensOut: body.audioOut + body.textOut,
    tokensCached: body.cachedIn,
    userId: user.id,
    metadata: {
      audio_in: body.audioIn,
      audio_out: body.audioOut,
      text_in: body.textIn,
      text_out: body.textOut,
      cached_in: body.cachedIn,
      duration_secs: body.durationSecs,
      client_reported: true,
    },
  });

  return NextResponse.json({ ok: true });
}
