import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/supabase', () => ({ getServerSupabase: vi.fn() }));

import { cifrar, cnpjLimpo, cnpjsDoJwt, creditoDoMovimento, criarState, decifrar, lerState, movimentoDoEvento, segredoDoWebhookConfere, urlDeAutorizacao } from '@/lib/medico/btg';

const UID = '5efba61c-6b36-49d1-b443-b235b003ad54';
const CNPJ = '11222333000181';

beforeEach(() => {
  vi.stubEnv('APP_SECRET', 'segredo-de-teste');
  vi.stubEnv('BTG_CLIENT_ID', 'app-123');
  vi.stubEnv('BTG_CLIENT_SECRET', 'xyz');
  vi.stubEnv('BTG_WEBHOOK_SECRET', 'ba143409-d498-4ac4-a6ae-b97d44a19e3f');
});

describe('BTG: autorização', () => {
  it('valida o CNPJ pelos dígitos verificadores', () => {
    expect(cnpjLimpo('11.222.333/0001-81')).toBe(CNPJ);
    expect(cnpjLimpo('11.222.333/0001-82')).toBeNull();
    expect(cnpjLimpo('00000000000000')).toBeNull();
    expect(cnpjLimpo('123')).toBeNull();
  });

  it('o state volta só se a assinatura confere e não venceu', () => {
    const state = criarState(UID, CNPJ, 1_000_000);
    expect(lerState(state, 1_000_000 + 60_000)).toEqual({ userId: UID, cnpj: CNPJ });
    expect(lerState(state, 1_000_000 + 16 * 60_000)).toBeNull(); // venceu
    const [corpo, assinatura] = state.split('.');
    const adulterado = Buffer.from(JSON.stringify({ u: 'outro-usuario', c: CNPJ, e: 9e15 })).toString('base64url');
    expect(lerState(`${adulterado}.${assinatura}`, 1_000_000)).toBeNull();
    expect(lerState(`${corpo}.x`, 1_000_000)).toBeNull();
    expect(lerState(null)).toBeNull();
  });

  it('pede só leitura da conta, no endereço do BTG Id', () => {
    const url = new URL(urlDeAutorizacao('abc'));
    expect(url.origin + url.pathname).toBe('https://id.btgpactual.com/oauth2/authorize');
    expect(url.searchParams.get('scope')).toBe('openid empresas.btgpactual.com/accounts.readonly');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe('app-123');
    expect(url.searchParams.get('redirect_uri')).toBe('https://2bsupply.ia.br/api/medico/btg/callback');
  });

  it('o refresh token é guardado cifrado e volta igual', () => {
    const cifrado = cifrar('WV6G4HKBrvgiLoFdMBiVx');
    expect(cifrado).not.toContain('WV6G4HKBrv');
    expect(decifrar(cifrado)).toBe('WV6G4HKBrvgiLoFdMBiVx');
    expect(cifrar('WV6G4HKBrvgiLoFdMBiVx')).not.toBe(cifrado); // IV novo a cada vez
    expect(() => decifrar(cifrado.slice(0, -2) + 'AA')).toThrow();
  });

  it('acha os CNPJs que o banco declarou no token', () => {
    const jwt = `x.${Buffer.from(JSON.stringify({ sub: 'u', companies: [{ taxId: CNPJ }], iat: 17000000000000 })).toString('base64url')}.y`;
    expect(cnpjsDoJwt(jwt)).toEqual([CNPJ]);
    expect(cnpjsDoJwt(undefined)).toEqual([]);
  });
});

describe('BTG: webhook (exemplos da ficha técnica da Conta PJ)', () => {
  it('só aceita o segredo certo no cabeçalho Authorization', () => {
    expect(segredoDoWebhookConfere('Bearer ba143409-d498-4ac4-a6ae-b97d44a19e3f')).toBe(true);
    expect(segredoDoWebhookConfere('Bearer ba143409-d498-4ac4-a6ae-b97d44a19e3e')).toBe(false);
    expect(segredoDoWebhookConfere(null)).toBe(false);
    vi.stubEnv('BTG_WEBHOOK_SECRET', '');
    expect(segredoDoWebhookConfere('Bearer ')).toBe(false);
  });

  it('crédito por Pix (agência 50)', () => {
    const m = movimentoDoEvento({
      webhookId: 'bb2ae4c5-8094-4f3c-b0e0-02646ba6e5e3',
      event: 'transactions.credit',
      data: {
        accountId: '25257331000132-208-50-003633854',
        date: '2023-04-10T13:47:16.146Z',
        creditDebitIndicator: 'CREDIT',
        amount: 65,
        currency: 'BRL',
        transactionId: '10000000000',
        type: 'Pix',
        relatedParty: { taxId: '03000000000', name: 'PEDRO ALVARES CABRAL' },
        payload: { endToEndId: 'E00360305202304101345201fa2cd0f3' },
        description: 'Pix recebido de PEDRO ALVARES CABRAL PIXyz2K7jSRdnDXu9OM09CDdJ',
      },
    })!;
    expect(m).toMatchObject({ cnpj: '25257331000132', transacao_id: '10000000000', sentido: 'entrada', valor: 65, forma: 'Pix', contraparte: 'PEDRO ALVARES CABRAL' });
    expect(creditoDoMovimento(m)).toMatchObject({ data: '2023-04-10', valor: 65 });
  });

  it('débito (agência 1, com taxId) e eventos que não são movimento', () => {
    const m = movimentoDoEvento({
      event: 'transactions.debit',
      data: { taxId: '10101111000444', accountId: '10101111000444-208-1-2232343', creditDebitIndicator: 'DEBIT', transactionId: 'f431e6f1', date: '2025-11-22T17:51:04.8369995Z', amount: 998.84, description: 'GENERIC-BILLING' },
    })!;
    expect(m).toMatchObject({ cnpj: '10101111000444', sentido: 'saida', valor: 998.84, descricao: 'GENERIC-BILLING' });
    expect(movimentoDoEvento({ event: 'balance.avaliable', data: { taxId: '50000000000000', available: { amount: 2046 } } })).toBeNull();
    expect(movimentoDoEvento({ event: 'transactions.credit', data: { accountId: 'x', amount: 'abc' } })).toBeNull();
    expect(movimentoDoEvento(null)).toBeNull();
  });

  it('o dia do crédito é o de Brasília, não o de UTC', () => {
    // 01:30 UTC do dia 11 ainda é dia 10 em Brasília.
    expect(creditoDoMovimento({ data: '2026-11-11T01:30:00.000Z', valor: 10, descricao: 'TED', contraparte: 'HOSPITAL' })).toEqual({ data: '2026-11-10', valor: 10, descricao: 'TED HOSPITAL' });
  });
});
