import { getServerSupabase } from '@/lib/db/supabase';

// Sub-projeto 25 — helpers de auto-delete (LGPD).
//
// `getAccountFootprint` agrega quantas rows o user tem espalhadas pelas
// tabelas com user_id. Mostrado na página /account/delete pra ele saber o
// que vai apagar antes de confirmar. As FK cascateiam quando
// `auth.admin.deleteUser(userId)` é chamado — esse helper é só
// informativo.

export type AccountFootprint = {
  sessions: number;
  assistantRuns: number;
  feedback: number;
};

export async function getAccountFootprint(
  userId: string,
): Promise<AccountFootprint> {
  const sb = getServerSupabase();

  // 3 counts em paralelo — todas as 3 tabelas têm CASCADE em auth.users
  // (migrations 0004, 0008, 0014). api_usage_events fica preservado com
  // user_id=NULL após delete (decisão deliberada do sub-projeto 23).
  const [sessions, assistantRuns, feedback] = await Promise.all([
    sb.from('sessions').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    sb.from('assistant_runs').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    sb.from('message_feedback').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ]);

  return {
    sessions: sessions.count ?? 0,
    assistantRuns: assistantRuns.count ?? 0,
    feedback: feedback.count ?? 0,
  };
}
