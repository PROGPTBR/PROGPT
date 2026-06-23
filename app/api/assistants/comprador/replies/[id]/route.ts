import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  subject: z.string().trim().max(300).optional(),
  body: z.string().trim().max(20000).optional(),
  status: z.enum(['approved', 'discarded', 'draft']).optional(),
});

// PATCH — edita o rascunho e/ou muda o status (aprovar/descartar). Não envia.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const svc = getServerSupabase();
  const { data: reply } = await svc
    .from('comprador_replies')
    .select('id, status')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!reply) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (reply.status === 'sent') {
    return NextResponse.json({ error: 'already_sent' }, { status: 409 });
  }

  const update: Record<string, unknown> = {};
  if (parsed.subject !== undefined) update.subject = parsed.subject;
  if (parsed.body !== undefined) update.body = parsed.body;
  if (parsed.status !== undefined) update.status = parsed.status;
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 });
  }

  const { data, error } = await svc
    .from('comprador_replies')
    .update(update)
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'persist_failed' }, { status: 500 });
  return NextResponse.json({ reply: data });
}
