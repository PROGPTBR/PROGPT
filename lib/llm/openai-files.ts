import { getOpenAI } from './openai';

// PDF grande vai para a Files API da OpenAI e lá ficaria guardado até alguém
// apagar. Depois de lido, apagamos (privacidade, sub-projeto 82). Fail-soft,
// mesmo padrão de recordApiUsage: chamar com `void`, nunca lança.
export async function apagarArquivoOpenAI(fileId: string | null | undefined): Promise<void> {
  if (!fileId) return;
  try {
    await getOpenAI().files.delete(fileId);
  } catch (err) {
    console.warn('[openai-files] não consegui apagar o arquivo', fileId, err instanceof Error ? err.message : err);
  }
}
