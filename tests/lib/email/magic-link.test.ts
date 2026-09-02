import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

function mockSupabase(generateLink: ReturnType<typeof vi.fn>) {
  vi.doMock('@/lib/db/supabase', () => ({
    getServerSupabase: () => ({ auth: { admin: { generateLink } } }),
  }));
}

describe('generateMagicLink', () => {
  it('returns the action_link on success', async () => {
    const generateLink = vi.fn().mockResolvedValue({
      data: { properties: { action_link: 'https://x/verify?token=abc' } },
      error: null,
    });
    mockSupabase(generateLink);
    const { generateMagicLink } = await import('@/lib/email/magic-link');
    const link = await generateMagicLink('x@y.com');
    expect(link).toBe('https://x/verify?token=abc');
    expect(generateLink).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'magiclink', email: 'x@y.com' }),
    );
  });

  it('returns null (fail-soft) when Supabase returns an error', async () => {
    const generateLink = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'boom' },
    });
    mockSupabase(generateLink);
    const { generateMagicLink } = await import('@/lib/email/magic-link');
    await expect(generateMagicLink('x@y.com')).resolves.toBeNull();
  });

  it('returns null (fail-soft) when generateLink throws', async () => {
    const generateLink = vi.fn().mockRejectedValue(new Error('network down'));
    mockSupabase(generateLink);
    const { generateMagicLink } = await import('@/lib/email/magic-link');
    await expect(generateMagicLink('x@y.com')).resolves.toBeNull();
  });
});
