import { getCurrentUser } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { createRun } from '@/lib/assistants/runs';
import { listTemplates } from '@/lib/assistants/templates';
import { SpendAnalysisCreateSchema } from '@/lib/assistants/types';

// POST /api/assistants/spend_analysis/create-run
// Cria o run (status 'running') e checa o PAYWALL aqui — antes de qualquer
// upload/gasto de extração. Retorna { runId } para o cliente subir os arquivos.

export async function POST(req: Request): Promise<Response> {
  let params;
  try {
    const json = await req.json();
    params = SpendAnalysisCreateSchema.parse(json).params;
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'invalid body' },
      { status: 400 },
    );
  }

  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });

  // Acesso liberado a todo usuário logado (decisão 2026-07-07: cartão no
  // cadastro ⇒ sem bloqueio de pagamento in-app; cobrança fica no Asaas).
  // Gates antigos (hasAccess/canUseAssistant → 402) removidos — ver git.

  const rl = await checkChatRateLimit();
  if (!rl.allowed) {
    return Response.json(
      { error: 'rate_limited', retry_after_secs: rl.retryAfterSecs },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSecs) } },
    );
  }

  const templates = await listTemplates('spend_analysis');
  const templateId = templates[0]?.id ?? null;

  const run = await createRun({
    userId: user.id,
    assistantType: 'spend_analysis',
    templateId,
    params,
    traceId: null,
  });
  if (!run) return Response.json({ error: 'run_insert_failed' }, { status: 500 });

  return Response.json({ runId: run.id });
}
