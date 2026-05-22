import { NextResponse } from 'next/server';
import { toFile } from 'openai/uploads';
import { getCurrentUser } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { getOpenAI } from '@/lib/llm/openai';
import { recordApiUsage } from '@/lib/observability/api-usage';

export const runtime = 'nodejs';

// Caps defensivos. Cliente já enforça mas backend repete.
const MAX_BYTES = 25 * 1024 * 1024; // Whisper aceita até 25MB
const MAX_DURATION_SECS = 120;

// Whisper aceita mp3/mp4/mpeg/mpga/m4a/wav/webm/ogg.
const ALLOWED_MIMES = new Set([
  'audio/webm',
  'audio/webm;codecs=opus',
  'audio/ogg',
  'audio/ogg;codecs=opus',
  'audio/mp4',
  'audio/m4a',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
]);

export async function POST(req: Request): Promise<Response> {
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

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'invalid_form' }, { status: 400 });
  }

  const audio = form.get('audio');
  if (!(audio instanceof File)) {
    return NextResponse.json({ error: 'missing_audio' }, { status: 400 });
  }

  if (audio.size > MAX_BYTES) {
    return NextResponse.json(
      { error: 'file_too_large', max_bytes: MAX_BYTES },
      { status: 413 },
    );
  }

  const mime = (audio.type ?? '').toLowerCase().split(';')[0]?.trim() ?? '';
  const fullMime = (audio.type ?? '').toLowerCase();
  // Aceita por mime "base" OU mime com codecs.
  if (!ALLOWED_MIMES.has(fullMime) && !ALLOWED_MIMES.has(mime)) {
    return NextResponse.json(
      { error: 'unsupported_mime', mime: audio.type ?? null },
      { status: 415 },
    );
  }

  const language = typeof form.get('language') === 'string' ? (form.get('language') as string) : undefined;

  try {
    const ai = getOpenAI();
    const filename =
      audio.name && audio.name !== 'blob'
        ? audio.name
        : mime === 'audio/webm'
          ? 'voice.webm'
          : 'voice.audio';
    const bytes = new Uint8Array(await audio.arrayBuffer());
    const upload = await toFile(bytes, filename, {
      type: audio.type || 'audio/webm',
    });

    const result = await ai.audio.transcriptions.create({
      file: upload,
      model: 'whisper-1',
      response_format: 'verbose_json',
      language: language ?? 'pt',
    });

    const transcript = (result.text ?? '').trim();
    const durationSecs = Math.min(
      MAX_DURATION_SECS,
      Math.max(0, Math.round(result.duration ?? 0)),
    );

    void recordApiUsage({
      provider: 'openai',
      operation: 'chat-transcribe',
      model: 'whisper-1',
      tokensIn: durationSecs, // ABUSO: segundos de áudio em tokensIn
      callCount: 1,
      metadata: {
        duration_secs: durationSecs,
        bytes: audio.size,
        mime,
        language: language ?? 'pt',
      },
    });

    return NextResponse.json({
      transcript,
      duration_secs: durationSecs,
      language: result.language ?? language ?? 'pt',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/transcribe] failed:', msg);
    return NextResponse.json(
      { error: 'transcribe_failed', message: msg.slice(0, 200) },
      { status: 500 },
    );
  }
}
