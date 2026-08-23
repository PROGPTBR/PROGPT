import { describe, expect, it } from 'vitest';
import { classifyUpsert } from '@/lib/import-diff';

describe('classifyUpsert', () => {
  it('splits incoming rows into novos/atualizados by key membership', () => {
    const existing = new Set(['aaa', 'bbb']);
    const incoming = [{ k: 'aaa' }, { k: 'ccc' }, { k: 'bbb' }];
    const { novos, atualizados, semChave } = classifyUpsert(existing, incoming, (r) => r.k);
    expect(novos).toEqual([{ k: 'ccc' }]);
    expect(atualizados).toEqual([{ k: 'aaa' }, { k: 'bbb' }]);
    expect(semChave).toEqual([]);
  });

  it('rows whose keyOf returns null go to semChave, not novos/atualizados', () => {
    const existing = new Set(['aaa']);
    const incoming = [{ k: 'aaa' }, { k: null }];
    const { novos, atualizados, semChave } = classifyUpsert(existing, incoming, (r) => r.k);
    expect(novos).toEqual([]);
    expect(atualizados).toEqual([{ k: 'aaa' }]);
    expect(semChave).toEqual([{ k: null }]);
  });

  it('empty existing set → everything with a key is novo', () => {
    const { novos, atualizados } = classifyUpsert(new Set(), [{ k: 'x' }, { k: 'y' }], (r) => r.k);
    expect(novos).toHaveLength(2);
    expect(atualizados).toHaveLength(0);
  });

  it('empty incoming → all buckets empty', () => {
    const out = classifyUpsert(new Set(['a']), [] as { k: string }[], (r) => r.k);
    expect(out).toEqual({ novos: [], atualizados: [], semChave: [] });
  });
});
