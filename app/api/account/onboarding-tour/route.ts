import { NextResponse } from 'next/server';

import { requireUser, NotAuthenticated } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Marca o tour de primeiro acesso como visto. Chamado tanto ao concluir
// quanto ao pular — nos dois casos o cliente já decidiu, e o tour não deve
// reaparecer no próximo login (nem em outro computador, por isso é coluna no
// banco e não localStorage).
//
// Service-role: `profiles` não tem policy de UPDATE para o próprio usuário
// sobre esta coluna, e o filtro explícito por user.id é o que garante o
// isolamento (mesmo padrão das demais rotas de conta).
export async function POST() {
  try {
    const user = await requireUser();

    const { error } = await getServerSupabase()
      .from('profiles')
      .update({ onboarding_tour_completed_at: new Date().toISOString() })
      .eq('id', user.id);

    if (error) {
      console.error('[onboarding-tour] falha ao marcar como visto', error);
      return NextResponse.json({ error: 'update_failed' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof NotAuthenticated) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    throw err;
  }
}
