// Sub-projeto 28 + 29 — fonte única da verdade pra branding + contato
// legal/comercial do produto.
//
// Bump CURRENT_LEGAL_VERSION sempre que houver mudança material em
// /termos, /privacidade ou /cookies. Quando bumpar, considerar:
//   - Banner pedindo re-aceite no próximo login (compara
//     profiles.terms_version vs CURRENT_LEGAL_VERSION)
//   - Email transacional notificando mudança (sub-projeto futuro)

export const CURRENT_LEGAL_VERSION = 'v2-2026-05-28';

// Última atualização dos documentos legais. Mostrado no header dos 3
// docs. Deve bater com a data no CURRENT_LEGAL_VERSION pra rastreamento.
export const LEGAL_LAST_UPDATED = '28 de maio de 2026';

// Nome do produto exibido nas UIs e nos docs legais. Trocado pra PROGPT
// no sub-projeto 29 (branding oficial 2B Supply).
export const PRODUCT_NAME = 'PROGPT';

// Empresa responsável legal pelo produto.
export const COMPANY_NAME = '2BSUPPLY';
export const COMPANY_CNPJ = '36.335.299/0001-82';

// Contato comercial + DPO (LGPD). Único canal pra suporte, dúvidas
// sobre termos, exercício de direitos LGPD, e contestações.
export const LEGAL_CONTACT_EMAIL = 'comercial@2bsupply.com.br';
export const LEGAL_CONTACT_PHONE = '+55 (21) 99512-7272';
export const LEGAL_CONTACT_PHONE_TEL = '+5521995127272';
