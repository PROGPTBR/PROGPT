import { describe, expect, it } from 'vitest';

import {
  MIN_SEATS,
  MAX_SEATS,
  parseSeats,
  seatsTotal,
  seatsLabel,
  seatsChargeSummary,
  normalizeSeatEmails,
  formatBRL,
} from '@/lib/billing/seats';

// Assinatura por usuário (2026-09-17): uma empresa que contrata 3 acessos
// paga 3 × o unitário. Estas funções são a ÚNICA fonte da conta — o que a
// tela mostra e o que vai pro Asaas saem daqui, então divergir aqui é
// cobrar errado.

describe('parseSeats', () => {
  it('defaults to 1 for missing / garbage input', () => {
    expect(parseSeats(undefined)).toBe(1);
    expect(parseSeats(null)).toBe(1);
    expect(parseSeats('')).toBe(1);
    expect(parseSeats('abc')).toBe(1);
    expect(parseSeats(NaN)).toBe(1);
  });

  it('accepts numbers and numeric strings (query string do link)', () => {
    expect(parseSeats(3)).toBe(3);
    expect(parseSeats('3')).toBe(3);
    expect(parseSeats(' 3 ')).toBe(3);
  });

  it('clamps to the allowed range instead of throwing', () => {
    expect(parseSeats(0)).toBe(MIN_SEATS);
    expect(parseSeats(-7)).toBe(MIN_SEATS);
    expect(parseSeats(9999)).toBe(MAX_SEATS);
  });

  it('truncates fractions (não existe meio usuário)', () => {
    expect(parseSeats(2.9)).toBe(2);
  });
});

describe('seatsTotal', () => {
  it('multiplies the unit price by the seat count', () => {
    expect(seatsTotal(73, 1)).toBe(73);
    expect(seatsTotal(73, 3)).toBe(219);
    expect(seatsTotal(73, 10)).toBe(730);
  });

  it('rounds to cents so the Asaas value is never 218.99999999', () => {
    expect(seatsTotal(73.33, 3)).toBe(219.99);
  });

  it('is safe with invalid input', () => {
    expect(seatsTotal(Number.NaN, 3)).toBe(0);
    expect(seatsTotal(73, 'abc')).toBe(73);
  });
});

describe('labels', () => {
  it('formats BRL in pt-BR', () => {
    expect(formatBRL(219)).toBe('R$ 219,00');
  });

  it('pluralizes the seat label', () => {
    expect(seatsLabel(1)).toBe('1 usuário');
    expect(seatsLabel(3)).toBe('3 usuários');
  });

  it('spells out the math only when there is more than one seat', () => {
    expect(seatsChargeSummary(73, 1)).toBe('R$ 73,00/mês');
    expect(seatsChargeSummary(73, 3)).toBe('3 × R$ 73,00 = R$ 219,00/mês');
  });
});

describe('normalizeSeatEmails', () => {
  it('keeps at most seats-1 emails (o titular já ocupa 1 acesso)', () => {
    expect(
      normalizeSeatEmails(['a@x.com', 'b@x.com', 'c@x.com'], 3),
    ).toEqual(['a@x.com', 'b@x.com']);
  });

  it('returns nothing for a single-seat subscription', () => {
    expect(normalizeSeatEmails(['a@x.com'], 1)).toEqual([]);
  });

  it('lowercases, trims and de-dupes', () => {
    expect(
      normalizeSeatEmails([' A@X.com ', 'a@x.com', 'b@x.com'], 3),
    ).toEqual(['a@x.com', 'b@x.com']);
  });

  it('drops junk silently instead of failing the signup', () => {
    expect(normalizeSeatEmails(['sem-arroba', '', 42, null], 3)).toEqual([]);
    expect(normalizeSeatEmails('not-an-array', 3)).toEqual([]);
    expect(normalizeSeatEmails(undefined, 3)).toEqual([]);
  });
});
