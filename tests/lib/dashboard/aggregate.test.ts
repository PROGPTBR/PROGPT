import { describe, it, expect } from 'vitest';
import {
  lastNMonths,
  monthKey,
  tallyByMonth,
  activitySeries,
  groupRunsByType,
} from '@/lib/dashboard/aggregate';

describe('lastNMonths', () => {
  it('retorna n meses em ordem crescente, terminando no mês de ref', () => {
    const ref = new Date(Date.UTC(2026, 6, 11)); // 2026-07
    expect(lastNMonths(ref, 3)).toEqual(['2026-05', '2026-06', '2026-07']);
  });

  it('atravessa a virada de ano', () => {
    const ref = new Date(Date.UTC(2026, 1, 15)); // 2026-02
    expect(lastNMonths(ref, 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });

  it('retorna 12 meses', () => {
    const ref = new Date(Date.UTC(2026, 0, 1));
    expect(lastNMonths(ref, 12)).toHaveLength(12);
  });
});

describe('monthKey', () => {
  it('extrai YYYY-MM de uma data ISO', () => {
    expect(monthKey('2026-07-11T13:00:00.000Z')).toBe('2026-07');
    expect(monthKey('2026-07-11')).toBe('2026-07');
  });
});

describe('tallyByMonth', () => {
  it('conta datas por mês dentro da janela e zera os ausentes', () => {
    const months = ['2026-05', '2026-06', '2026-07'];
    const dates = [
      '2026-07-01T00:00:00Z',
      '2026-07-20T00:00:00Z',
      '2026-05-15T00:00:00Z',
      '2026-01-01T00:00:00Z', // fora da janela → ignorado
    ];
    expect(tallyByMonth(dates, months)).toEqual({
      '2026-05': 1,
      '2026-06': 0,
      '2026-07': 2,
    });
  });

  it('ignora strings vazias', () => {
    expect(tallyByMonth(['', '2026-07-01'], ['2026-07'])).toEqual({ '2026-07': 1 });
  });
});

describe('activitySeries', () => {
  it('combina conversas e execuções por mês na janela', () => {
    const months = ['2026-06', '2026-07'];
    const series = activitySeries(
      months,
      ['2026-07-01', '2026-07-02'],
      ['2026-06-10'],
    );
    expect(series).toEqual([
      { key: '2026-06', sessions: 0, runs: 1 },
      { key: '2026-07', sessions: 2, runs: 0 },
    ]);
  });
});

describe('groupRunsByType', () => {
  it('conta só execuções done, agrupadas por tipo, com rótulo amigável', () => {
    const rows = [
      { assistant_type: 'rfp', status: 'done' },
      { assistant_type: 'rfp', status: 'done' },
      { assistant_type: 'kraljic', status: 'done' },
      { assistant_type: 'rfp', status: 'error' }, // ignorado
      { assistant_type: 'porter', status: 'running' }, // ignorado
    ];
    expect(groupRunsByType(rows)).toEqual([
      { type: 'rfp', label: 'RFP', count: 2 },
      { type: 'kraljic', label: 'Kraljic', count: 1 },
    ]);
  });

  it('cai no valor cru para tipos desconhecidos', () => {
    const rows = [{ assistant_type: 'tipo_novo', status: 'done' }];
    expect(groupRunsByType(rows)).toEqual([
      { type: 'tipo_novo', label: 'tipo_novo', count: 1 },
    ]);
  });

  it('retorna vazio quando não há execuções concluídas', () => {
    expect(groupRunsByType([{ assistant_type: 'rfp', status: 'running' }])).toEqual([]);
  });
});
