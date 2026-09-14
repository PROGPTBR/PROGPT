import { describe, expect, it, vi, afterEach } from 'vitest';
import { buscarCep } from '@/components/auth/viaCep';

// buscarCep é só uma conveniência (auto-preenche rua/bairro/cidade/estado no
// cadastro) — esses campos nunca são enviados ao servidor (só postalCode +
// addressNumber são). Por isso NUNCA deve lançar exceção: qualquer falha
// (rede, timeout, CEP inexistente) precisa devolver `null`, nunca travar o
// fluxo de cadastro do cliente.
afterEach(() => {
  vi.restoreAllMocks();
});

describe('buscarCep', () => {
  it('returns null without fetching for an incomplete CEP', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result = await buscarCep('1234');
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns the address for a valid CEP', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ logradouro: 'Rua X', bairro: 'Centro', localidade: 'SP', uf: 'SP' }),
        { status: 200 },
      ),
    );
    const result = await buscarCep('01310-100');
    expect(result).toMatchObject({ logradouro: 'Rua X', uf: 'SP' });
  });

  it('returns null when ViaCEP reports the CEP does not exist', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ erro: true }), { status: 200 }),
    );
    const result = await buscarCep('00000-000');
    expect(result).toBeNull();
  });

  it('returns null (never throws) on a non-2xx HTTP response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 500 }));
    await expect(buscarCep('01310-100')).resolves.toBeNull();
  });

  it('returns null (never throws) on a network failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));
    await expect(buscarCep('01310-100')).resolves.toBeNull();
  });

  it('returns null (never throws) on a malformed JSON response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('not json', { status: 200 }));
    await expect(buscarCep('01310-100')).resolves.toBeNull();
  });
});
