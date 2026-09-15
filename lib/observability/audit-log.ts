import { getServerSupabase } from '@/lib/db/supabase';

// Log de auditoria genérico pra ações administrativas (visão "Super Admin",
// /admin/monitor). Mesmo padrão fire-and-soft de recordApiUsage (lib/observability/api-usage.ts):
// async function que engole qualquer erro internamente — falha de log NUNCA
// derruba a operação administrativa que a originou. Chamar como
// `void recordAuditLog(...)` no call site. Escrita/leitura só via
// service-role (RLS sem policy, mesmo padrão de rate_limit_events).
export type AuditLogInput = {
  actorId: string;
  actorEmail?: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  // Sub-projeto "Plataforma" — ações administrativas sobre uma org
  // específica (ver /api/plataforma/*). Null para ações cross-org (ex.:
  // CRUD de plataforma_templates) ou para o /admin de conteúdo, que não
  // tem noção de org.
  orgId?: string | null;
};

export async function recordAuditLog(input: AuditLogInput): Promise<void> {
  try {
    const svc = getServerSupabase();
    const { error } = await svc.from('audit_log').insert({
      actor_id: input.actorId,
      actor_email: input.actorEmail ?? null,
      action: input.action,
      resource_type: input.resourceType ?? null,
      resource_id: input.resourceId ?? null,
      metadata: input.metadata ?? {},
      org_id: input.orgId ?? null,
    });
    if (error) {
      console.warn(`[audit-log] insert failed for action=${input.action}:`, error.message);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[audit-log] recordAuditLog swallowed error:', message);
  }
}
