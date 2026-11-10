import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('service worker', () => {
  const source = readFileSync(join(process.cwd(), 'public', 'sw.js'), 'utf8');

  it('limpa o cache antigo e não intercepta assets ou navegações', () => {
    expect(source).toContain("const CACHE = 'progpt-v2'");
    expect(source).toContain("key.startsWith('progpt-')");
    expect(source).toContain('caches.delete(key)');
    expect(source).not.toMatch(/addEventListener\(['"]fetch['"]/);
  });
});
