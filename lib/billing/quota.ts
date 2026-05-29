import { getServerSupabase } from '@/lib/db/supabase';
import { isPro } from './subscription';
import type { AssistantType } from '@/lib/assistants/types';

// Sub-projeto 27 — quota check do free tier.
//
// Regra: user free pode executar CADA assistant_type UMA vez na vida da
// conta. Pro = ilimitado. Quota é lifetime (não reseta mensalmente).
//
// Conta via assistant_runs (já existe desde sub-projeto 20). Não cria
// tabela nova — count direto.

export const FREE_LIFETIME_QUOTA = 1;

// Cap de turnos do simulador de negociação por execução no free tier.
// O simulador é multi-turno dentro de UMA run (que o free já tem direito a
// criar). Sem cap, um free poderia rodar turnos LLM indefinidamente nessa
// run. 30 turnos = sessão de prática completa. Pro = ilimitado.
// NOTA: o rate limit (60 turnos/h por usuário) é o backstop duro contra
// abuso; este cap é o limite de produto pra um free bem-comportado.
export const FREE_NEGOTIATION_TURN_CAP = 30;

/**
 * Quantas execuções o user já fez de um dado assistant_type.
 * Inclui runs com status='running'|'done'|'failed' (todas contam — não
 * dá pra re-tentar grátis se falhou no LLM).
 */
export async function getAssistantQuotaUsed(
  userId: string,
  type: AssistantType,
): Promise<number> {
  const sb = getServerSupabase();
  const { count, error } = await sb
    .from('assistant_runs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('assistant_type', type);
  if (error) {
    console.warn('[billing] getAssistantQuotaUsed failed:', error.message);
    // Fail-closed: na dúvida, bloqueia. Melhor user reclamar que está
    // sendo bloqueado do que liberar grátis em caso de bug de count.
    return Number.MAX_SAFE_INTEGER;
  }
  return count ?? 0;
}

/**
 * True se user pode executar mais uma run desse assistente.
 *   - Pro: sempre true
 *   - Free: true se quota usada < FREE_LIFETIME_QUOTA
 */
export async function canUseAssistant(
  userId: string,
  type: AssistantType,
): Promise<boolean> {
  if (await isPro(userId)) return true;
  const used = await getAssistantQuotaUsed(userId, type);
  return used < FREE_LIFETIME_QUOTA;
}

/**
 * True se o user pode tomar mais um turno no simulador de negociação.
 *   - turnos até o cap (inclusive): sempre liberado
 *   - acima do cap: só Pro
 * `userTurns` é a contagem de turnos do usuário INCLUINDO o que está
 * sendo submetido (ex.: 31 = tentando o 31º turno).
 */
export async function canTakeNegotiationTurn(
  userId: string,
  userTurns: number,
): Promise<boolean> {
  if (userTurns <= FREE_NEGOTIATION_TURN_CAP) return true;
  return isPro(userId);
}
