import type { Trace, Span, TraceLevel } from './types';

const NOOP_SPAN: Span = { end() {} };
const NOOP_TRACE: Trace = {
  span: () => NOOP_SPAN,
  end: () => {},
  setMetadata: () => {},
  setTag: () => {},
};

let cachedClient: { trace: (opts: unknown) => unknown; flushAsync: () => Promise<void> } | null =
  null;

export async function startTrace(opts: {
  name: string;
  userId?: string;
  sessionId?: string;
  input?: unknown;
  tags?: string[];
  metadata?: Record<string, unknown>;
}): Promise<Trace> {
  const secret = process.env.LANGFUSE_SECRET_KEY;
  const pub = process.env.LANGFUSE_PUBLIC_KEY;
  if (!secret || !pub) return NOOP_TRACE;

  if (!cachedClient) {
    const { Langfuse } = await import('langfuse');
    cachedClient = new Langfuse({
      secretKey: secret,
      publicKey: pub,
      baseUrl: process.env.LANGFUSE_BASE_URL ?? 'https://cloud.langfuse.com',
    }) as unknown as typeof cachedClient;
  }

  const lfTrace = (cachedClient as NonNullable<typeof cachedClient>).trace({
    name: opts.name,
    userId: opts.userId,
    sessionId: opts.sessionId,
    input: opts.input,
    tags: opts.tags,
    metadata: opts.metadata,
  }) as { update: (p: unknown) => void; span: (p: unknown) => { end: (p: unknown) => void } };

  return {
    span(name, input) {
      const lfSpan = lfTrace.span({ name, input });
      return {
        end(output, level) {
          lfSpan.end({ output, level });
        },
      };
    },
    end(output, level) {
      lfTrace.update({ output, level });
    },
    setMetadata(key, value) {
      lfTrace.update({ metadata: { [key]: value } });
    },
    setTag(tag) {
      lfTrace.update({ tags: [tag] });
    },
  };
}

export async function flushAsync(): Promise<void> {
  if (!cachedClient) return;
  await cachedClient.flushAsync();
}
