import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';
import { inboundDomain, generateInboundAlias } from '@/lib/email/inbound';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST — ativa o recebimento por e-mail: gera (ou retorna) o alias dedicado
// do usuário. Idempotente — não regenera se já existe.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const domain = inboundDomain();
  if (!domain) {
    return NextResponse.json({ error: 'inbound_not_configured' }, { status: 400 });
  }

  const svc = getServerSupabase();
  const { data: existing } = await svc
    .from('comprador_settings')
    .select('inbound_alias')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing?.inbound_alias) {
    return NextResponse.json({ alias: existing.inbound_alias });
  }

  // Gera com 1 retry em caso de colisão (unique).
  for (let attempt = 0; attempt < 3; attempt++) {
    const alias = generateInboundAlias(domain);
    const { error } = await svc
      .from('comprador_settings')
      .upsert(
        { user_id: user.id, inbound_alias: alias, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      );
    if (!error) return NextResponse.json({ alias });
    if (!String(error.message).includes('duplicate')) {
      console.error('[comprador/inbound/activate] failed:', error.message);
      return NextResponse.json({ error: 'persist_failed' }, { status: 500 });
    }
  }
  return NextResponse.json({ error: 'alias_collision' }, { status: 500 });
}
