import { describe, expect, it, vi, afterEach } from 'vitest';
import { readAssistantChunk, AssistantStreamStallError } from '@/lib/assistants/stream-client';

afterEach(() => {
  vi.useRealTimers();
});

function fakeReader(readImpl: () => Promise<ReadableStreamReadResult<Uint8Array>>) {
  return { read: readImpl } as unknown as ReadableStreamDefaultReader<Uint8Array>;
}

describe('readAssistantChunk', () => {
  it('resolves with the chunk when read() finishes before the stall timeout', async () => {
    const reader = fakeReader(() =>
      Promise.resolve({ value: new Uint8Array([1, 2, 3]), done: false }),
    );
    const result = await readAssistantChunk(reader, 1000);
    expect(result.done).toBe(false);
    expect(result.value).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('rejects with AssistantStreamStallError when no chunk arrives within stallMs', async () => {
    vi.useFakeTimers();
    const neverResolves = new Promise<ReadableStreamReadResult<Uint8Array>>(() => {});
    const reader = fakeReader(() => neverResolves);
    const promise = readAssistantChunk(reader, 5000);
    const assertion = expect(promise).rejects.toBeInstanceOf(AssistantStreamStallError);
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
  });

  it('propagates the original rejection from read() (not the stall error) on a real error', async () => {
    const reader = fakeReader(() => Promise.reject(new Error('network drop')));
    await expect(readAssistantChunk(reader, 1000)).rejects.toThrow('network drop');
  });

  it('clears the stall timer once read() resolves — no leftover pending timer', async () => {
    vi.useFakeTimers();
    const reader = fakeReader(() => Promise.resolve({ value: undefined, done: true }));
    const result = await readAssistantChunk(reader, 5000);
    expect(result.done).toBe(true);
    // Se o timer não tivesse sido limpo, avançar o tempo aqui rejeitaria uma
    // promise já resolvida (unhandled rejection) — não deve acontecer.
    await vi.advanceTimersByTimeAsync(10000);
  });
});
