export const EMAIL_PREVIEW_OPTIONS = [
  { id: 'update', label: 'Aviso de atualização' },
  { id: 'welcome', label: 'Boas-vindas' },
  { id: 'set-password', label: 'Definir senha' },
  { id: 'seat-invite', label: 'Convite de licença' },
  { id: 'payment-confirmed', label: 'Pagamento confirmado' },
  { id: 'payment-overdue', label: 'Pagamento em atraso' },
  { id: 'subscription-cancelled', label: 'Assinatura cancelada' },
  { id: 'approval-request', label: 'Compra: pedido de aprovação' },
  { id: 'purchase-tracking', label: 'Compra: acompanhamento' },
  { id: 'purchase-progress', label: 'Compra: avanço de etapa' },
  { id: 'purchase-completed', label: 'Compra: concluída' },
  { id: 'manager-approved', label: 'Compra: aprovada pelo gestor' },
  { id: 'manager-rejected', label: 'Compra: reprovada pelo gestor' },
  { id: 'receipt-supplier', label: 'Recebimento: fornecedor' },
  { id: 'receipt-warehouse', label: 'Recebimento: almoxarifado' },
  { id: 'receipt-finance', label: 'Recebimento: financeiro' },
  { id: 'receipt-notice', label: 'Recebimento: aviso' },
] as const;

export const EMAIL_PREVIEW_TEMPLATE_IDS = EMAIL_PREVIEW_OPTIONS.map((option) => option.id) as [
  EmailPreviewTemplateId,
  ...EmailPreviewTemplateId[],
];

export type EmailPreviewTemplateId = (typeof EMAIL_PREVIEW_OPTIONS)[number]['id'];

