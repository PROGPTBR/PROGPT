import { describe, it, expect } from 'vitest';
import { proc2payAlias, userIdFromAlias, userIdFromRecipients } from '@/lib/proc2pay/inbound-alias';

const UID = '04db02ee-125a-46e1-9ef6-c84b1f321960';

describe('proc2pay inbound alias (round-trip)', () => {
  it('gera o alias com o user_id sem hífens', () => {
    expect(proc2payAlias(UID, 'inbound.2bsupply.com.br')).toBe(
      'proc2pay-04db02ee125a46e19ef6c84b1f321960@inbound.2bsupply.com.br',
    );
  });

  it('recupera o user_id do endereço (UUID com hífens)', () => {
    const addr = proc2payAlias(UID, 'x.com');
    expect(userIdFromAlias(addr)).toBe(UID);
  });

  it('é case-insensitive e ignora endereços não-proc2pay', () => {
    expect(userIdFromAlias('COMPRAS@x.com')).toBeNull();
    expect(userIdFromAlias('proc2pay-naohex@x.com')).toBeNull();
  });

  it('userIdFromRecipients acha o 1º alias válido na lista', () => {
    const addr = proc2payAlias(UID, 'x.com');
    expect(userIdFromRecipients(['outro@x.com', addr])).toBe(UID);
    expect(userIdFromRecipients(['nada@x.com'])).toBeNull();
    expect(userIdFromRecipients(undefined)).toBeNull();
  });
});
