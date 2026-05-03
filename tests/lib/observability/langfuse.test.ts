import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV };
  delete process.env.LANGFUSE_SECRET_KEY;
  delete process.env.LANGFUSE_PUBLIC_KEY;
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe('lib/observability/langfuse', () => {
  it('startTrace returns a no-op trace when LANGFUSE_SECRET_KEY is missing', async () => {
    const { startTrace } = await import('@/lib/observability/langfuse');
    const trace = await startTrace({ name: 'test' });
    const span = trace.span('child');
    span.end({ ok: true });
    trace.setMetadata('k', 'v');
    trace.setTag('tag');
    trace.end({ ok: true }, 'DEFAULT');
    expect(trace).toBeDefined();
  });

  it('startTrace returns a no-op trace when keys are empty strings', async () => {
    process.env.LANGFUSE_SECRET_KEY = '';
    process.env.LANGFUSE_PUBLIC_KEY = '';
    const { startTrace } = await import('@/lib/observability/langfuse');
    const trace = await startTrace({ name: 'test' });
    expect(() => trace.span('x').end()).not.toThrow();
    expect(() => trace.end()).not.toThrow();
  });

  it('startTrace creates a real Langfuse trace when keys are present', async () => {
    process.env.LANGFUSE_SECRET_KEY = 'sk-test';
    process.env.LANGFUSE_PUBLIC_KEY = 'pk-test';
    const lfTraceUpdate = vi.fn();
    const lfSpanEnd = vi.fn();
    const lfTraceSpan = vi.fn().mockReturnValue({ end: lfSpanEnd });
    const lfTrace = vi.fn().mockReturnValue({ update: lfTraceUpdate, span: lfTraceSpan });
    const flushAsync = vi.fn().mockResolvedValue(undefined);
    const Langfuse = vi.fn().mockImplementation(() => ({ trace: lfTrace, flushAsync }));
    vi.doMock('langfuse', () => ({ Langfuse }));

    const obs = await import('@/lib/observability/langfuse');
    const trace = await obs.startTrace({
      name: 'chat.turn',
      userId: 'u1',
      sessionId: 's1',
      input: { msg: 'hi' },
      tags: ['env:production'],
    });
    expect(Langfuse).toHaveBeenCalledWith(
      expect.objectContaining({ secretKey: 'sk-test', publicKey: 'pk-test' }),
    );
    expect(lfTrace).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'chat.turn',
        userId: 'u1',
        sessionId: 's1',
        tags: ['env:production'],
      }),
    );
    const span = trace.span('classify', { q: 'foo' });
    span.end({ ok: true }, 'DEFAULT');
    expect(lfTraceSpan).toHaveBeenCalledWith({ name: 'classify', input: { q: 'foo' } });
    expect(lfSpanEnd).toHaveBeenCalledWith({ output: { ok: true }, level: 'DEFAULT' });

    trace.end({ done: true }, 'ERROR');
    expect(lfTraceUpdate).toHaveBeenCalledWith({ output: { done: true }, level: 'ERROR' });

    await obs.flushAsync();
    expect(flushAsync).toHaveBeenCalled();
  });

  it('flushAsync resolves immediately when no client was instantiated', async () => {
    const { flushAsync } = await import('@/lib/observability/langfuse');
    await expect(flushAsync()).resolves.toBeUndefined();
  });
});
