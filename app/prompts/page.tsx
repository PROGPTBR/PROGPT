import { supabaseServer } from '@/lib/db/supabase-server';
import { PromptsLibrary } from '@/components/prompts/PromptsLibrary';
import type { PublicPrompt } from '@/lib/prompts/types';

export const dynamic = 'force-dynamic';

export default async function PromptsPage() {
  const sb = supabaseServer();
  // Auth já garantida pelo layout (+ middleware). Favoritos vêm filtrados por
  // RLS owner-only — não precisa passar user_id.
  const [{ data: promptsData }, { data: favData }] = await Promise.all([
    sb
      .from('prompts')
      .select('id, prompt_number, title, summary, content, category, tags')
      .eq('is_published', true)
      .order('category', { ascending: true })
      .order('prompt_number', { ascending: true, nullsFirst: false }),
    sb.from('prompt_favorites').select('prompt_id'),
  ]);

  const prompts = (promptsData ?? []) as PublicPrompt[];
  const initialFavorites = ((favData ?? []) as { prompt_id: string }[]).map(
    (r) => r.prompt_id,
  );

  return <PromptsLibrary prompts={prompts} initialFavorites={initialFavorites} />;
}
