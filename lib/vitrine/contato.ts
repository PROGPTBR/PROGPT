import { LEGAL_CONTACT_PHONE_TEL } from '@/lib/legal/constants';

// Vitrines de produtos sob demanda (sub-projeto 68). As abas "Gestão de Obras"
// e "Gestão de Demandas" mostram só dados de exemplo: quem quiser o produto de
// verdade fala com o comercial da 2B Supply, que entrega sob demanda. Todo
// botão de "quero este produto" — e toda ação que gravaria algo na demo —
// termina neste link de WhatsApp, com a mensagem já dizendo qual produto é.

export type ProdutoVitrine = 'gestao_obras' | 'gestao_demandas';

export const PRODUTO_VITRINE_LABEL: Record<ProdutoVitrine, string> = {
  gestao_obras: 'Gestão de Obras',
  gestao_demandas: 'Gestão de Demandas',
};

/** Número no formato do wa.me: só dígitos, com DDI. */
export const WHATSAPP_COMERCIAL = LEGAL_CONTACT_PHONE_TEL.replace(/\D/g, '');

export function solicitarProdutoHref(produto: ProdutoVitrine): string {
  const nome = PRODUTO_VITRINE_LABEL[produto];
  const texto =
    `Olá! Conheci a demonstração de ${nome} no PROGPT e tenho interesse ` +
    `em implantar na minha empresa. Podemos conversar?`;
  return `https://wa.me/${WHATSAPP_COMERCIAL}?text=${encodeURIComponent(texto)}`;
}
