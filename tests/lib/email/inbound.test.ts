import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import {
  verifyResendSignature,
  generateInboundAlias,
  inboundDomain,
} from '@/lib/email/inbound';

const SECRET = 'whsec_' + Buffer.from('super-secret-key-1234567890').toString('base64');

function sign(payload: string, id: string, ts: number): string {
  const key = Buffer.from(SECRET.replace(/^whsec_/, ''), 'base64');
  const sig = crypto.createHmac('sha256', key).update(`${id}.${ts}.${payload}`).digest('base64');
  return `v1,${sig}`;
}

describe('verifyResendSignature', () => {
  const payload = JSON.stringify({ type: 'email.received', data: { email_id: 'e1' } });
  const id = 'msg_123';
  const now = 1_800_000_000;

  it('aceita uma assinatura válida dentro da tolerância', () => {
    const ok = verifyResendSignature({
      payload,
      svixId: id,
      svixTimestamp: String(now),
      svixSignature: sign(payload, id, now),
      secret: SECRET,
      nowSecs: now,
    });
    expect(ok).toBe(true);
  });

  it('rejeita payload adulterado', () => {
    const ok = verifyResendSignature({
      payload: payload + 'x',
      svixId: id,
      svixTimestamp: String(now),
      svixSignature: sign(payload, id, now),
      secret: SECRET,
      nowSecs: now,
    });
    expect(ok).toBe(false);
  });

  it('rejeita timestamp fora da tolerância (replay)', () => {
    const ok = verifyResendSignature({
      payload,
      svixId: id,
      svixTimestamp: String(now),
      svixSignature: sign(payload, id, now),
      secret: SECRET,
      nowSecs: now + 10_000,
    });
    expect(ok).toBe(false);
  });

  it('rejeita quando faltam headers', () => {
    expect(
      verifyResendSignature({
        payload,
        svixId: null,
        svixTimestamp: String(now),
        svixSignature: sign(payload, id, now),
        secret: SECRET,
        nowSecs: now,
      }),
    ).toBe(false);
  });

  it('rejeita secret errado', () => {
    const ok = verifyResendSignature({
      payload,
      svixId: id,
      svixTimestamp: String(now),
      svixSignature: sign(payload, id, now),
      secret: 'whsec_' + Buffer.from('outra-chave').toString('base64'),
      nowSecs: now,
    });
    expect(ok).toBe(false);
  });
});

describe('generateInboundAlias', () => {
  it('gera no formato cotacoes-<hex>@dominio', () => {
    const alias = generateInboundAlias('inbound.2bsupply.com.br');
    expect(alias).toMatch(/^cotacoes-[0-9a-f]{10}@inbound\.2bsupply\.com\.br$/);
  });

  it('dois aliases são diferentes', () => {
    expect(generateInboundAlias('x.com')).not.toBe(generateInboundAlias('x.com'));
  });
});

describe('inboundDomain', () => {
  it('retorna null quando o env não está setado', () => {
    const prev = process.env.RESEND_INBOUND_DOMAIN;
    delete process.env.RESEND_INBOUND_DOMAIN;
    expect(inboundDomain()).toBeNull();
    if (prev !== undefined) process.env.RESEND_INBOUND_DOMAIN = prev;
  });
});
