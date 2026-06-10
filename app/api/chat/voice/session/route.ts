import { NextResponse } from 'next/server';
import { requireEnv } from '@/lib/env';
import { getCurrentUser } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import {
  REALTIME_MODEL,
  VOICE_SESSION_MAX_SECS,
  buildClientSecretRequest,
} from '@/lib/voice/realtime-config';

export const runtime = 'nodejs';
export const maxDuration = 30;

// POST /api/chat/voice/session — sub-projeto 35 (assistente de voz realtime).
//
// Minta um token efêmero (client secret) pra o browser conectar DIRETO na
// OpenAI Realtime via WebRTC — nosso servidor não proxeia áudio. O mint conta
// no rate-limit do chat (controle de custo: cada sessão ≈ $0.15-0.25/10min).
// `OpenAI-Safety-Identifier` leva o UUID Supabase pseudonimizado (LGPD —
// mesmo padrão do userId no Langfuse, nunca email).

export async function POST(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const rl = await checkChatRateLimit();
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', retry_after_secs: rl.retryAfterSecs },
      { status: 429 },
    );
  }

  try {
    const res = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${requireEnv('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
        'OpenAI-Safety-Identifier': user.id,
      },
      body: JSON.stringify(buildClientSecretRequest()),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.warn('[chat/voice/session] mint failed:', res.status, detail.slice(0, 300));
      return NextResponse.json({ error: 'mint_failed' }, { status: 502 });
    }
    const data = (await res.json()) as { value: string; expires_at: number };
    return NextResponse.json({
      clientSecret: data.value,
      expiresAt: data.expires_at,
      model: REALTIME_MODEL,
      maxSecs: VOICE_SESSION_MAX_SECS,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[chat/voice/session] error:', msg);
    return NextResponse.json({ error: 'mint_failed' }, { status: 502 });
  }
}
