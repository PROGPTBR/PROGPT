import { describe, expect, it } from 'vitest';

import { enderecoCompleto, googleMapsHref } from '@/lib/suppliers/mapa-link';

describe('googleMapsHref', () => {
  it('junta os espaços da Receita e monta a busca com cidade, UF e CEP', () => {
    const href = googleMapsHref({
      endereco: 'AVENIDA WASHINGTON SOARES, 3663       4 ANDAR',
      municipio: 'FORTALEZA',
      uf: 'CE',
      cep: '60811341',
    });
    expect(href).toBe(
      'https://www.google.com/maps/search/?api=1&query=' +
        encodeURIComponent('AVENIDA WASHINGTON SOARES, 3663 4 ANDAR, FORTALEZA, CE, 60811-341, Brasil'),
    );
  });

  it('sem endereço, cai na cidade', () => {
    expect(googleMapsHref({ municipio: 'NATAL', uf: 'RN' })).toContain(
      encodeURIComponent('NATAL, RN, Brasil'),
    );
  });

  it('sem endereço nem cidade, não há link', () => {
    expect(googleMapsHref({ uf: 'SP' })).toBeNull();
  });
});

describe('enderecoCompleto', () => {
  it('mostra rua, cidade/UF e CEP numa linha', () => {
    expect(
      enderecoCompleto({ endereco: 'RUA A,  10', municipio: 'ICO', uf: 'CE', cep: '63430000' }),
    ).toBe('RUA A, 10 - ICO/CE - 63430-000');
  });
});
