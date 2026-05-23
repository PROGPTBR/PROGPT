import { AsyncLocalStorage } from 'node:async_hooks';

// Sub-projeto 23 — propagação de user.id pro cost tracking.
//
// Muitos `recordApiUsage` acontecem em código de biblioteca (voyage.embed,
// rag/classifier, rag/condenser, rag/followups, etc.) que NÃO recebe
// user.id como parâmetro. Pra evitar refactor invasivo passando userId
// por toda a call chain, usamos AsyncLocalStorage:
//
//   - Rota entra com `await requireUser()` → obtém user.id
//   - Wrap o handler com `withUser(user.id, async () => { ... })`
//   - Toda chamada a `recordApiUsage` dentro desse escopo (async)
//     resolve `currentUserId()` automaticamente
//
// Funciona em Node runtime (runtime: 'nodejs' nas API routes). Edge
// runtime não tem async_hooks — todas as nossas rotas de cost são Node.

type UserContext = { userId: string };

const store = new AsyncLocalStorage<UserContext>();

/**
 * Roda `fn` num async-context onde `currentUserId()` retorna `userId`.
 * Idiomático pra wrap de route handlers:
 *
 *   export async function POST(req: Request) {
 *     const user = await requireUser();
 *     return withUser(user.id, async () => {
 *       // existing logic
 *       return result;
 *     });
 *   }
 */
export function withUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  return store.run({ userId }, fn);
}

/** Retorna user.id se chamado dentro de `withUser()`; null caso contrário. */
export function currentUserId(): string | null {
  return store.getStore()?.userId ?? null;
}
