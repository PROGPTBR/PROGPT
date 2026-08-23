// Batch M do backlog do diretor (21/08) — "não consegui trabalhar no
// assistente, parece que está travado em uma operação". Todo *Assistant.tsx
// consome o SSE do backend com o mesmo laço `while (true) { await
// reader.read() }`; se a resposta travar no meio (processo reiniciado,
// conexão caída sem FIN, modelo pendurado) o `read()` nunca resolve e nunca
// rejeita — a UI fica esperando pra sempre, sem erro nem forma de tentar de
// novo. `readAssistantChunk` é um watchdog: se nenhum chunk novo chega em
// `stallMs`, rejeita com uma mensagem acionável que cai no catch já
// existente em cada componente (toast/banner de erro já leem `err.message`).

export class AssistantStreamStallError extends Error {
  constructor() {
    super('A geração parece ter travado. Tente novamente em instantes.');
    this.name = 'AssistantStreamStallError';
  }
}

// 90s sem nenhum chunk novo = travado. Folga generosa: TTFT normal é ~1s e
// respostas longas seguem streamando texto continuamente — 90s de silêncio
// total no meio de um stream já em andamento não é "gerando devagar", é travado.
const DEFAULT_STALL_MS = 90_000;

/** `reader.read()` com timeout de inatividade — ver o porquê acima. */
export function readAssistantChunk(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  stallMs: number = DEFAULT_STALL_MS,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new AssistantStreamStallError()), stallMs);
    reader.read().then(
      (result) => {
        clearTimeout(timer);
        resolve(result);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
