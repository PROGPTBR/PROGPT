import { describe, expect, it, beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

vi.mock('@/lib/observability/api-usage', () => ({
  recordApiUsage: vi.fn(),
}));

function audioForm(bytes: number, mime = 'audio/webm'): FormData {
  const fd = new FormData();
  const blob = new Blob([new Uint8Array(bytes)], { type: mime });
  fd.append('audio', blob, 'voice.webm');
  return fd;
}

function makeReq(form: FormData): Request {
  return new Request('http://localhost/api/transcribe', {
    method: 'POST',
    body: form,
  });
}

function mockAuth(user: { id: string } | null) {
  vi.doMock('@/lib/auth', () => ({
    getCurrentUser: vi.fn().mockResolvedValue(user),
  }));
}

function mockRateLimit(allowed: boolean) {
  vi.doMock('@/lib/rate-limit', () => ({
    checkChatRateLimit: vi
      .fn()
      .mockResolvedValue(
        allowed ? { allowed: true } : { allowed: false, retryAfterSecs: 5 },
      ),
  }));
}

function mockOpenAI(returns: { text?: string; duration?: number; throws?: Error }) {
  const create = vi.fn().mockImplementation(async () => {
    if (returns.throws) throw returns.throws;
    return {
      text: returns.text ?? '',
      duration: returns.duration ?? 0,
      language: 'portuguese',
    };
  });
  vi.doMock('@/lib/llm/openai', () => ({
    getOpenAI: () => ({ audio: { transcriptions: { create } } }),
    getOpenAIModel: () => 'gpt-4o-mini',
  }));
  return { create };
}

describe('POST /api/transcribe', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth(null);
    mockRateLimit(true);
    mockOpenAI({});
    const { POST } = await import('@/app/api/transcribe/route');
    const res = await POST(makeReq(audioForm(100)));
    expect(res.status).toBe(401);
  });

  it('returns 429 when rate limited', async () => {
    mockAuth({ id: 'u1' });
    mockRateLimit(false);
    mockOpenAI({});
    const { POST } = await import('@/app/api/transcribe/route');
    const res = await POST(makeReq(audioForm(100)));
    expect(res.status).toBe(429);
  });

  it('returns 400 when audio field is missing', async () => {
    mockAuth({ id: 'u1' });
    mockRateLimit(true);
    mockOpenAI({});
    const { POST } = await import('@/app/api/transcribe/route');
    const fd = new FormData();
    fd.append('language', 'pt');
    const res = await POST(makeReq(fd));
    expect(res.status).toBe(400);
  });

  it('returns 415 on unsupported mime type', async () => {
    mockAuth({ id: 'u1' });
    mockRateLimit(true);
    mockOpenAI({});
    const { POST } = await import('@/app/api/transcribe/route');
    const res = await POST(makeReq(audioForm(100, 'application/octet-stream')));
    expect(res.status).toBe(415);
  });

  it('returns 413 when audio exceeds 25MB', async () => {
    mockAuth({ id: 'u1' });
    mockRateLimit(true);
    mockOpenAI({});
    const { POST } = await import('@/app/api/transcribe/route');
    const big = 26 * 1024 * 1024;
    const res = await POST(makeReq(audioForm(big)));
    expect(res.status).toBe(413);
  });

  it('returns transcript on happy path', async () => {
    mockAuth({ id: 'u1' });
    mockRateLimit(true);
    const { create } = mockOpenAI({
      text: '  Preciso de fornecedores de embalagens.  ',
      duration: 4.2,
    });
    const { POST } = await import('@/app/api/transcribe/route');
    const res = await POST(makeReq(audioForm(2000)));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.transcript).toBe('Preciso de fornecedores de embalagens.');
    expect(body.duration_secs).toBe(4);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('returns 500 when Whisper throws', async () => {
    mockAuth({ id: 'u1' });
    mockRateLimit(true);
    mockOpenAI({ throws: new Error('whisper boom') });
    const { POST } = await import('@/app/api/transcribe/route');
    const res = await POST(makeReq(audioForm(2000)));
    expect(res.status).toBe(500);
  });
});
