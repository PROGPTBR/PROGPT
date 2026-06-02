import { getCurrentUser } from '@/lib/auth';
import { getRunForOwner } from '@/lib/assistants/runs';
import type { RefineMessage } from '@/lib/assistants/types';

export const runtime = 'nodejs';

// GET /api/assistants/runs/[id]/refine-messages
// Item 6 — carrega o histórico persistido do refine-chat (owner-scoped) pra
// hidratar o painel ao reabrir um run. 404 se o run não é do usuário.
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const run = await getRunForOwner(params.id, user.id);
  if (!run) return new Response('Not Found', { status: 404 });

  const messages: RefineMessage[] = Array.isArray(run.refine_messages)
    ? run.refine_messages
    : [];
  return Response.json({ messages });
}
