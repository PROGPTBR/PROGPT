import { describe, expect, it } from 'vitest';

describe('lib/ingest/hash', () => {
  it('sha256 returns 64-char hex digest and is deterministic', async () => {
    const { sha256 } = await import('@/lib/ingest/hash');
    const a = sha256(Buffer.from('procurementgpt', 'utf-8'));
    const b = sha256(Buffer.from('procurementgpt', 'utf-8'));
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(sha256(Buffer.from('different', 'utf-8')));
  });
});
