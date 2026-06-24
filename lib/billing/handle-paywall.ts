import { toast } from 'sonner';

// Sub-projeto 27 — helper client-side pra tratar 402 paywall em fetches
// pra /api/assistants/*.
//
// Pattern de uso em qualquer assistant form:
//
//   const res = await fetch('/api/assistants/rfp', { ... });
//   if (handlePaywallResponse(res, 'rfp')) return; // toast disparado, abandona o fluxo
//   if (!res.ok) { ... }
//
// Match estético com o toast.error('rate_limited') existente nos forms.

const TYPE_LABELS: Record<string, string> = {
  rfp: 'RFP',
  kraljic: 'análise Kraljic',
  porter: 'análise Porter',
  financial: 'análise financeira',
  abc: 'curva ABC',
  profile: 'perfil de categoria',
  negotiation: 'simulação de negociação',
  spend_analysis: 'análise de gastos',
};

/**
 * Retorna `true` se a Response é 402 paywall e o toast foi disparado.
 * Caller deve interromper o fluxo. Retorna `false` caso contrário —
 * caller segue normalmente.
 */
export function handlePaywallResponse(
  res: Response,
  assistantType: string,
): boolean {
  if (res.status !== 402) return false;
  const label = TYPE_LABELS[assistantType] ?? 'assistente';
  toast.error(`Você já usou sua ${label} grátis`, {
    description: 'Faça upgrade pro Pro pra continuar.',
    action: {
      label: 'Ver planos',
      onClick: () => {
        window.location.href = '/pricing';
      },
    },
    duration: 8000,
  });
  return true;
}
