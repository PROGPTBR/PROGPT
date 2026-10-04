import { describe, expect, it } from 'vitest';

import { WHATSAPP_COMERCIAL, solicitarProdutoHref } from '@/lib/vitrine/contato';

describe('solicitarProdutoHref', () => {
  it('aponta para o WhatsApp comercial da 2B Supply com o produto na mensagem', () => {
    expect(WHATSAPP_COMERCIAL).toBe('5521999792912');
    const href = solicitarProdutoHref('gestao_obras');
    expect(href.startsWith('https://wa.me/5521999792912?text=')).toBe(true);
    const texto = decodeURIComponent(href.split('text=')[1] ?? '');
    expect(texto).toContain('Gestão de Obras');
    expect(decodeURIComponent(solicitarProdutoHref('gestao_demandas'))).toContain('Gestão de Demandas');
  });
});
