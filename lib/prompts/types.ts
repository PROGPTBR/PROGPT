// Sub-projeto 32 — tipos compartilhados da Biblioteca de Prompts.

/** Linha completa da tabela `prompts` (como vem do Supabase). */
export type Prompt = {
  id: string;
  prompt_number: number | null;
  title: string;
  summary: string;
  content: string;
  category: string;
  tags: string[];
  is_published: boolean;
  source: string | null;
  created_at: string;
  updated_at: string;
};

/** Subset exposto ao browse do usuário (sem campos administrativos). */
export type PublicPrompt = Pick<
  Prompt,
  'id' | 'prompt_number' | 'title' | 'summary' | 'content' | 'category' | 'tags'
>;

/**
 * Forma gravada em `scripts/data/prompts-seed.json` pela importação. Sem
 * campos gerados pelo DB (id/created_at/…) — esses nascem no seed do PROGPT.
 */
export type SeedPrompt = {
  prompt_number: number | null;
  title: string;
  summary: string;
  content: string;
  category: string;
  tags: string[];
};
