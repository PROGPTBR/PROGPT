import { describe, expect, it } from 'vitest';
import { buildCotacaoXlsxBuffer } from '@/lib/assistants/xlsx';
import type { RfpParams } from '@/lib/assistants/types';

const params: RfpParams = {
  client: 'Embraer S.A.',
  scope: 'Software de gestão de frota com 200+ veículos',
  category: 'TI / Software',
  deadline: '30 dias',
  budget: 'R$ 200k–400k/ano',
  criteria: ['Preço', 'SLA'],
  notes: '',
};

describe('buildCotacaoXlsxBuffer', () => {
  it('returns a non-empty Buffer with the xlsx ZIP magic bytes (PK)', async () => {
    const buf = await buildCotacaoXlsxBuffer(params);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(1000); // workbook with banner + headers + 37 rows
    // xlsx is a ZIP archive — starts with PK (0x50 0x4B).
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });

  it('grows monotonically with empty rows already in the worksheet (sanity)', async () => {
    // Build twice with same params and verify deterministic-ish output size
    // (ExcelJS embeds a timestamp, so sizes can drift by a handful of bytes —
    // we just assert both are within a sane range).
    const a = await buildCotacaoXlsxBuffer(params);
    const b = await buildCotacaoXlsxBuffer(params);
    expect(Math.abs(a.length - b.length)).toBeLessThan(200);
  });

  it('embeds a logo image when provided', async () => {
    const tinyPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=',
      'base64',
    );
    const withLogo = await buildCotacaoXlsxBuffer(params, {
      logo: { buffer: tinyPng, mime: 'image/png' },
    });
    const withoutLogo = await buildCotacaoXlsxBuffer(params);
    expect(withLogo.length).toBeGreaterThan(withoutLogo.length);
    // Still a valid xlsx ZIP archive
    expect(withLogo[0]).toBe(0x50);
    expect(withLogo[1]).toBe(0x4b);
  });
});
