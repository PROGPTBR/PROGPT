import { describe, expect, it } from 'vitest';
import { renderKraljicChartPng } from '@/lib/assistants/kraljic-chart';
import { classifyItems } from '@/lib/assistants/kraljic';
import type { KraljicItem } from '@/lib/assistants/types';

const base: KraljicItem = {
  name: 'X', segment: '', category: '',
  spendMM: 10,
  criticality: 2, technicalSpec: 2, customerValue: 2,
  marketStructure: 2, marketRivalry: 2, supplierPower: 2, supplierSwitching: 2,
};

describe('renderKraljicChartPng', () => {
  it('returns a non-empty Buffer with PNG magic bytes (89 50)', async () => {
    const classified = classifyItems([base, { ...base, name: 'Y', spendMM: 5 }]);
    const buf = await renderKraljicChartPng(classified);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50);
  });

  it('does not throw with a single item', async () => {
    const classified = classifyItems([base]);
    await expect(renderKraljicChartPng(classified)).resolves.toBeInstanceOf(Buffer);
  });

  it('does not throw with 30+ items (label collision tolerated)', async () => {
    const many: KraljicItem[] = Array.from({ length: 30 }, (_, i) => ({
      ...base,
      name: `Item ${i}`,
      spendMM: (i + 1) * 0.5,
      criticality: ((i % 4) + 1) as 1 | 2 | 3 | 4,
      technicalSpec: (((i + 1) % 4) + 1) as 1 | 2 | 3 | 4,
    }));
    const classified = classifyItems(many);
    await expect(renderKraljicChartPng(classified)).resolves.toBeInstanceOf(Buffer);
  });
});
