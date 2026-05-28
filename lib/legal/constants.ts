// Sub-projeto 28 — versionamento dos documentos legais.
//
// Bump CURRENT_LEGAL_VERSION sempre que houver mudança material em
// /termos, /privacidade ou /cookies. Quando bumpar, considerar:
//   - Banner pedindo re-aceite no próximo login (compara
//     profiles.terms_version vs CURRENT_LEGAL_VERSION)
//   - Email transacional notificando mudança (quando email transacional
//     for implementado — sub-projeto futuro)

export const CURRENT_LEGAL_VERSION = 'v1-2026-05-28';

// Última atualização dos documentos legais. Mostrado no header dos 3
// docs. Deve bater com a data no CURRENT_LEGAL_VERSION pra rastreamento.
export const LEGAL_LAST_UPDATED = '28 de maio de 2026';

// Contato pra exercício de direitos LGPD (titular dos dados) e suporte
// legal. TODO: trocar pra dpo@<dominio-final> quando branding fechar.
export const LEGAL_CONTACT_EMAIL = 'rgoalves@gmail.com';

// Nome do produto exibido nos docs. Mantém alinhado com branding TBD
// (sub-projeto futuro pode trocar).
export const PRODUCT_NAME = 'ProcurementGPT';
