import { getAppUrl } from './client';
import type { EmailPreviewTemplateId } from './preview-options';
import type { UpdateCategory } from '@/lib/updates/types';
import {
  buildFluxoAndamentoEmail,
  buildFluxoAprovacaoEmail,
  buildFluxoDecisaoGestorEmail,
  buildPaymentConfirmedEmail,
  buildPaymentOverdueEmail,
  buildRecebimentoAvisoEmail,
  buildRecebimentoLinkEmail,
  buildSeatInviteEmail,
  buildSetPasswordEmail,
  buildSubscriptionCancelledEmail,
  buildUpdateAnnouncementEmail,
  buildWelcomeEmail,
} from './templates';

export type UpdatePreviewDraft = {
  title: string;
  summary: string;
  slug: string;
  category: UpdateCategory;
};

type EmailPreview = { subject: string; html: string };

export function buildEmailPreview(
  template: EmailPreviewTemplateId,
  update: UpdatePreviewDraft,
): EmailPreview {
  const appUrl = getAppUrl();
  const secureLink = `${appUrl}/preview/link-seguro`;

  switch (template) {
    case 'update':
      return buildUpdateAnnouncementEmail(update);
    case 'welcome':
      return buildWelcomeEmail({ email: 'maria@empresa.com.br' });
    case 'set-password':
      return buildSetPasswordEmail({ name: 'Maria Oliveira', link: `${appUrl}/set-password?token=preview` });
    case 'seat-invite':
      return buildSeatInviteEmail({
        inviterName: 'João da Silva',
        inviterEmail: 'joao@empresa.com.br',
        link: `${appUrl}/invite/preview`,
      });
    case 'payment-confirmed':
      return buildPaymentConfirmedEmail({
        email: 'maria@empresa.com.br',
        amountBrl: 99,
        nextDueDate: '10/12/2026',
      });
    case 'payment-overdue':
      return buildPaymentOverdueEmail({ email: 'maria@empresa.com.br', accessUntil: '15/11/2026' });
    case 'subscription-cancelled':
      return buildSubscriptionCancelledEmail({
        email: 'maria@empresa.com.br',
        accessUntil: '10/12/2026',
      });
    case 'approval-request':
      return buildFluxoAprovacaoEmail({
        aprovadorNome: 'Carlos Souza',
        compradorNome: 'Maria Oliveira',
        tituloCompra: 'Aquisição de notebooks',
        etapaLabel: 'Aprovação da diretoria',
        resumo: 'Compra de 20 notebooks para renovação do parque de TI.',
        link: secureLink,
        expiraEm: '12/11/2026 às 18h',
      });
    case 'purchase-tracking':
      return buildFluxoAndamentoEmail({
        solicitanteNome: 'Ana Costa',
        tituloCompra: 'Aquisição de notebooks',
        link: secureLink,
      });
    case 'purchase-progress':
      return buildFluxoAndamentoEmail({
        solicitanteNome: 'Ana Costa',
        tituloCompra: 'Aquisição de notebooks',
        link: secureLink,
        etapaConcluida: 'Cotação',
        proximaEtapa: 'Aprovação da diretoria',
      });
    case 'purchase-completed':
      return buildFluxoAndamentoEmail({
        solicitanteNome: 'Ana Costa',
        tituloCompra: 'Aquisição de notebooks',
        link: secureLink,
        concluido: true,
      });
    case 'manager-approved':
    case 'manager-rejected':
      return buildFluxoDecisaoGestorEmail({
        aprovadorNome: 'Carlos Souza',
        aprovadorEmail: 'carlos@empresa.com.br',
        tituloCompra: 'Aquisição de notebooks',
        etapaLabel: 'Aprovação da diretoria',
        aprovado: template === 'manager-approved',
        comentario:
          template === 'manager-approved'
            ? 'Aprovado conforme orçamento apresentado.'
            : 'Ajustar a quantidade antes de reenviar.',
        link: `${appUrl}/admin/fluxos/preview`,
      });
    case 'receipt-supplier':
    case 'receipt-warehouse':
    case 'receipt-finance': {
      const papel = {
        'receipt-supplier': 'fornecedor',
        'receipt-warehouse': 'almoxarifado',
        'receipt-finance': 'financeiro',
      }[template] as 'fornecedor' | 'almoxarifado' | 'financeiro';
      return buildRecebimentoLinkEmail({
        papel,
        nome: papel === 'fornecedor' ? 'Paulo' : papel === 'almoxarifado' ? 'Rafael' : 'Juliana',
        compradorNome: 'Maria Oliveira',
        pedido: 'PC-2026-0042',
        fornecedor: 'Fornecedor Exemplo Ltda.',
        link: secureLink,
      });
    }
    case 'receipt-notice':
      return buildRecebimentoAvisoEmail({
        nome: 'Maria Oliveira',
        assunto: 'Nota fiscal recebida — PC-2026-0042',
        titulo: 'A nota fiscal foi anexada',
        texto: 'O fornecedor anexou a nota fiscal do pedido PC-2026-0042. Ela já está disponível para conferência.',
        link: `${appUrl}/admin/recebimentos/preview`,
        botao: 'Conferir nota fiscal',
      });
  }
}

