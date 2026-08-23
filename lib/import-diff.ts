// Diff puro entre uma base já salva e linhas recém-importadas — usado pelos
// imports de Materiais e Vendor List (Batch L do backlog do diretor) pra
// mostrar "N novos · N atualizados" antes de gravar ("que possa ser
// atualizado" — a preview é o que garante que a importação é uma
// atualização segura, não uma duplicação silenciosa).

export type UpsertClassification<T> = {
  novos: T[];
  atualizados: T[];
  /** Linhas sem chave (ex.: sem código/CNPJ) — não dá pra saber se é novo ou update; tratado como novo cadastro manual. */
  semChave: T[];
};

export function classifyUpsert<T>(
  existingKeys: ReadonlySet<string>,
  incoming: T[],
  keyOf: (item: T) => string | null,
): UpsertClassification<T> {
  const novos: T[] = [];
  const atualizados: T[] = [];
  const semChave: T[] = [];
  for (const item of incoming) {
    const k = keyOf(item);
    if (k === null) {
      semChave.push(item);
      continue;
    }
    if (existingKeys.has(k)) atualizados.push(item);
    else novos.push(item);
  }
  return { novos, atualizados, semChave };
}
