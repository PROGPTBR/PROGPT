import { describe, expect, it, vi } from 'vitest';

const { del } = vi.hoisted(() => ({ del: vi.fn() }));
vi.mock('@/lib/llm/openai', () => ({ getOpenAI: () => ({ files: { delete: del } }) }));

import { apagarArquivoOpenAI } from '@/lib/llm/openai-files';

describe('apagarArquivoOpenAI', () => {
  it('apaga o arquivo enviado', async () => {
    del.mockImplementationOnce(async () => ({ deleted: true }));
    await apagarArquivoOpenAI('file-123');
    expect(del).toHaveBeenLastCalledWith('file-123');
  });

  it('não faz nada sem arquivo (PDF pequeno vai inline)', async () => {
    const antes = del.mock.calls.length;
    await apagarArquivoOpenAI(null);
    expect(del.mock.calls.length).toBe(antes);
  });

  it('falha ao apagar não lança', async () => {
    del.mockImplementationOnce(async () => {
      throw new Error('falha simulada');
    });
    await expect(apagarArquivoOpenAI('file-x')).resolves.toBeUndefined();
    expect(del).toHaveBeenLastCalledWith('file-x');
  });
});
